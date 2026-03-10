import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto, UpdateProviderDto, ProviderFilterDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    paginationDto: PaginationDto,
    filterDto: ProviderFilterDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { page, limit, skip } = paginationDto;
    const { search, isActive, state, country } = filterDto;

    const where: any = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (state) {
      where.state = { contains: state, mode: 'insensitive' };
    }

    if (country) {
      where.country = { contains: country, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [providers, total] = await Promise.all([
      this.prisma.healthcareProvider.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.healthcareProvider.count({ where }),
    ]);

    return {
      data: providers,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const provider = await this.prisma.healthcareProvider.findUnique({
      where: { id },
      include: {
        studies: {
          take: 10,
          orderBy: { receivedAt: 'desc' },
        },
        slaConfigurations: true,
        _count: {
          select: {
            studies: true,
            invoices: true,
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    return provider;
  }

  async findByCode(code: string) {
    return this.prisma.healthcareProvider.findUnique({
      where: { code },
    });
  }

  async create(createProviderDto: CreateProviderDto) {
    const existingProvider = await this.findByCode(createProviderDto.code);

    if (existingProvider) {
      throw new ConflictException(
        `Provider with code ${createProviderDto.code} already exists`,
      );
    }

    return this.prisma.healthcareProvider.create({
      data: createProviderDto,
    });
  }

  async update(id: string, updateProviderDto: UpdateProviderDto) {
    await this.findOne(id);

    return this.prisma.healthcareProvider.update({
      where: { id },
      data: updateProviderDto,
    });
  }

  async getProviderStudies(id: string, paginationDto: PaginationDto) {
    await this.findOne(id);

    const { page, limit, skip } = paginationDto;

    const [studies, total] = await Promise.all([
      this.prisma.study.findMany({
        where: { providerId: id },
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        include: {
          assignments: {
            include: {
              radiologist: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          slaTracking: true,
        },
      }),
      this.prisma.study.count({ where: { providerId: id } }),
    ]);

    return {
      data: studies,
      meta: {
        total,
        page: page ?? 1,
        limit: limit ?? 20,
        totalPages: Math.ceil(total / (limit ?? 20)),
      },
    };
  }
}
