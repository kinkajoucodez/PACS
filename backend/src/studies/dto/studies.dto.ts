import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
} from 'class-validator';

export class StudyFilterDto {
  @ApiPropertyOptional({
    enum: [
      'received',
      'queued',
      'assigned',
      'in_progress',
      'reported',
      'verified',
      'disputed',
      'amended',
    ],
  })
  @IsOptional()
  @IsEnum([
    'received',
    'queued',
    'assigned',
    'in_progress',
    'reported',
    'verified',
    'disputed',
    'amended',
  ])
  status?: string;

  @ApiPropertyOptional({
    enum: ['stat', 'urgent', 'routine', 'follow_up'],
  })
  @IsOptional()
  @IsEnum(['stat', 'urgent', 'routine', 'follow_up'])
  priority?: string;

  @ApiPropertyOptional({ example: 'CT' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  radiologistId?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: 'patient' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class AssignStudyDto {
  @ApiProperty({ format: 'uuid', description: 'Radiologist user ID' })
  @IsUUID()
  radiologistId: string;
}

export class ReleaseAssignmentDto {
  @ApiPropertyOptional({ example: 'Conflict of interest' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class FlagStatDto {
  @ApiPropertyOptional({ example: 'Critical finding suspected' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateStudyDto {
  @ApiProperty({ example: 'orthanc-study-id-12345' })
  @IsString()
  orthancStudyId: string;

  @ApiProperty({ example: '1.2.840.113619.2.123456' })
  @IsString()
  studyInstanceUid: string;

  @ApiPropertyOptional({ example: 'PAT001' })
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional({ example: 'hashed_patient_name' })
  @IsOptional()
  @IsString()
  patientNameHash?: string;

  @ApiPropertyOptional({ example: 'CT' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ example: 'CT Chest with Contrast' })
  @IsOptional()
  @IsString()
  studyDescription?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  studyDate?: string;

  @ApiPropertyOptional({ example: 'Dr. Smith' })
  @IsOptional()
  @IsString()
  referringPhysician?: string;

  @ApiPropertyOptional({ example: 'CHEST' })
  @IsOptional()
  @IsString()
  bodyPart?: string;

  @ApiPropertyOptional({
    enum: ['stat', 'urgent', 'routine', 'follow_up'],
    default: 'routine',
  })
  @IsOptional()
  @IsEnum(['stat', 'urgent', 'routine', 'follow_up'])
  priority?: 'stat' | 'urgent' | 'routine' | 'follow_up';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  providerId?: string;
}

export class StudyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orthancStudyId: string;

  @ApiProperty()
  studyInstanceUid: string;

  @ApiPropertyOptional()
  patientId?: string;

  @ApiPropertyOptional()
  modality?: string;

  @ApiPropertyOptional()
  studyDescription?: string;

  @ApiPropertyOptional()
  studyDate?: Date;

  @ApiPropertyOptional()
  referringPhysician?: string;

  @ApiPropertyOptional()
  bodyPart?: string;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  receivedAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Payload sent by Orthanc's OnStableStudy Lua callback to the webhook endpoint.
 */
export class OrthancWebhookDto {
  @ApiProperty({
    example: 'f7dcc45e-3a6b2c1d-...',
    description: 'Orthanc internal study UUID',
  })
  @IsString()
  orthancStudyId: string;
}
