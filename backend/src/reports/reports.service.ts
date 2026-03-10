import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReportDto,
  UpdateReportDto,
  FinalizeReportDto,
  CreateAddendumDto,
  ReportFilterDto,
} from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { ReportStatus, StudyStatus, AssignmentStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    paginationDto: PaginationDto,
    filterDto: ReportFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const { status, studyId, radiologistId } = filterDto;

    const where: any = {};

    if (status) {
      where.status = status as ReportStatus;
    }

    if (studyId) {
      where.studyId = studyId;
    }

    if (radiologistId) {
      where.radiologistId = radiologistId;
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
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
              provider: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          radiologist: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          template: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        study: {
          include: {
            provider: true,
          },
        },
        radiologist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        template: true,
        addenda: {
          include: {
            radiologist: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        parentReport: true,
      },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }

  async create(createReportDto: CreateReportDto, radiologistId: string) {
    // Verify study exists
    const study = await this.prisma.study.findUnique({
      where: { id: createReportDto.studyId },
      include: {
        assignments: {
          where: {
            radiologistId,
            assignmentStatus: {
              in: ['pending', 'accepted', 'in_progress'] as AssignmentStatus[],
            },
          },
        },
      },
    });

    if (!study) {
      throw new NotFoundException(
        `Study with ID ${createReportDto.studyId} not found`,
      );
    }

    // Check if radiologist is assigned to this study
    if (study.assignments.length === 0) {
      throw new ForbiddenException('You are not assigned to this study');
    }

    // Check if a draft report already exists
    const existingDraft = await this.prisma.report.findFirst({
      where: {
        studyId: createReportDto.studyId,
        radiologistId,
        status: 'draft',
      },
    });

    if (existingDraft) {
      throw new BadRequestException(
        'A draft report already exists for this study',
      );
    }

    // Create report and update study/assignment status
    const report = await this.prisma.$transaction(async (tx) => {
      // Update assignment status
      await tx.studyAssignment.updateMany({
        where: {
          studyId: createReportDto.studyId,
          radiologistId,
          assignmentStatus: { in: ['pending', 'accepted'] },
        },
        data: {
          assignmentStatus: 'in_progress',
          acceptedAt: new Date(),
        },
      });

      // Update study status
      await tx.study.update({
        where: { id: createReportDto.studyId },
        data: { status: 'in_progress' as StudyStatus },
      });

      // Create report
      return tx.report.create({
        data: {
          studyId: createReportDto.studyId,
          radiologistId,
          templateId: createReportDto.templateId,
          findings: createReportDto.findings,
          impression: createReportDto.impression,
          conclusion: createReportDto.conclusion,
          reportBody: createReportDto.reportBody,
          status: 'draft',
        },
        include: {
          study: true,
          radiologist: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          template: true,
        },
      });
    });

    return report;
  }

  async update(id: string, updateReportDto: UpdateReportDto, userId: string) {
    const report = await this.findOne(id);

    // Only draft reports can be updated
    if (report.status !== 'draft') {
      throw new BadRequestException('Only draft reports can be updated');
    }

    // Only the author can update the report
    if (report.radiologistId !== userId) {
      throw new ForbiddenException('You can only update your own reports');
    }

    return this.prisma.report.update({
      where: { id },
      data: updateReportDto,
      include: {
        study: true,
        radiologist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        template: true,
      },
    });
  }

  async finalize(id: string, finalizeDto: FinalizeReportDto, userId: string) {
    const report = await this.findOne(id);

    // Only draft reports can be finalized
    if (report.status !== 'draft') {
      throw new BadRequestException('Only draft reports can be finalized');
    }

    // Only the author can finalize the report
    if (report.radiologistId !== userId) {
      throw new ForbiddenException('You can only finalize your own reports');
    }

    // Validate report has required fields
    if (!report.findings && !report.reportBody) {
      throw new BadRequestException(
        'Report must have findings or report body before finalization',
      );
    }

    const finalStatus = finalizeDto.finalizeAs || 'final';

    // Finalize report and update study status
    const updatedReport = await this.prisma.$transaction(async (tx) => {
      // Update report status
      const finalizedReport = await tx.report.update({
        where: { id },
        data: {
          status: finalStatus as ReportStatus,
          finalizedAt: new Date(),
          finalizedBy: userId,
        },
        include: {
          study: true,
          radiologist: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Update assignment status
      await tx.studyAssignment.updateMany({
        where: {
          studyId: report.studyId,
          radiologistId: userId,
          assignmentStatus: 'in_progress',
        },
        data: {
          assignmentStatus: 'completed',
          completedAt: new Date(),
        },
      });

      // Update study status
      await tx.study.update({
        where: { id: report.studyId },
        data: { status: 'reported' as StudyStatus },
      });

      return finalizedReport;
    });

    return updatedReport;
  }

  async createAddendum(
    id: string,
    addendumDto: CreateAddendumDto,
    userId: string,
  ) {
    const originalReport = await this.findOne(id);

    // Only finalized reports can have addenda
    if (!['final', 'preliminary'].includes(originalReport.status)) {
      throw new BadRequestException(
        'Addenda can only be added to finalized reports',
      );
    }

    // Create addendum
    const addendum = await this.prisma.$transaction(async (tx) => {
      // Create addendum report
      const addendumReport = await tx.report.create({
        data: {
          studyId: originalReport.studyId,
          radiologistId: userId,
          parentReportId: id,
          isAddendum: true,
          findings: addendumDto.findings,
          impression: addendumDto.impression,
          conclusion: addendumDto.conclusion,
          status: 'final',
          finalizedAt: new Date(),
          finalizedBy: userId,
          version: originalReport.version + 1,
        },
        include: {
          study: true,
          radiologist: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          parentReport: true,
        },
      });

      // Update original report status to amended
      await tx.report.update({
        where: { id },
        data: { status: 'amended' as ReportStatus },
      });

      // Update study status
      await tx.study.update({
        where: { id: originalReport.studyId },
        data: { status: 'amended' as StudyStatus },
      });

      return addendumReport;
    });

    return addendum;
  }

  async getMyReports(radiologistId: string, paginationDto: PaginationDto) {
    const { page, limit, skip } = paginationDto;

    const where = { radiologistId };

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
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
              provider: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }
}
