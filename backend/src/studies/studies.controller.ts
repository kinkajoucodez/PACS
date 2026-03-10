import {
  Controller,
  Get,
  Post,
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
import { StudiesService } from './studies.service';
import {
  StudyFilterDto,
  AssignStudyDto,
  ReleaseAssignmentDto,
  FlagStatDto,
  CreateStudyDto,
  StudyResponseDto,
} from './dto';
import { PaginationDto } from '../common/dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('Studies')
@Controller('studies')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class StudiesController {
  constructor(private readonly studiesService: StudiesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all studies with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'List of studies',
    type: [StudyResponseDto],
  })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: StudyFilterDto,
  ) {
    return this.studiesService.findAll(paginationDto, filterDto);
  }

  @Get('worklist')
  @UseGuards(RolesGuard)
  @Roles('radiologist')
  @ApiOperation({ summary: 'Get current radiologist worklist' })
  @ApiResponse({
    status: 200,
    description: 'Radiologist worklist',
    type: [StudyResponseDto],
  })
  getMyWorklist(
    @CurrentUser() user: any,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.studiesService.getMyWorklist(user.sub, paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get study by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Study details',
    type: StudyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Study not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studiesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'Create a new study (webhook handler)' })
  @ApiResponse({
    status: 201,
    description: 'Study created',
    type: StudyResponseDto,
  })
  create(@Body() createStudyDto: CreateStudyDto) {
    return this.studiesService.create(createStudyDto);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'Assign study to a radiologist' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Study assigned',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot assign study in current status',
  })
  @ApiResponse({ status: 404, description: 'Study not found' })
  assignStudy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignStudyDto: AssignStudyDto,
    @CurrentUser() user: any,
  ) {
    return this.studiesService.assignStudy(id, assignStudyDto, user.sub);
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Release study assignment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Assignment released',
  })
  @ApiResponse({ status: 400, description: 'No active assignment found' })
  @ApiResponse({ status: 404, description: 'Study not found' })
  releaseAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() releaseDto: ReleaseAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.studiesService.releaseAssignment(id, releaseDto, user.sub);
  }

  @Post(':id/flag-stat')
  @UseGuards(RolesGuard)
  @Roles('admin', 'support', 'provider_manager')
  @ApiOperation({ summary: 'Flag study as STAT priority' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Study flagged as STAT',
  })
  @ApiResponse({ status: 400, description: 'Study already flagged as STAT' })
  @ApiResponse({ status: 404, description: 'Study not found' })
  flagStat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() flagStatDto: FlagStatDto,
    @CurrentUser() user: any,
  ) {
    return this.studiesService.flagStat(id, flagStatDto, user.sub);
  }
}
