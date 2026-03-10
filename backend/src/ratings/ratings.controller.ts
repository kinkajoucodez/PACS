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
import { RatingsService } from './ratings.service';
import { CreateRatingDto, RatingFilterDto } from './dto';
import { PaginationDto } from '../common/dto';
import { CurrentUser } from '../common/decorators';

@ApiTags('Ratings')
@Controller('ratings')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get()
  @ApiOperation({
    summary: 'List ratings',
    description: 'Returns ratings. Filterable by radiologist, study, rater, and star count.',
  })
  @ApiResponse({ status: 200, description: 'Paginated ratings' })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: RatingFilterDto,
  ) {
    return this.ratingsService.findAll(paginationDto, filterDto);
  }

  @Get('radiologist/:radiologistId/stats')
  @ApiOperation({
    summary: 'Get rating statistics for a radiologist',
    description: 'Returns average rating, total count, and per-star breakdown.',
  })
  @ApiParam({ name: 'radiologistId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Radiologist rating stats' })
  @ApiResponse({ status: 404, description: 'Radiologist profile not found' })
  getRadiologistStats(
    @Param('radiologistId', ParseUUIDPipe) radiologistId: string,
  ) {
    return this.ratingsService.getRadiologistStats(radiologistId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rating by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Rating details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ratingsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Rate a radiologist for a completed study',
    description:
      'Any authenticated user can submit one rating per study. The radiologist average rating is updated automatically.',
  })
  @ApiResponse({ status: 201, description: 'Rating submitted' })
  @ApiResponse({ status: 400, description: 'Report not finalized or report/study mismatch' })
  @ApiResponse({
    status: 409,
    description: 'You have already rated this study',
  })
  create(@Body() dto: CreateRatingDto, @CurrentUser() user: any) {
    return this.ratingsService.create(dto, user.sub);
  }
}
