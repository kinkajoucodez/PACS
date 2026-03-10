import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateBillingRecordDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studyId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  providerId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  radiologistId?: string;

  @ApiPropertyOptional({ example: 'CT' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ enum: ['stat', 'urgent', 'routine', 'follow_up'] })
  @IsOptional()
  @IsEnum(['stat', 'urgent', 'routine', 'follow_up'])
  priority?: string;

  @ApiProperty({ example: 100.0 })
  @IsNumber()
  @Min(0)
  baseAmount: number;

  @ApiPropertyOptional({ example: 25.0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  statSurcharge?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class BillingRecordFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  radiologistId?: string;

  @ApiPropertyOptional({
    enum: ['pending', 'billable', 'invoiced', 'paid', 'waived'],
  })
  @IsOptional()
  @IsEnum(['pending', 'billable', 'invoiced', 'paid', 'waived'])
  status?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  providerId: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  billingPeriodStart: string;

  @ApiProperty({ example: '2024-01-31' })
  @IsDateString()
  billingPeriodEnd: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] })
  @IsEnum(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
  status: string;

  @ApiPropertyOptional({ example: 'INV-2024-REF-001' })
  @IsOptional()
  @IsString()
  paymentReference?: string;
}

export class InvoiceFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
  status?: string;
}
