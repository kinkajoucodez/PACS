import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { AuditLogFilterDto } from './dto';
import { PaginationDto } from '../common/dto';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'auditor')
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'List audit logs (admin or auditor only)',
    description: 'Returns a paginated, filterable list of audit log entries.',
  })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: AuditLogFilterDto,
  ) {
    return this.auditService.findAll(paginationDto, filterDto);
  }
}
