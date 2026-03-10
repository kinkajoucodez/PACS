import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  CreateRadiologistProfileDto,
  UserFilterDto,
} from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    paginationDto: PaginationDto,
    filterDto: UserFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const { role, status, search } = filterDto;

    const where: any = {};

    if (role) {
      where.role = role as UserRole;
    }

    if (status) {
      where.status = status as UserStatus;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          radiologistProfile: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        radiologistProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        radiologistProfile: true,
      },
    });
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email ${createUserDto.email} already exists`,
      );
    }

    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role as UserRole,
        phone: createUserDto.phone,
        status: 'pending_verification',
      },
      include: {
        radiologistProfile: true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      include: {
        radiologistProfile: true,
      },
    });
  }

  async updateStatus(id: string, updateStatusDto: UpdateUserStatusDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        status: updateStatusDto.status as UserStatus,
      },
      include: {
        radiologistProfile: true,
      },
    });
  }

  async createRadiologistProfile(
    userId: string,
    createProfileDto: CreateRadiologistProfileDto,
  ) {
    const user = await this.findOne(userId);

    if (user.role !== 'radiologist') {
      throw new ConflictException(
        'User must have radiologist role to create a profile',
      );
    }

    if (user.radiologistProfile) {
      throw new ConflictException('User already has a radiologist profile');
    }

    return this.prisma.radiologistProfile.create({
      data: {
        userId,
        licenseNumber: createProfileDto.licenseNumber,
        licenseExpiry: createProfileDto.licenseExpiry
          ? new Date(createProfileDto.licenseExpiry)
          : undefined,
        specializations: createProfileDto.specializations || [],
        yearsOfExperience: createProfileDto.yearsOfExperience,
        documentsUrl: createProfileDto.documentsUrl,
        notes: createProfileDto.notes,
        verificationStatus: 'pending',
      },
      include: {
        user: true,
      },
    });
  }

  async getRadiologists() {
    return this.prisma.user.findMany({
      where: {
        role: 'radiologist',
        status: 'active',
      },
      include: {
        radiologistProfile: true,
      },
      orderBy: {
        lastName: 'asc',
      },
    });
  }
}
