import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto, RatingFilterDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    paginationDto: PaginationDto,
    filterDto: RatingFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const where: any = {};

    if (filterDto.radiologistId) where.radiologistId = filterDto.radiologistId;
    if (filterDto.studyId) where.studyId = filterDto.studyId;
    if (filterDto.ratedById) where.ratedById = filterDto.ratedById;
    if (filterDto.stars) where.stars = filterDto.stars;

    const [ratings, total] = await Promise.all([
      this.prisma.rating.findMany({
        where,
        skip,
        take: limit,
        include: {
          radiologist: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          ratedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          study: {
            select: {
              id: true,
              orthancStudyId: true,
              modality: true,
              studyDescription: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.rating.count({ where }),
    ]);

    return {
      data: ratings,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const rating = await this.prisma.rating.findUnique({
      where: { id },
      include: {
        radiologist: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        ratedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        study: true,
        report: { select: { id: true, status: true, impression: true } },
      },
    });

    if (!rating) {
      throw new NotFoundException(`Rating with ID ${id} not found`);
    }

    return rating;
  }

  async create(dto: CreateRatingDto, ratedById: string) {
    // Verify the study, report, and radiologist exist
    const report = await this.prisma.report.findUnique({
      where: { id: dto.reportId },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${dto.reportId} not found`);
    }

    if (report.studyId !== dto.studyId) {
      throw new BadRequestException(
        'The report does not belong to the specified study',
      );
    }

    if (report.radiologistId !== dto.radiologistId) {
      throw new BadRequestException(
        'The specified radiologist did not author this report',
      );
    }

    // Only finalized reports can be rated
    if (!['final', 'preliminary', 'amended'].includes(report.status)) {
      throw new BadRequestException(
        'Only finalized reports can be rated',
      );
    }

    // Check uniqueness constraint: one rating per (studyId, ratedById)
    const existing = await this.prisma.rating.findFirst({
      where: { studyId: dto.studyId, ratedById },
    });

    if (existing) {
      throw new ConflictException(
        'You have already rated this study. Each user can only submit one rating per study.',
      );
    }

    const rating = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rating.create({
        data: {
          studyId: dto.studyId,
          reportId: dto.reportId,
          radiologistId: dto.radiologistId,
          ratedById,
          stars: dto.stars,
          feedback: dto.feedback ?? null,
          isDisputeRelated: dto.isDisputeRelated ?? false,
        },
        include: {
          radiologist: {
            select: { id: true, firstName: true, lastName: true },
          },
          ratedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      // Update the radiologist's average rating
      const allRatings = await tx.rating.findMany({
        where: { radiologistId: dto.radiologistId },
        select: { stars: true },
      });

      const total = allRatings.length;
      const average =
        total > 0
          ? allRatings.reduce((sum, r) => sum + r.stars, 0) / total
          : 0;

      await tx.radiologistProfile.updateMany({
        where: { userId: dto.radiologistId },
        data: {
          averageRating: Math.round(average * 100) / 100,
          totalRatings: total,
        },
      });

      return created;
    });

    return rating;
  }

  async getRadiologistStats(radiologistId: string) {
    const profile = await this.prisma.radiologistProfile.findUnique({
      where: { userId: radiologistId },
      select: {
        averageRating: true,
        totalRatings: true,
        userId: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(
        `Radiologist profile for user ${radiologistId} not found`,
      );
    }

    // Breakdown by star count
    const breakdown = await this.prisma.rating.groupBy({
      by: ['stars'],
      where: { radiologistId },
      _count: { stars: true },
    });

    return {
      radiologistId,
      averageRating: profile.averageRating,
      totalRatings: profile.totalRatings,
      breakdown: breakdown.reduce(
        (acc, b) => {
          acc[b.stars] = b._count.stars;
          return acc;
        },
        {} as Record<number, number>,
      ),
    };
  }
}
