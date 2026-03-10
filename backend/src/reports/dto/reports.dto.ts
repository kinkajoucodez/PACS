import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studyId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    example: 'No acute findings. Normal chest radiograph.',
  })
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiPropertyOptional({ example: 'Normal chest radiograph' })
  @IsOptional()
  @IsString()
  impression?: string;

  @ApiPropertyOptional({ example: 'No follow-up needed' })
  @IsOptional()
  @IsString()
  conclusion?: string;

  @ApiPropertyOptional({ example: '<html>...</html>' })
  @IsOptional()
  @IsString()
  reportBody?: string;
}

export class UpdateReportDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ example: 'Updated findings...' })
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiPropertyOptional({ example: 'Updated impression...' })
  @IsOptional()
  @IsString()
  impression?: string;

  @ApiPropertyOptional({ example: 'Updated conclusion...' })
  @IsOptional()
  @IsString()
  conclusion?: string;

  @ApiPropertyOptional({ example: '<html>...</html>' })
  @IsOptional()
  @IsString()
  reportBody?: string;
}

export class FinalizeReportDto {
  @ApiPropertyOptional({
    enum: ['preliminary', 'final'],
    default: 'final',
  })
  @IsOptional()
  @IsEnum(['preliminary', 'final'])
  finalizeAs?: 'preliminary' | 'final';
}

export class CreateAddendumDto {
  @ApiProperty({ example: 'Additional findings after further review...' })
  @IsString()
  findings: string;

  @ApiPropertyOptional({ example: 'Updated impression with addendum' })
  @IsOptional()
  @IsString()
  impression?: string;

  @ApiPropertyOptional({ example: 'Updated conclusion with addendum' })
  @IsOptional()
  @IsString()
  conclusion?: string;
}

export class ReportFilterDto {
  @ApiPropertyOptional({
    enum: ['draft', 'preliminary', 'final', 'amended', 'cancelled'],
  })
  @IsOptional()
  @IsEnum(['draft', 'preliminary', 'final', 'amended', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  radiologistId?: string;
}

export class ReportResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studyId: string;

  @ApiProperty()
  radiologistId: string;

  @ApiPropertyOptional()
  templateId?: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  findings?: string;

  @ApiPropertyOptional()
  impression?: string;

  @ApiPropertyOptional()
  conclusion?: string;

  @ApiPropertyOptional()
  reportBody?: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  isAddendum: boolean;

  @ApiPropertyOptional()
  finalizedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
