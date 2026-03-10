import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SlaConfigService } from './sla-config.service';
import {
  CreateSlaConfigDto,
  UpdateSlaConfigDto,
  SlaConfigFilterDto,
} from './dto';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('SLA Configuration')
@Controller('sla-config')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class SlaConfigController {
  constructor(private readonly slaConfigService: SlaConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'List SLA configurations',
    description:
      'Returns SLA configurations. Filterable by provider, modality, priority, and active status.',
  })
  @ApiResponse({ status: 200, description: 'SLA configuration list' })
  findAll(@Query() filterDto: SlaConfigFilterDto) {
    return this.slaConfigService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get SLA configuration by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'SLA configuration details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.slaConfigService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create an SLA configuration (admin only)' })
  @ApiResponse({ status: 201, description: 'SLA configuration created' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate provider/modality/priority combination',
  })
  create(@Body() dto: CreateSlaConfigDto) {
    return this.slaConfigService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update an SLA configuration (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'SLA configuration updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSlaConfigDto,
  ) {
    return this.slaConfigService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an SLA configuration (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'SLA configuration deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.slaConfigService.remove(id);
  }
}
