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
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  CreateRadiologistProfileDto,
  UserFilterDto,
  UserResponseDto,
} from './dto';
import { PaginationDto } from '../common/dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [UserResponseDto],
  })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: UserFilterDto,
  ) {
    return this.usersService.findAll(paginationDto, filterDto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserResponseDto,
  })
  getCurrentUser(@CurrentUser() user: any) {
    return this.usersService.findByEmail(user.email);
  }

  @Get('radiologists')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of active radiologists' })
  @ApiResponse({
    status: 200,
    description: 'List of radiologists',
    type: [UserResponseDto],
  })
  getRadiologists() {
    return this.usersService.getRadiologists();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 409, description: 'User with email already exists' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user status' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'User status updated',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(id, updateStatusDto);
  }

  @Post('radiologist-profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create radiologist profile for current user' })
  @ApiResponse({
    status: 201,
    description: 'Radiologist profile created',
  })
  @ApiResponse({
    status: 409,
    description: 'User already has a profile or is not a radiologist',
  })
  createRadiologistProfile(
    @CurrentUser() user: any,
    @Body() createProfileDto: CreateRadiologistProfileDto,
  ) {
    return this.usersService.createRadiologistProfile(
      user.sub,
      createProfileDto,
    );
  }
}
