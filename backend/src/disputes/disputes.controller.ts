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
import { DisputesService } from './disputes.service';
import {
  CreateDisputeDto,
  ResolveDisputeDto,
  AssignDisputeReviewerDto,
  DisputeFilterDto,
} from './dto';
import { PaginationDto } from '../common/dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('Disputes')
@Controller('disputes')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'support', 'auditor', 'provider_manager')
  @ApiOperation({
    summary: 'List disputes',
    description: 'Returns disputes. Filterable by status, study, report, and filer.',
  })
  @ApiResponse({ status: 200, description: 'Paginated dispute list' })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: DisputeFilterDto,
  ) {
    return this.disputesService.findAll(paginationDto, filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dispute by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Dispute details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.disputesService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'File a dispute on a finalized report',
    description:
      'Any authenticated user can file a dispute. The study status is updated to "disputed" and the radiologist is notified.',
  })
  @ApiResponse({ status: 201, description: 'Dispute filed' })
  @ApiResponse({
    status: 400,
    description: 'Report not finalized, or active dispute already exists',
  })
  create(
    @Body() dto: CreateDisputeDto,
    @CurrentUser() user: any,
  ) {
    return this.disputesService.create(dto, user.sub);
  }

  @Patch(':id/assign-reviewer')
  @UseGuards(RolesGuard)
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'Assign a reviewer to a dispute (admin or support only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Reviewer assigned; dispute moved to under_review' })
  @ApiResponse({ status: 400, description: 'Invalid reviewer role or dispute not in assignable state' })
  @ApiResponse({ status: 404, description: 'Dispute or reviewer not found' })
  assignReviewer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDisputeReviewerDto,
    @CurrentUser() user: any,
  ) {
    return this.disputesService.assignReviewer(id, dto, user.sub);
  }

  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'support', 'auditor')
  @ApiOperation({ summary: 'Resolve a dispute (admin, support, or auditor only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Dispute resolved; filer notified' })
  @ApiResponse({ status: 400, description: 'Dispute already resolved' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: any,
  ) {
    return this.disputesService.resolve(id, dto, user.sub);
  }
}
