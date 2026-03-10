import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BillingRecordFilterDto,
  CreateInvoiceDto,
  UpdateInvoiceStatusDto,
  InvoiceFilterDto,
} from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { BillingStatus, InvoiceStatus, StudyPriority } from '@prisma/client';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────────────────
  // Billing Records
  // ────────────────────────────────────────────────────────────────────────────

  async findAllBillingRecords(
    paginationDto: PaginationDto,
    filterDto: BillingRecordFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const where: any = {};

    if (filterDto.providerId) where.providerId = filterDto.providerId;
    if (filterDto.radiologistId) where.radiologistId = filterDto.radiologistId;
    if (filterDto.status) where.status = filterDto.status as BillingStatus;
    if (filterDto.fromDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(filterDto.fromDate) };
    }
    if (filterDto.toDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(filterDto.toDate) };
    }

    const [records, total] = await Promise.all([
      this.prisma.billingRecord.findMany({
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
          provider: { select: { id: true, name: true, code: true } },
          radiologist: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.billingRecord.count({ where }),
    ]);

    return {
      data: records,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOneBillingRecord(id: string) {
    const record = await this.prisma.billingRecord.findUnique({
      where: { id },
      include: {
        study: true,
        provider: true,
        radiologist: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        invoice: true,
        invoiceItems: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Billing record with ID ${id} not found`);
    }

    return record;
  }

  /**
   * Auto-creates a billing record when a study report is finalized.
   * Called internally from ReportsService. Skips silently if a record already exists.
   */
  async createBillingRecordForStudy(
    studyId: string,
    providerId: string,
    radiologistId: string | null,
    modality: string | null,
    priority: StudyPriority,
  ): Promise<void> {
    // Idempotency: skip if a billing record already exists for this study.
    const existing = await this.prisma.billingRecord.findUnique({
      where: { studyId },
    });
    if (existing) return;

    // Simple price matrix based on modality and priority.
    // In production these should come from a configurable price table per provider.
    const baseAmount = this.calculateBaseAmount(modality, priority);
    const statSurcharge = priority === StudyPriority.stat ? baseAmount * 0.25 : 0;

    try {
      await this.prisma.billingRecord.create({
        data: {
          studyId,
          providerId,
          radiologistId,
          modality,
          priority,
          baseAmount,
          statSurcharge,
          totalAmount: baseAmount + statSurcharge,
          status: 'billable',
        },
      });

      this.logger.log(`Billing record created for study ${studyId}`);
    } catch (err) {
      this.logger.error(
        `Failed to create billing record for study ${studyId}: ${(err as Error).message}`,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Invoices
  // ────────────────────────────────────────────────────────────────────────────

  async findAllInvoices(
    paginationDto: PaginationDto,
    filterDto: InvoiceFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const where: any = {};

    if (filterDto.providerId) where.providerId = filterDto.providerId;
    if (filterDto.status) where.status = filterDto.status as InvoiceStatus;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          provider: { select: { id: true, name: true, code: true } },
          _count: { select: { billingRecords: true, invoiceItems: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOneInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        provider: true,
        billingRecords: {
          include: {
            study: {
              select: {
                id: true,
                orthancStudyId: true,
                modality: true,
                studyDescription: true,
              },
            },
          },
        },
        invoiceItems: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async generateInvoice(dto: CreateInvoiceDto) {
    const start = new Date(dto.billingPeriodStart);
    const end = new Date(dto.billingPeriodEnd);

    if (start > end) {
      throw new BadRequestException(
        'billingPeriodStart must be before billingPeriodEnd',
      );
    }

    // Collect all billable records for this provider within the period.
    const records = await this.prisma.billingRecord.findMany({
      where: {
        providerId: dto.providerId,
        status: 'billable',
        createdAt: { gte: start, lte: end },
      },
      include: {
        study: {
          select: {
            id: true,
            orthancStudyId: true,
            modality: true,
            studyDescription: true,
          },
        },
      },
    });

    if (records.length === 0) {
      throw new BadRequestException(
        'No billable records found for this provider in the specified period',
      );
    }

    const subtotal = records.reduce(
      (sum, r) => sum + Number(r.totalAmount),
      0,
    );
    const taxAmount = dto.taxAmount ?? 0;
    const totalAmount = subtotal + taxAmount;
    const currency = dto.currency ?? 'USD';

    const invoiceNumber = this.generateInvoiceNumber(dto.providerId, start);

    const invoice = await this.prisma.$transaction(async (tx) => {
      // Create invoice
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          providerId: dto.providerId,
          billingPeriodStart: start,
          billingPeriodEnd: end,
          subtotal,
          taxAmount,
          totalAmount,
          currency,
          status: 'draft',
          issuedAt: new Date(),
          dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      // Create invoice items from billing records
      const items = records.map((r) => ({
        invoiceId: newInvoice.id,
        billingRecordId: r.id,
        description: `${r.modality ?? 'Study'} report — ${r.study?.studyDescription ?? r.study?.orthancStudyId ?? r.studyId}`,
        quantity: 1,
        unitPrice: Number(r.totalAmount),
        totalPrice: Number(r.totalAmount),
      }));

      await tx.invoiceItem.createMany({ data: items });

      // Mark billing records as invoiced
      await tx.billingRecord.updateMany({
        where: { id: { in: records.map((r) => r.id) } },
        data: { status: 'invoiced', invoiceId: newInvoice.id },
      });

      return newInvoice;
    });

    return this.findOneInvoice(invoice.id);
  }

  async updateInvoiceStatus(id: string, dto: UpdateInvoiceStatusDto) {
    const invoice = await this.findOneInvoice(id);

    const updates: any = { status: dto.status as InvoiceStatus };

    if (dto.status === 'paid') {
      updates.paidAt = new Date();
      if (dto.paymentReference) updates.paymentReference = dto.paymentReference;

      // Mark all associated billing records as paid
      await this.prisma.billingRecord.updateMany({
        where: { invoiceId: id },
        data: { status: 'paid' },
      });
    }

    if (dto.status === 'sent' && !invoice.issuedAt) {
      updates.issuedAt = new Date();
    }

    return this.prisma.invoice.update({ where: { id }, data: updates });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────────────

  private calculateBaseAmount(
    modality: string | null,
    priority: StudyPriority,
  ): number {
    // Base rates by modality (USD)
    const baseRates: Record<string, number> = {
      CT: 150,
      MRI: 200,
      CR: 50,
      DX: 50,
      US: 80,
      NM: 180,
      MG: 90,
      PT: 220,
      XA: 130,
      RF: 120,
    };

    const base = modality ? (baseRates[modality.toUpperCase()] ?? 100) : 100;

    // Priority multipliers
    const multipliers: Record<string, number> = {
      stat: 1.5,
      urgent: 1.2,
      routine: 1.0,
      follow_up: 0.9,
    };

    return Math.round(base * (multipliers[priority] ?? 1.0) * 100) / 100;
  }

  private generateInvoiceNumber(
    providerId: string,
    periodStart: Date,
  ): string {
    const year = periodStart.getFullYear();
    const month = String(periodStart.getMonth() + 1).padStart(2, '0');
    const suffix = providerId.slice(-4).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${year}${month}-${suffix}-${timestamp}`;
  }
}
