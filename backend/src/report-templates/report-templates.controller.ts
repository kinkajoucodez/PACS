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
import { ReportTemplatesService } from './report-templates.service';
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  ReportTemplateFilterDto,
} from './dto';
import { PaginationDto } from '../common/dto';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('Report Templates')
@Controller('report-templates')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ReportTemplatesController {
  constructor(
    private readonly reportTemplatesService: ReportTemplatesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List report templates',
    description: 'Returns all report templates. Filterable by provider, modality, body part, and active status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of report templates' })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: ReportTemplateFilterDto,
  ) {
    return this.reportTemplatesService.findAll(paginationDto, filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report template by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Report template details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportTemplatesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'provider_manager')
  @ApiOperation({ summary: 'Create a report template (admin or provider_manager only)' })
  @ApiResponse({ status: 201, description: 'Report template created' })
  create(@Body() dto: CreateReportTemplateDto) {
    return this.reportTemplatesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'provider_manager')
  @ApiOperation({ summary: 'Update a report template (admin or provider_manager only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Report template updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportTemplateDto,
  ) {
    return this.reportTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a report template (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Report template deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportTemplatesService.remove(id);
  }
}
