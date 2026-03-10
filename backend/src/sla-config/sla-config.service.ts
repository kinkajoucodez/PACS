import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlaConfigDto, UpdateSlaConfigDto, SlaConfigFilterDto } from './dto';
import { StudyPriority } from '@prisma/client';

@Injectable()
export class SlaConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filterDto: SlaConfigFilterDto) {
    const where: any = {};

    if (filterDto.providerId) {
      where.providerId = filterDto.providerId;
    }
    if (filterDto.modality) {
      where.modality = filterDto.modality;
    }
    if (filterDto.priority) {
      where.priority = filterDto.priority as StudyPriority;
    }
    if (filterDto.isActive !== undefined) {
      where.isActive = filterDto.isActive;
    }

    return this.prisma.slaConfiguration.findMany({
      where,
      include: {
        provider: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [{ provider: { name: 'asc' } }, { priority: 'asc' }],
    });
  }

  async findOne(id: string) {
    const config = await this.prisma.slaConfiguration.findUnique({
      where: { id },
      include: {
        provider: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!config) {
      throw new NotFoundException(`SLA configuration with ID ${id} not found`);
    }

    return config;
  }

  async create(dto: CreateSlaConfigDto) {
    // Enforce unique(providerId, modality, priority) constraint
    const existing = await this.prisma.slaConfiguration.findFirst({
      where: {
        providerId: dto.providerId,
        modality: dto.modality ?? null,
        priority: dto.priority as StudyPriority,
      },
    });

    if (existing) {
      throw new ConflictException(
        `An SLA configuration for this provider/modality/priority combination already exists (id: ${existing.id}). Use PATCH to update it.`,
      );
    }

    return this.prisma.slaConfiguration.create({
      data: {
        providerId: dto.providerId,
        modality: dto.modality ?? null,
        priority: dto.priority as StudyPriority,
        targetHours: dto.targetHours,
        warningThresholdPercent: dto.warningThresholdPercent ?? 80,
        isActive: dto.isActive ?? true,
      },
      include: {
        provider: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateSlaConfigDto) {
    await this.findOne(id);

    return this.prisma.slaConfiguration.update({
      where: { id },
      data: {
        ...(dto.modality !== undefined ? { modality: dto.modality } : {}),
        ...(dto.targetHours !== undefined ? { targetHours: dto.targetHours } : {}),
        ...(dto.warningThresholdPercent !== undefined
          ? { warningThresholdPercent: dto.warningThresholdPercent }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        provider: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.slaConfiguration.delete({ where: { id } });
  }

  /** Bulk-upsert SLA configs for a provider (used by the admin UI). */
  async upsertForProvider(
    providerId: string,
    configs: Array<{
      modality?: string;
      priority: string;
      targetHours: number;
      warningThresholdPercent?: number;
    }>,
  ) {
    const results = await Promise.all(
      configs.map(async (c) => {
        const existing = await this.prisma.slaConfiguration.findFirst({
          where: {
            providerId,
            modality: c.modality ?? null,
            priority: c.priority as StudyPriority,
          },
        });

        if (existing) {
          return this.prisma.slaConfiguration.update({
            where: { id: existing.id },
            data: {
              targetHours: c.targetHours,
              warningThresholdPercent: c.warningThresholdPercent ?? 80,
              isActive: true,
            },
          });
        }

        return this.prisma.slaConfiguration.create({
          data: {
            providerId,
            modality: c.modality ?? null,
            priority: c.priority as StudyPriority,
            targetHours: c.targetHours,
            warningThresholdPercent: c.warningThresholdPercent ?? 80,
            isActive: true,
          },
        });
      }),
    );

    return results;
  }
}
