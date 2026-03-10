import { Controller, Post, Body, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { StudiesService } from './studies.service';
import { OrthancWebhookDto } from './dto';

/**
 * Handles incoming webhook notifications from Orthanc.
 *
 * This controller intentionally has NO JWT authentication guard because it is
 * called by the Orthanc server (inside the Docker network) using the
 * OnStableStudy Lua callback, not by end-users.
 *
 * In production, consider securing this endpoint with an IP allowlist,
 * a shared secret header, or mTLS at the network layer.
 */
@ApiTags('Studies')
@Controller('studies')
export class StudiesWebhookController {
  constructor(private readonly studiesService: StudiesService) {}

  /**
   * POST /api/studies/webhook
   *
   * Called by Orthanc when a study becomes stable (all instances received).
   * Fetches full DICOM metadata from Orthanc, checks for duplicates, and
   * creates a Study record in the platform database along with an initial
   * SlaTracking entry when an applicable SLA configuration exists.
   *
   * Returns 201 when a new study is created, 200 when the study already
   * exists in the database (idempotent).
   */
  @Post('webhook')
  @ApiOperation({
    summary: 'Orthanc stable-study webhook',
    description:
      'Receives an Orthanc OnStableStudy notification, queries Orthanc for ' +
      'full study metadata, and syncs the study into the platform database.',
  })
  @ApiResponse({ status: 201, description: 'Study created successfully' })
  @ApiResponse({ status: 200, description: 'Study already exists (no-op)' })
  @ApiResponse({ status: 503, description: 'Orthanc server is unreachable' })
  async handleWebhook(
    @Body() dto: OrthancWebhookDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.studiesService.handleOrthancWebhook(dto);
    if (result.status === 'already_exists') {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }
    return result;
  }
}
