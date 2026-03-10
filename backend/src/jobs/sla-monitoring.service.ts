import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StudyPriority, StudyStatus, NotificationType } from '@prisma/client';
import {
  SLA_CRON_SCHEDULE,
  TERMINAL_STUDY_STATUSES,
  ACTIVE_ASSIGNMENT_STATUSES,
  DEFAULT_SLA_HOURS,
  DEFAULT_WARNING_THRESHOLD_PERCENT,
} from './constants';

@Injectable()
export class SlaMonitoringService {
  private readonly logger = new Logger(SlaMonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Periodic SLA check. Runs on the configured cron schedule (default: every 5 minutes).
   *
   * For each active study with SLA tracking:
   *  - Detects breaches (now >= deadlineAt) and fires breach notifications.
   *  - Detects approaching deadlines (elapsed >= warningThreshold %) and fires
   *    warning notifications.
   *
   * Idempotent: uses `warningSentAt` / `breachedAt` to avoid duplicate notifications.
   */
  @Cron(SLA_CRON_SCHEDULE)
  async checkSlaDeadlines(): Promise<void> {
    const now = new Date();

    // Load all SLA tracking records for non-terminal studies in one query.
    const trackingRecords = await this.prisma.slaTracking.findMany({
      where: {
        study: {
          status: { notIn: TERMINAL_STUDY_STATUSES as unknown as StudyStatus[] },
        },
      },
      include: {
        study: {
          include: {
            assignments: {
              where: {
                assignmentStatus: {
                  in: ACTIVE_ASSIGNMENT_STATUSES as unknown as any[],
                },
              },
              select: { radiologistId: true },
              orderBy: { assignedAt: 'desc' },
              take: 1,
            },
          },
        },
        slaConfig: {
          select: { warningThresholdPercent: true },
        },
      },
    });

    // Fetch admin/support IDs once — used for every notification batch.
    const adminIds = await this.getAdminUserIds();

    let warnings = 0;
    let breaches = 0;

    for (const tracking of trackingRecords) {
      const { study, slaConfig } = tracking;
      const assignedRadiologistId =
        study.assignments[0]?.radiologistId ?? null;

      if (now >= tracking.deadlineAt) {
        // ── BREACH ──────────────────────────────────────────────────────────
        if (!tracking.breachedAt) {
          await this.prisma.slaTracking.update({
            where: { id: tracking.id },
            data: {
              status: 'breached',
              breachedAt: now,
              // Also record warningSentAt if it was never set.
              warningSentAt: tracking.warningSentAt ?? now,
            },
          });

          await this.createBreachNotifications(
            study,
            adminIds,
            assignedRadiologistId,
          );
          breaches++;
        }
      } else {
        // ── WARNING CHECK ────────────────────────────────────────────────────
        if (!tracking.warningSentAt) {
          const warningThreshold =
            (slaConfig?.warningThresholdPercent ?? DEFAULT_WARNING_THRESHOLD_PERCENT) / 100;

          // Elapsed fraction relative to study.receivedAt → deadlineAt window.
          const totalMs =
            tracking.deadlineAt.getTime() - study.receivedAt.getTime();
          const elapsedMs = now.getTime() - study.receivedAt.getTime();
          const elapsedFraction = totalMs > 0 ? elapsedMs / totalMs : 0;

          if (elapsedFraction >= warningThreshold) {
            await this.prisma.slaTracking.update({
              where: { id: tracking.id },
              data: { status: 'warning', warningSentAt: now },
            });

            await this.createWarningNotifications(
              study,
              adminIds,
              assignedRadiologistId,
            );
            warnings++;
          }
        }
      }
    }

    // Also check studies that have NO SlaTracking record but are still active,
    // using default SLA thresholds.
    await this.checkUntrackedStudies(now, adminIds);

    this.logger.log(
      `SLA check complete — checked: ${trackingRecords.length}, warnings: ${warnings}, breaches: ${breaches}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Checks active studies that were never assigned an SlaTracking record,
   * using the default priority-based thresholds. Creates notifications only
   * when a breach is detected and one has not already been sent.
   */
  private async checkUntrackedStudies(
    now: Date,
    adminIds: string[],
  ): Promise<void> {
    const activeStatuses: StudyStatus[] = [
      'received',
      'queued',
      'assigned',
      'in_progress',
    ];

    const untrackedStudies = await this.prisma.study.findMany({
      where: {
        status: { in: activeStatuses },
        slaTracking: null,
      },
      include: {
        assignments: {
          where: {
            assignmentStatus: {
              in: ACTIVE_ASSIGNMENT_STATUSES as unknown as any[],
            },
          },
          select: { radiologistId: true },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const study of untrackedStudies) {
      const slaHours =
        DEFAULT_SLA_HOURS[study.priority as string] ??
        DEFAULT_SLA_HOURS['routine'];
      const deadlineAt = new Date(
        study.receivedAt.getTime() + slaHours * 60 * 60 * 1000,
      );

      if (now < deadlineAt) continue;

      // Check idempotency: avoid re-sending breach notifications.
      const alreadyNotified = await this.prisma.notification.findFirst({
        where: {
          type: NotificationType.sla_breach,
          referenceType: 'study',
          referenceId: study.id,
        },
        select: { id: true },
      });

      if (alreadyNotified) continue;

      await this.createBreachNotifications(
        study,
        adminIds,
        study.assignments[0]?.radiologistId ?? null,
      );

      this.logger.warn(
        `SLA breach (untracked) — studyId=${study.id} priority=${study.priority}`,
      );
    }
  }

  /** Creates SLA breach notifications for admins and the assigned radiologist. */
  private async createBreachNotifications(
    study: { id: string; priority: StudyPriority },
    adminIds: string[],
    assignedRadiologistId: string | null,
  ): Promise<void> {
    const recipients = this.uniqueRecipients(adminIds, assignedRadiologistId);

    const notifications = recipients.map((userId) => ({
      userId,
      type: NotificationType.sla_breach,
      title: `SLA Breach — ${study.priority.toUpperCase()} study`,
      message: `Study ${study.id} has exceeded its SLA deadline.`,
      referenceType: 'study',
      referenceId: study.id,
    }));

    await this.prisma.notification.createMany({ data: notifications });

    // Escalate STAT breaches with an additional high-priority alert for admins.
    if (study.priority === StudyPriority.stat && adminIds.length > 0) {
      const escalationData = adminIds.map((userId) => ({
        userId,
        type: NotificationType.stat_alert,
        title: 'STAT Study SLA Breach — Immediate Action Required',
        message: `STAT study ${study.id} has breached its 1-hour SLA. Immediate admin attention is required.`,
        referenceType: 'study',
        referenceId: study.id,
      }));
      await this.prisma.notification.createMany({ data: escalationData });
    }

    this.logger.warn(
      `SLA breach — studyId=${study.id} priority=${study.priority} recipients=${recipients.length}`,
    );
  }

  /** Creates SLA warning notifications for admins and the assigned radiologist. */
  private async createWarningNotifications(
    study: { id: string; priority: StudyPriority },
    adminIds: string[],
    assignedRadiologistId: string | null,
  ): Promise<void> {
    const recipients = this.uniqueRecipients(adminIds, assignedRadiologistId);

    const notifications = recipients.map((userId) => ({
      userId,
      type: NotificationType.sla_warning,
      title: `SLA Warning — ${study.priority.toUpperCase()} study`,
      message: `Study ${study.id} is approaching its SLA deadline.`,
      referenceType: 'study',
      referenceId: study.id,
    }));

    await this.prisma.notification.createMany({ data: notifications });

    this.logger.log(
      `SLA warning — studyId=${study.id} priority=${study.priority} recipients=${recipients.length}`,
    );
  }

  /** Returns the IDs of all active admin and support users. */
  private async getAdminUserIds(): Promise<string[]> {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: ['admin', 'support'] as any[] },
        status: 'active',
      },
      select: { id: true },
    });
    return admins.map((u) => u.id);
  }

  /** Returns a deduplicated list of recipient user IDs. */
  private uniqueRecipients(
    adminIds: string[],
    assignedRadiologistId: string | null,
  ): string[] {
    const set = new Set(adminIds);
    if (assignedRadiologistId) set.add(assignedRadiologistId);
    return Array.from(set);
  }
}
