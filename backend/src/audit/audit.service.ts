import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogFilterDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

export interface AuditLogPayload {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an audit log entry. This is a best-effort write — failures are
   * logged but never propagate to the caller.
   */
  async log(payload: AuditLogPayload): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: payload.userId ?? null,
          action: payload.action,
          resourceType: payload.resourceType ?? null,
          resourceId: payload.resourceId ?? null,
          details: payload.details as any,
          ipAddress: payload.ipAddress ?? null,
          userAgent: payload.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log [${payload.action}]: ${(err as Error).message}`,
      );
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: AuditLogFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const where: any = {};

    if (filterDto.userId) where.userId = filterDto.userId;
    if (filterDto.action) where.action = { contains: filterDto.action, mode: 'insensitive' };
    if (filterDto.resourceType) where.resourceType = filterDto.resourceType;
    if (filterDto.resourceId) where.resourceId = filterDto.resourceId;

    if (filterDto.fromDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(filterDto.fromDate) };
    }
    if (filterDto.toDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(filterDto.toDate) };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }
}
