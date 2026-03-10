import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  StudyFilterDto,
  AssignStudyDto,
  ReleaseAssignmentDto,
  FlagStatDto,
  CreateStudyDto,
  OrthancWebhookDto,
} from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { StudyPriority, StudyStatus, AssignmentStatus } from '@prisma/client';
import { OrthancService } from '../orthanc';

@Injectable()
export class StudiesService {
  private readonly logger = new Logger(StudiesService.name);

  constructor(
    private prisma: PrismaService,
    private orthancService: OrthancService,
  ) {}

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

  /**
   * Handles an Orthanc OnStableStudy webhook notification.
   *
   * 1. Queries Orthanc for full DICOM study metadata.
   * 2. Checks for an existing record by studyInstanceUid (duplicate guard).
   * 3. Creates a Study record in the platform database.
   * 4. Creates an SlaTracking record if a matching SLA configuration exists.
   *
   * @returns `{ status: 'created', study }` or `{ status: 'already_exists', study }`.
   */
  async handleOrthancWebhook(dto: OrthancWebhookDto): Promise<{
    status: 'created' | 'already_exists';
    study: Record<string, unknown>;
  }> {
    const { orthancStudyId } = dto;

    // Fetch metadata from Orthanc (may throw ServiceUnavailableException)
    const { study: orthancStudy, firstSeries } =
      await this.orthancService.getStudyWithSeries(orthancStudyId);

    const studyInstanceUid = orthancStudy.MainDicomTags.StudyInstanceUID;

    // Duplicate guard
    const existing = await this.prisma.study.findUnique({
      where: { studyInstanceUid },
    });
    if (existing) {
      this.logger.log(
        `Study ${studyInstanceUid} already exists (orthancStudyId=${orthancStudyId}), skipping.`,
      );
      return {
        status: 'already_exists',
        study: existing as unknown as Record<string, unknown>,
      };
    }

    // Extract and normalise metadata
    const patientId = orthancStudy.PatientMainDicomTags?.PatientID ?? undefined;
    const rawPatientName =
      orthancStudy.PatientMainDicomTags?.PatientName ?? undefined;
    // Normalise DICOM patient name (trim + collapse whitespace + uppercase)
    // before hashing so that minor formatting differences don't produce
    // different hashes for the same patient.
    const normalizedPatientName = rawPatientName
      ? rawPatientName.trim().toUpperCase().replace(/\s+/g, ' ')
      : undefined;
    const patientNameHash = normalizedPatientName
      ? createHash('sha256').update(normalizedPatientName).digest('hex')
      : undefined;

    const modality = firstSeries?.MainDicomTags?.Modality ?? undefined;
    const bodyPart = firstSeries?.MainDicomTags?.BodyPartExamined ?? undefined;

    const studyDate = orthancStudy.MainDicomTags.StudyDate
      ? this.parseOrthancDate(orthancStudy.MainDicomTags.StudyDate)
      : undefined;

    const studyDescription =
      orthancStudy.MainDicomTags.StudyDescription ?? undefined;
    const referringPhysician =
      orthancStudy.MainDicomTags.ReferringPhysicianName ?? undefined;

    // Persist study
    const study = await this.prisma.study.create({
      data: {
        orthancStudyId,
        studyInstanceUid,
        patientId,
        patientNameHash,
        modality,
        studyDescription,
        studyDate,
        referringPhysician,
        bodyPart,
        priority: 'routine',
        status: 'received',
      },
      include: { provider: true },
    });

    this.logger.log(
      `Study created: id=${study.id} studyInstanceUid=${studyInstanceUid}`,
    );

    // Attempt SLA tracking creation (best-effort)
    await this.createSlaTracking(
      study.id,
      study.providerId,
      modality ?? null,
      study.priority,
    );

    return {
      status: 'created',
      study: study as unknown as Record<string, unknown>,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parses an Orthanc DICOM date string (YYYYMMDD) into a JS Date.
   */
  private parseOrthancDate(dicomDate: string): Date | undefined {
    if (!dicomDate || dicomDate.length !== 8) return undefined;
    const year = parseInt(dicomDate.substring(0, 4), 10);
    const month = parseInt(dicomDate.substring(4, 6), 10) - 1;
    const day = parseInt(dicomDate.substring(6, 8), 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Creates an SlaTracking record if a matching SLA configuration exists for
   * the study's provider, modality, and priority.
   * Prefers an exact modality match over a wildcard (null modality) config.
   */
  private async createSlaTracking(
    studyId: string,
    providerId: string | null,
    modality: string | null,
    priority: StudyPriority,
  ): Promise<void> {
    if (!providerId) return;

    const slaConfig = await this.prisma.slaConfiguration.findFirst({
      where: {
        providerId,
        priority,
        isActive: true,
        OR: [{ modality }, { modality: null }],
      },
      orderBy: { modality: 'desc' }, // prefer specific modality match
    });

    if (!slaConfig) return;

    const targetMs = Number(slaConfig.targetHours) * 60 * 60 * 1000;
    const deadlineAt = new Date(Date.now() + targetMs);

    try {
      await this.prisma.slaTracking.create({
        data: {
          studyId,
          slaConfigId: slaConfig.id,
          deadlineAt,
          status: 'on_track',
        },
      });
      this.logger.log(`SlaTracking created for study ${studyId}`);
    } catch (err) {
      // SlaTracking is best-effort; log but do not fail the request
      this.logger.warn(
        `Could not create SlaTracking for study ${studyId}: ${(err as Error).message}`,
      );
    }
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
