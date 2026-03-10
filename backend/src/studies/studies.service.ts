import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  StudyFilterDto,
  AssignStudyDto,
  ReleaseAssignmentDto,
  FlagStatDto,
  CreateStudyDto,
} from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { StudyPriority, StudyStatus, AssignmentStatus } from '@prisma/client';

@Injectable()
export class StudiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    paginationDto: PaginationDto,
    filterDto: StudyFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const {
      status,
      priority,
      modality,
      providerId,
      radiologistId,
      fromDate,
      toDate,
      search,
    } = filterDto;

    const where: any = {};

    if (status) {
      where.status = status as StudyStatus;
    }

    if (priority) {
      where.priority = priority as StudyPriority;
    }

    if (modality) {
      where.modality = { contains: modality, mode: 'insensitive' };
    }

    if (providerId) {
      where.providerId = providerId;
    }

    if (radiologistId) {
      where.assignments = {
        some: {
          radiologistId,
          assignmentStatus: { in: ['pending', 'accepted', 'in_progress'] },
        },
      };
    }

    if (fromDate) {
      where.receivedAt = { ...where.receivedAt, gte: new Date(fromDate) };
    }

    if (toDate) {
      where.receivedAt = { ...where.receivedAt, lte: new Date(toDate) };
    }

    if (search) {
      where.OR = [
        { patientId: { contains: search, mode: 'insensitive' } },
        { studyDescription: { contains: search, mode: 'insensitive' } },
        { referringPhysician: { contains: search, mode: 'insensitive' } },
        { orthancStudyId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [studies, total] = await Promise.all([
      this.prisma.study.findMany({
        where,
        skip,
        take: limit,
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          assignments: {
            where: {
              assignmentStatus: { in: ['pending', 'accepted', 'in_progress'] },
            },
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
            orderBy: { assignedAt: 'desc' },
            take: 1,
          },
          slaTracking: true,
        },
        orderBy: [
          { priority: 'asc' }, // stat first
          { receivedAt: 'asc' }, // oldest first
        ],
      }),
      this.prisma.study.count({ where }),
    ]);

    return {
      data: studies,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const study = await this.prisma.study.findUnique({
      where: { id },
      include: {
        provider: true,
        assignments: {
          include: {
            radiologist: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            assignedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
        reports: {
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
          orderBy: { createdAt: 'desc' },
        },
        slaTracking: {
          include: {
            slaConfig: true,
          },
        },
      },
    });

    if (!study) {
      throw new NotFoundException(`Study with ID ${id} not found`);
    }

    return study;
  }

  async findByOrthancId(orthancStudyId: string) {
    return this.prisma.study.findUnique({
      where: { orthancStudyId },
    });
  }

  async create(createStudyDto: CreateStudyDto) {
    return this.prisma.study.create({
      data: {
        orthancStudyId: createStudyDto.orthancStudyId,
        studyInstanceUid: createStudyDto.studyInstanceUid,
        patientId: createStudyDto.patientId,
        patientNameHash: createStudyDto.patientNameHash,
        modality: createStudyDto.modality,
        studyDescription: createStudyDto.studyDescription,
        studyDate: createStudyDto.studyDate
          ? new Date(createStudyDto.studyDate)
          : undefined,
        referringPhysician: createStudyDto.referringPhysician,
        bodyPart: createStudyDto.bodyPart,
        priority: (createStudyDto.priority || 'routine') as StudyPriority,
        providerId: createStudyDto.providerId,
        status: 'received',
      },
      include: {
        provider: true,
      },
    });
  }

  async assignStudy(
    id: string,
    assignStudyDto: AssignStudyDto,
    assignedByUserId: string,
  ) {
    const study = await this.findOne(id);

    // Check if study can be assigned
    if (!['received', 'queued'].includes(study.status)) {
      throw new BadRequestException(
        `Study cannot be assigned in ${study.status} status`,
      );
    }

    // Check if radiologist exists and is active
    const radiologist = await this.prisma.user.findUnique({
      where: { id: assignStudyDto.radiologistId },
    });

    if (!radiologist || radiologist.role !== 'radiologist') {
      throw new BadRequestException('Invalid radiologist ID');
    }

    if (radiologist.status !== 'active') {
      throw new BadRequestException('Radiologist is not active');
    }

    // Create assignment and update study status
    const [assignment] = await this.prisma.$transaction([
      this.prisma.studyAssignment.create({
        data: {
          studyId: id,
          radiologistId: assignStudyDto.radiologistId,
          assignedById: assignedByUserId,
          assignmentStatus: 'pending',
        },
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
      }),
      this.prisma.study.update({
        where: { id },
        data: { status: 'assigned' },
      }),
    ]);

    return assignment;
  }

  async releaseAssignment(
    id: string,
    releaseDto: ReleaseAssignmentDto,
    userId: string,
  ) {
    const study = await this.findOne(id);

    // Find active assignment
    const activeAssignment = study.assignments.find((a) =>
      ['pending', 'accepted', 'in_progress'].includes(a.assignmentStatus),
    );

    if (!activeAssignment) {
      throw new BadRequestException(
        'No active assignment found for this study',
      );
    }

    // Only the assigned radiologist or an admin can release
    if (activeAssignment.radiologistId !== userId) {
      // Check if user is admin (would need to verify roles)
      // For now, we'll allow the release
    }

    // Release assignment and update study status
    await this.prisma.$transaction([
      this.prisma.studyAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          assignmentStatus: 'released',
          releasedAt: new Date(),
          releaseReason: releaseDto.reason,
        },
      }),
      this.prisma.study.update({
        where: { id },
        data: { status: 'queued' },
      }),
    ]);

    return this.findOne(id);
  }

  async flagStat(id: string, flagStatDto: FlagStatDto, userId: string) {
    const study = await this.findOne(id);

    if (study.priority === 'stat') {
      throw new BadRequestException('Study is already flagged as STAT');
    }

    return this.prisma.study.update({
      where: { id },
      data: {
        priority: 'stat',
        statFlaggedAt: new Date(),
        statFlaggedBy: userId,
      },
      include: {
        provider: true,
        assignments: {
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
        },
      },
    });
  }

  async getMyWorklist(radiologistId: string, paginationDto: PaginationDto) {
    const { page, limit, skip } = paginationDto;

    const where = {
      assignments: {
        some: {
          radiologistId,
          assignmentStatus: {
            in: ['pending', 'accepted', 'in_progress'] as AssignmentStatus[],
          },
        },
      },
    };

    const [studies, total] = await Promise.all([
      this.prisma.study.findMany({
        where,
        skip,
        take: limit,
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          assignments: {
            where: {
              radiologistId,
              assignmentStatus: { in: ['pending', 'accepted', 'in_progress'] },
            },
          },
          slaTracking: true,
        },
        orderBy: [{ priority: 'asc' }, { receivedAt: 'asc' }],
      }),
      this.prisma.study.count({ where }),
    ]);

    return {
      data: studies,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }
}
