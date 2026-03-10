import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDisputeDto,
  ResolveDisputeDto,
  AssignDisputeReviewerDto,
  DisputeFilterDto,
} from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { DisputeStatus, NotificationType, StudyStatus } from '@prisma/client';

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    paginationDto: PaginationDto,
    filterDto: DisputeFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const where: any = {};

    if (filterDto.status) where.status = filterDto.status as DisputeStatus;
    if (filterDto.studyId) where.studyId = filterDto.studyId;
    if (filterDto.reportId) where.reportId = filterDto.reportId;
    if (filterDto.filedById) where.filedById = filterDto.filedById;

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        include: {
          study: {
            select: {
              id: true,
              orthancStudyId: true,
              modality: true,
              studyDescription: true,
            },
          },
          report: {
            select: { id: true, status: true, findings: true, impression: true },
          },
          filedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assignedReviewer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { filedAt: 'desc' },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      data: disputes,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        study: true,
        report: {
          include: {
            radiologist: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        filedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedReviewer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        originalReport: true,
        amendedReport: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    return dispute;
  }

  async create(dto: CreateDisputeDto, filedById: string) {
    // Verify the study and report exist
    const report = await this.prisma.report.findUnique({
      where: { id: dto.reportId },
      include: { study: true },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${dto.reportId} not found`);
    }

    if (report.studyId !== dto.studyId) {
      throw new BadRequestException(
        'The report does not belong to the specified study',
      );
    }

    // Only finalized reports can be disputed
    if (!['final', 'preliminary', 'amended'].includes(report.status)) {
      throw new BadRequestException(
        'Only finalized (final, preliminary, or amended) reports can be disputed',
      );
    }

    // Check for an existing open dispute on the same report
    const existingDispute = await this.prisma.dispute.findFirst({
      where: {
        reportId: dto.reportId,
        status: { notIn: ['resolved_original_correct', 'resolved_amended', 'closed'] as DisputeStatus[] },
      },
    });

    if (existingDispute) {
      throw new BadRequestException(
        `An active dispute already exists for this report (id: ${existingDispute.id})`,
      );
    }

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          studyId: dto.studyId,
          reportId: dto.reportId,
          filedById,
          reason: dto.reason ?? null,
          status: 'open',
          originalReportId: dto.reportId,
        },
        include: {
          study: { select: { id: true, orthancStudyId: true, modality: true } },
          report: { select: { id: true, status: true } },
          filedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Update study status to disputed
      await tx.study.update({
        where: { id: dto.studyId },
        data: { status: 'disputed' as StudyStatus },
      });

      // Notify the radiologist who wrote the report
      if (report.radiologistId) {
        await tx.notification.create({
          data: {
            userId: report.radiologistId,
            type: NotificationType.dispute_filed,
            title: 'A dispute has been filed on your report',
            message: `A dispute has been filed on report ${dto.reportId} for study ${dto.studyId}.${dto.reason ? ` Reason: ${dto.reason}` : ''}`,
            referenceType: 'dispute',
            referenceId: created.id,
          },
        });
      }

      return created;
    });

    return dispute;
  }

  async assignReviewer(
    id: string,
    dto: AssignDisputeReviewerDto,
    assignedBy: string,
  ) {
    const dispute = await this.findOne(id);

    if (!['open', 'under_review'].includes(dispute.status)) {
      throw new BadRequestException(
        `Cannot assign reviewer to a dispute with status ${dispute.status}`,
      );
    }

    // Verify reviewer exists and has appropriate role
    const reviewer = await this.prisma.user.findUnique({
      where: { id: dto.reviewerId },
    });

    if (!reviewer) {
      throw new NotFoundException(`User with ID ${dto.reviewerId} not found`);
    }

    if (!['admin', 'support', 'auditor'].includes(reviewer.role)) {
      throw new BadRequestException(
        'Reviewer must have admin, support, or auditor role',
      );
    }

    return this.prisma.dispute.update({
      where: { id },
      data: {
        assignedReviewerId: dto.reviewerId,
        status: 'under_review' as DisputeStatus,
      },
      include: {
        assignedReviewer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async resolve(id: string, dto: ResolveDisputeDto, resolvedBy: string) {
    const dispute = await this.findOne(id);

    if (['resolved_original_correct', 'resolved_amended', 'closed'].includes(dispute.status)) {
      throw new BadRequestException(
        `Dispute is already in a resolved state: ${dispute.status}`,
      );
    }

    const resolutionData: any = {
      status: dto.status as DisputeStatus,
      resolutionNotes: dto.resolutionNotes ?? null,
      resolvedAt: new Date(),
    };

    if (dto.amendedReportId) {
      resolutionData.amendedReportId = dto.amendedReportId;
    }

    const resolved = await this.prisma.$transaction(async (tx) => {
      const updatedDispute = await tx.dispute.update({
        where: { id },
        data: resolutionData,
      });

      // If the study is in 'disputed' status, move it back to 'reported' or 'amended'
      if (dispute.study.status === 'disputed') {
        const nextStatus =
          dto.status === 'resolved_amended' ? 'amended' : 'reported';
        await tx.study.update({
          where: { id: dispute.studyId },
          data: { status: nextStatus as StudyStatus },
        });
      }

      // Notify the user who filed the dispute
      await tx.notification.create({
        data: {
          userId: dispute.filedById,
          type: NotificationType.system_alert,
          title: 'Your dispute has been resolved',
          message: `Dispute ${id} has been resolved with outcome: ${dto.status}.${dto.resolutionNotes ? ` Notes: ${dto.resolutionNotes}` : ''}`,
          referenceType: 'dispute',
          referenceId: id,
        },
      });

      return updatedDispute;
    });

    return resolved;
  }
}
