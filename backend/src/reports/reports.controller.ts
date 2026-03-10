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
import { ReportsService } from './reports.service';
import {
  CreateReportDto,
  UpdateReportDto,
  FinalizeReportDto,
  CreateAddendumDto,
  ReportFilterDto,
  ReportResponseDto,
} from './dto';
import { PaginationDto } from '../common/dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all reports with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'List of reports',
    type: [ReportResponseDto],
  })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: ReportFilterDto,
  ) {
    return this.reportsService.findAll(paginationDto, filterDto);
  }

  @Get('my-reports')
  @UseGuards(RolesGuard)
  @Roles('radiologist')
  @ApiOperation({ summary: 'Get current radiologist reports' })
  @ApiResponse({
    status: 200,
    description: 'Radiologist reports',
    type: [ReportResponseDto],
  })
  getMyReports(
    @CurrentUser() user: any,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.reportsService.getMyReports(user.sub, paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Report details',
    type: ReportResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('radiologist')
  @ApiOperation({ summary: 'Create a new report' })
  @ApiResponse({
    status: 201,
    description: 'Report created',
    type: ReportResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Draft report already exists' })
  @ApiResponse({ status: 403, description: 'Not assigned to this study' })
  @ApiResponse({ status: 404, description: 'Study not found' })
  create(@Body() createReportDto: CreateReportDto, @CurrentUser() user: any) {
    return this.reportsService.create(createReportDto, user.sub);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('radiologist')
  @ApiOperation({ summary: 'Update a draft report' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Report updated',
    type: ReportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Only draft reports can be updated',
  })
  @ApiResponse({ status: 403, description: 'Can only update own reports' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReportDto: UpdateReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.update(id, updateReportDto, user.sub);
  }

  @Post(':id/finalize')
  @UseGuards(RolesGuard)
  @Roles('radiologist')
  @ApiOperation({ summary: 'Finalize a report' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Report finalized',
    type: ReportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Only draft reports can be finalized',
  })
  @ApiResponse({ status: 403, description: 'Can only finalize own reports' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() finalizeDto: FinalizeReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.finalize(id, finalizeDto, user.sub);
  }

  @Post(':id/addendum')
  @UseGuards(RolesGuard)
  @Roles('radiologist')
  @ApiOperation({ summary: 'Create an addendum for a report' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Addendum created',
    type: ReportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Addenda can only be added to finalized reports',
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  createAddendum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addendumDto: CreateAddendumDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.createAddendum(id, addendumDto, user.sub);
  }
}
