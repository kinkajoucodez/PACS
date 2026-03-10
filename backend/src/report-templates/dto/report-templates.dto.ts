import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsJSON,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateReportTemplateDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Healthcare provider ID (null = global template)' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiProperty({ example: 'Chest X-Ray Standard Report' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Standard template for chest radiograph reports' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'CR', description: 'DICOM modality code' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ example: 'CHEST', description: 'Body part examined' })
  @IsOptional()
  @IsString()
  bodyPart?: string;

  @ApiPropertyOptional({
    enum: ['HTML', 'PLAIN_TEXT', 'MARKDOWN'],
    default: 'HTML',
  })
  @IsOptional()
  @IsEnum(['HTML', 'PLAIN_TEXT', 'MARKDOWN'])
  templateFormat?: string;

  @ApiPropertyOptional({ example: '<h2>Findings</h2><p>{{findings}}</p>' })
  @IsOptional()
  @IsString()
  templateContent?: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'JSON map of placeholder keys and their descriptions',
    example: '{"findings": "Clinical findings", "impression": "Radiologist impression"}',
  })
  @IsOptional()
  @IsJSON()
  placeholders?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateReportTemplateDto {
  @ApiPropertyOptional({ example: 'Chest X-Ray Standard Report v2' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'CR' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ example: 'CHEST' })
  @IsOptional()
  @IsString()
  bodyPart?: string;

  @ApiPropertyOptional({ enum: ['HTML', 'PLAIN_TEXT', 'MARKDOWN'] })
  @IsOptional()
  @IsEnum(['HTML', 'PLAIN_TEXT', 'MARKDOWN'])
  templateFormat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsJSON()
  placeholders?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Increment version number', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ReportTemplateFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ example: 'CT' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ example: 'CHEST' })
  @IsOptional()
  @IsString()
  bodyPart?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
