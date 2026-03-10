import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  ReportTemplateFilterDto,
} from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class ReportTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    paginationDto: PaginationDto,
    filterDto: ReportTemplateFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const where: any = {};

    if (filterDto.providerId) {
      where.providerId = filterDto.providerId;
    }
    if (filterDto.modality) {
      where.modality = { contains: filterDto.modality, mode: 'insensitive' };
    }
    if (filterDto.bodyPart) {
      where.bodyPart = { contains: filterDto.bodyPart, mode: 'insensitive' };
    }
    if (filterDto.isActive !== undefined) {
      where.isActive = filterDto.isActive;
    }

    const [templates, total] = await Promise.all([
      this.prisma.reportTemplate.findMany({
        where,
        skip,
        take: limit,
        include: {
          provider: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.reportTemplate.count({ where }),
    ]);

    return {
      data: templates,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const template = await this.prisma.reportTemplate.findUnique({
      where: { id },
      include: {
        provider: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Report template with ID ${id} not found`);
    }

    return template;
  }

  async create(dto: CreateReportTemplateDto) {
    return this.prisma.reportTemplate.create({
      data: {
        providerId: dto.providerId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        modality: dto.modality ?? null,
        bodyPart: dto.bodyPart ?? null,
        templateFormat: dto.templateFormat ?? 'HTML',
        templateContent: dto.templateContent ?? null,
        language: dto.language ?? 'en',
        placeholders: dto.placeholders ? this.parsePlaceholders(dto.placeholders) : Prisma.JsonNull,
        isActive: dto.isActive ?? true,
        version: 1,
      },
      include: {
        provider: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateReportTemplateDto) {
    await this.findOne(id);

    const data: Prisma.ReportTemplateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.modality !== undefined) data.modality = dto.modality;
    if (dto.bodyPart !== undefined) data.bodyPart = dto.bodyPart;
    if (dto.templateFormat !== undefined) data.templateFormat = dto.templateFormat;
    if (dto.templateContent !== undefined) data.templateContent = dto.templateContent;
    if (dto.language !== undefined) data.language = dto.language;
    if (dto.placeholders !== undefined) {
      data.placeholders = this.parsePlaceholders(dto.placeholders);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.version !== undefined) data.version = dto.version;

    return this.prisma.reportTemplate.update({
      where: { id },
      data,
      include: {
        provider: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.reportTemplate.delete({ where: { id } });
  }

  private parsePlaceholders(json: string): Prisma.InputJsonValue {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        throw new Error('placeholders must be a JSON object');
      }
      return parsed as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException(
        'Invalid JSON format for placeholders field',
      );
    }
  }
}
