import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({
    enum: [
      'admin',
      'radiologist',
      'provider_manager',
      'billing_officer',
      'support',
      'auditor',
    ],
    example: 'radiologist',
  })
  @IsEnum([
    'admin',
    'radiologist',
    'provider_manager',
    'billing_officer',
    'support',
    'auditor',
  ])
  role:
    | 'admin'
    | 'radiologist'
    | 'provider_manager'
    | 'billing_officer'
    | 'support'
    | 'auditor';

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: ['active', 'inactive', 'suspended', 'pending_verification'],
    example: 'active',
  })
  @IsEnum(['active', 'inactive', 'suspended', 'pending_verification'])
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
}

export class CreateRadiologistProfileDto {
  @ApiPropertyOptional({ example: 'RAD-12345' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @ApiPropertyOptional({
    example: ['CT', 'MRI', 'X-Ray'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ example: 'https://docs.example.com/credentials' })
  @IsOptional()
  @IsString()
  documentsUrl?: string;

  @ApiPropertyOptional({ example: 'Additional notes about the radiologist' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UserFilterDto {
  @ApiPropertyOptional({
    enum: [
      'admin',
      'radiologist',
      'provider_manager',
      'billing_officer',
      'support',
      'auditor',
    ],
  })
  @IsOptional()
  @IsEnum([
    'admin',
    'radiologist',
    'provider_manager',
    'billing_officer',
    'support',
    'auditor',
  ])
  role?: string;

  @ApiPropertyOptional({
    enum: ['active', 'inactive', 'suspended', 'pending_verification'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended', 'pending_verification'])
  status?: string;

  @ApiPropertyOptional({ example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
