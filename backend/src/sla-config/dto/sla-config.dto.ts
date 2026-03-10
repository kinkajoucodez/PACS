import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSlaConfigDto {
  @ApiProperty({ format: 'uuid', description: 'Healthcare provider ID' })
  @IsUUID()
  providerId: string;

  @ApiPropertyOptional({
    example: 'CT',
    description: 'Modality (null = applies to all modalities)',
  })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiProperty({
    enum: ['stat', 'urgent', 'routine', 'follow_up'],
    description: 'Study priority level',
  })
  @IsEnum(['stat', 'urgent', 'routine', 'follow_up'])
  priority: string;

  @ApiProperty({
    example: 24,
    description: 'Target turnaround time in hours',
  })
  @IsNumber()
  @Min(0.5)
  @Max(720)
  targetHours: number;

  @ApiPropertyOptional({
    example: 80,
    description:
      'Warning threshold as a percentage of target hours (1–99). A warning is sent when this fraction of the allowed time has elapsed.',
    default: 80,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  warningThresholdPercent?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSlaConfigDto {
  @ApiPropertyOptional({ example: 'CT' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(720)
  targetHours?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  warningThresholdPercent?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SlaConfigFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ example: 'CT' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ enum: ['stat', 'urgent', 'routine', 'follow_up'] })
  @IsOptional()
  @IsEnum(['stat', 'urgent', 'routine', 'follow_up'])
  priority?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
