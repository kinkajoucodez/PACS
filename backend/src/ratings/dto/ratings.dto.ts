import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ format: 'uuid', description: 'Study ID being rated' })
  @IsUUID()
  studyId: string;

  @ApiProperty({ format: 'uuid', description: 'Report ID being rated' })
  @IsUUID()
  reportId: string;

  @ApiProperty({ format: 'uuid', description: 'Radiologist user ID being rated' })
  @IsUUID()
  radiologistId: string;

  @ApiProperty({
    example: 4,
    description: 'Star rating from 1 (lowest) to 5 (highest)',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @ApiPropertyOptional({ example: 'Clear and accurate findings, timely turnaround.' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this rating is related to a dispute resolution',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDisputeRelated?: boolean;
}

export class RatingFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  radiologistId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ratedById?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  stars?: number;
}
