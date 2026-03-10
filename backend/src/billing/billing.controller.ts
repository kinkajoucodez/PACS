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
import { BillingService } from './billing.service';
import {
  BillingRecordFilterDto,
  CreateInvoiceDto,
  UpdateInvoiceStatusDto,
  InvoiceFilterDto,
} from './dto';
import { PaginationDto } from '../common/dto';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('Billing')
@Controller('billing')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ── Billing Records ──────────────────────────────────────────────────────

  @Get('records')
  @UseGuards(RolesGuard)
  @Roles('admin', 'billing_officer')
  @ApiOperation({ summary: 'List billing records (admin or billing_officer only)' })
  @ApiResponse({ status: 200, description: 'Paginated billing records' })
  findAllRecords(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: BillingRecordFilterDto,
  ) {
    return this.billingService.findAllBillingRecords(paginationDto, filterDto);
  }

  @Get('records/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'billing_officer')
  @ApiOperation({ summary: 'Get billing record by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Billing record details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOneRecord(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findOneBillingRecord(id);
  }

  // ── Invoices ─────────────────────────────────────────────────────────────

  @Get('invoices')
  @UseGuards(RolesGuard)
  @Roles('admin', 'billing_officer')
  @ApiOperation({ summary: 'List invoices (admin or billing_officer only)' })
  @ApiResponse({ status: 200, description: 'Paginated invoices' })
  findAllInvoices(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: InvoiceFilterDto,
  ) {
    return this.billingService.findAllInvoices(paginationDto, filterDto);
  }

  @Get('invoices/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'billing_officer')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Invoice details with line items' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOneInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findOneInvoice(id);
  }

  @Post('invoices/generate')
  @UseGuards(RolesGuard)
  @Roles('admin', 'billing_officer')
  @ApiOperation({
    summary: 'Generate an invoice for a provider over a billing period',
    description:
      'Collects all billable records for the provider within the period, creates an invoice and line items, and marks records as invoiced.',
  })
  @ApiResponse({ status: 201, description: 'Invoice generated' })
  @ApiResponse({
    status: 400,
    description: 'No billable records found or invalid date range',
  })
  generateInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.generateInvoice(dto);
  }

  @Patch('invoices/:id/status')
  @UseGuards(RolesGuard)
  @Roles('admin', 'billing_officer')
  @ApiOperation({ summary: 'Update invoice status (e.g., mark as sent or paid)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Invoice status updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateInvoiceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    return this.billingService.updateInvoiceStatus(id, dto);
  }
}
