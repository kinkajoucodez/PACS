import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProvidersService } from './providers.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  ProviderFilterDto,
  ProviderResponseDto,
} from './dto';
import { PaginationDto } from '../common/dto';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('Providers')
@Controller('providers')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all healthcare providers with pagination and filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of providers',
    type: [ProviderResponseDto],
  })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: ProviderFilterDto,
  ) {
    return this.providersService.findAll(paginationDto, filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get provider by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Provider details',
    type: ProviderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.providersService.findOne(id);
  }

  @Get(':id/studies')
  @ApiOperation({ summary: 'Get studies from a provider' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'List of studies from provider',
  })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  getProviderStudies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.providersService.getProviderStudies(id, paginationDto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new healthcare provider' })
  @ApiResponse({
    status: 201,
    description: 'Provider created successfully',
    type: ProviderResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Provider with code already exists',
  })
  create(@Body() createProviderDto: CreateProviderDto) {
    return this.providersService.create(createProviderDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'provider_manager')
  @ApiOperation({ summary: 'Update provider details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Provider updated successfully',
    type: ProviderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProviderDto: UpdateProviderDto,
  ) {
    return this.providersService.update(id, updateProviderDto);
  }
}
