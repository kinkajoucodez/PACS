import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StudyPriority, StudyStatus, NotificationType } from '@prisma/client';
import {
  AUTO_ASSIGN_CRON_SCHEDULE,
  ACTIVE_ASSIGNMENT_STATUSES,
  ESCALATION_UNASSIGNED_MINUTES,
  MS_PER_MINUTE,
} from './constants';

/** Subset of a radiologist user record plus their live workload count. */
interface RadiologistWithWorkload {
  id: string;
  firstName: string;
  lastName: string;
  specializations: string[];
  activeAssignmentCount: number;
}

@Injectable()
export class AutoAssignmentService {
  private readonly logger = new Logger(AutoAssignmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Periodic auto-assignment run. Picks up unassigned/queued studies and
   * distributes them to active radiologists using a load-balanced (fewest active
   * assignments first) strategy.
   *
   * STAT studies are processed before urgent, then routine, then follow_up.
   *
   * Runs on the configured cron schedule (default: every 3 minutes).
   */
  @Cron(AUTO_ASSIGN_CRON_SCHEDULE)
  async assignPendingStudies(): Promise<void> {
    await this.runAssignment();
  }

  /**
   * Immediately triggers the assignment engine — callable from the Orthanc
   * webhook handler so that newly ingested studies are assigned without
   * waiting for the next cron tick.
   */
  async triggerImmediateAssignment(): Promise<void> {
    await this.runAssignment();
  }

  // ---------------------------------------------------------------------------
  // Core assignment logic
  // ---------------------------------------------------------------------------

  private async runAssignment(): Promise<void> {
    // 1. Load all unassigned/queued studies (no active assignment).
    const unassignedStudies = await this.prisma.study.findMany({
      where: {
        status: { in: ['received', 'queued'] as StudyStatus[] },
        assignments: {
          none: {
            assignmentStatus: {
              in: ACTIVE_ASSIGNMENT_STATUSES as unknown as any[],
            },
          },
        },
      },
      orderBy: [
        { priority: 'asc' }, // stat < urgent < routine < follow_up (enum order)
        { receivedAt: 'asc' }, // oldest first within same priority
      ],
    });

    if (unassignedStudies.length === 0) {
      this.logger.debug('Auto-assignment: no unassigned studies found.');
      return;
    }

    // 2. Load active radiologists with their current workload.
    const radiologists = await this.loadRadiologistsWithWorkload();

    if (radiologists.length === 0) {
      this.logger.warn(
        'Auto-assignment: no active radiologists available. ' +
          `${unassignedStudies.length} studies remain unassigned.`,
      );
      await this.escalateLongUnassignedStudies(unassignedStudies);
      return;
    }

    // 3. Resolve the "system assigner" user ID (used for assignedById FK).
    const systemAssignerId = await this.resolveSystemAssignerId();

    let assigned = 0;

    for (const study of unassignedStudies) {
      // Re-sort by workload before each pick so we always choose the least
      // loaded radiologist even as workloads change within this loop.
      radiologists.sort(
        (a, b) => a.activeAssignmentCount - b.activeAssignmentCount,
      );

      // Prefer a radiologist whose specializations match the study modality.
      const preferred = study.modality
        ? radiologists.find((r) =>
            r.specializations.some(
              (s) => s.toLowerCase() === (study.modality as string).toLowerCase(),
            ),
          )
        : undefined;

      const radiologist = preferred ?? radiologists[0];

      try {
        await this.prisma.$transaction([
          this.prisma.studyAssignment.create({
            data: {
              studyId: study.id,
              radiologistId: radiologist.id,
              // For auto-assignment, use a system/admin user if available;
              // fall back to the radiologist's own ID.
              assignedById: systemAssignerId ?? radiologist.id,
              assignmentStatus: 'pending',
            },
          }),
          this.prisma.study.update({
            where: { id: study.id },
            data: { status: 'assigned' },
          }),
        ]);

        // Notify the assigned radiologist.
        await this.prisma.notification.create({
          data: {
            userId: radiologist.id,
            type: NotificationType.study_assigned,
            title: `New ${study.priority.toUpperCase()} study assigned`,
            message:
              `You have been assigned a new ${study.priority} study` +
              (study.modality ? ` (${study.modality})` : '') +
              `. Study ID: ${study.id}`,
            referenceType: 'study',
            referenceId: study.id,
          },
        });

        // Track the incremented workload locally to keep subsequent sorts accurate.
        radiologist.activeAssignmentCount += 1;
        assigned++;

        this.logger.log(
          `Auto-assigned study ${study.id} (${study.priority}) → ` +
            `radiologist ${radiologist.id} ` +
            `(${radiologist.firstName} ${radiologist.lastName}, ` +
            `workload=${radiologist.activeAssignmentCount})`,
        );
      } catch (err) {
        this.logger.error(
          `Auto-assignment failed for study ${study.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Auto-assignment complete — assigned: ${assigned}/${unassignedStudies.length}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Loads all active radiologists with their current active assignment count
   * and specializations (used for modality matching).
   */
  private async loadRadiologistsWithWorkload(): Promise<
    RadiologistWithWorkload[]
  > {
    const users = await this.prisma.user.findMany({
      where: { role: 'radiologist', status: 'active' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        radiologistProfile: {
          select: { specializations: true },
        },
        assignments: {
          where: {
            assignmentStatus: {
              in: ACTIVE_ASSIGNMENT_STATUSES as unknown as any[],
            },
          },
          select: { id: true },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      specializations: u.radiologistProfile?.specializations ?? [],
      activeAssignmentCount: u.assignments.length,
    }));
  }

  /**
   * Resolves the user ID to use as `assignedById` for system-initiated
   * assignments. Returns the first active admin's ID, or null if none exist.
   */
  private async resolveSystemAssignerId(): Promise<string | null> {
    const admin = await this.prisma.user.findFirst({
      where: { role: 'admin', status: 'active' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return admin?.id ?? null;
  }

  /**
   * Sends escalation notifications for studies that have been unassigned
   * longer than their priority-based threshold. Notifications are sent only
   * once per study (idempotency guard via existing notification lookup).
   */
  private async escalateLongUnassignedStudies(
    studies: Array<{
      id: string;
      priority: StudyPriority;
      receivedAt: Date;
    }>,
  ): Promise<void> {
    const now = Date.now();

    const adminIds = await this.prisma.user
      .findMany({
        where: { role: { in: ['admin', 'support'] as any[] }, status: 'active' },
        select: { id: true },
      })
      .then((users) => users.map((u) => u.id));

    if (adminIds.length === 0) return;

    for (const study of studies) {
      const thresholdMs =
        (ESCALATION_UNASSIGNED_MINUTES[study.priority as string] ??
          ESCALATION_UNASSIGNED_MINUTES['routine']) *
        MS_PER_MINUTE;

      if (now - study.receivedAt.getTime() < thresholdMs) continue;

      // Idempotency: skip if a system_alert was already sent for this study.
      const existing = await this.prisma.notification.findFirst({
        where: {
          type: NotificationType.system_alert,
          referenceType: 'study',
          referenceId: study.id,
        },
        select: { id: true },
      });

      if (existing) continue;

      const notifications = adminIds.map((userId) => ({
        userId,
        type: NotificationType.system_alert,
        title: `Unassigned study escalation — ${study.priority.toUpperCase()}`,
        message:
          `Study ${study.id} (${study.priority}) has been unassigned ` +
          `for longer than the ${(thresholdMs / MS_PER_MINUTE).toFixed(0)} minute threshold and no radiologist is available.`,
        referenceType: 'study',
        referenceId: study.id,
      }));

      await this.prisma.notification.createMany({ data: notifications });

      this.logger.warn(
        `Escalation sent for long-unassigned study ${study.id} (${study.priority})`,
      );
    }
  }
}
