import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ format: 'uuid', description: 'Study ID that is being disputed' })
  @IsUUID()
  studyId: string;

  @ApiProperty({ format: 'uuid', description: 'Report ID that is being disputed' })
  @IsUUID()
  reportId: string;

  @ApiPropertyOptional({ example: 'Findings do not match clinical presentation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResolveDisputeDto {
  @ApiProperty({
    enum: [
      'resolved_original_correct',
      'resolved_amended',
      'escalated',
      'closed',
    ],
    description: 'Resolution outcome',
  })
  @IsEnum([
    'resolved_original_correct',
    'resolved_amended',
    'escalated',
    'closed',
  ])
  status: string;

  @ApiPropertyOptional({ example: 'After review, the original findings are correct.' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'ID of the amended report (if resolution involves an amendment)',
  })
  @IsOptional()
  @IsUUID()
  amendedReportId?: string;
}

export class AssignDisputeReviewerDto {
  @ApiProperty({ format: 'uuid', description: 'User ID of the reviewer' })
  @IsUUID()
  reviewerId: string;
}

export class DisputeFilterDto {
  @ApiPropertyOptional({
    enum: [
      'open',
      'under_review',
      'resolved_original_correct',
      'resolved_amended',
      'escalated',
      'closed',
    ],
  })
  @IsOptional()
  @IsEnum([
    'open',
    'under_review',
    'resolved_original_correct',
    'resolved_amended',
    'escalated',
    'closed',
  ])
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reportId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  filedById?: string;
}
