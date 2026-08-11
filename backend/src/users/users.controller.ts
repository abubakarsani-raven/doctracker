import { Controller, Get, Post, Put, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import { CreateUserDto, InviteUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequireCapability('users.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findAll(@Request() req: any) {
    return this.usersService.findAll(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Request() req: any) {
    const user = await this.usersService.findOne(req.user.id);
    // Carry the resolved capabilities through, so the UI gates on the same
    // decision the API enforces rather than re-deriving it from the role name.
    return { ...user, permissions: req.user.permissions };
  }

  /**
   * Self-service profile update. Declared before `:id` so "me" is not captured
   * as an id, and guarded by authentication alone — editing your own name does
   * not require `users.manage`, which no ordinary user holds.
   */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateOwnProfile(
    @Request() req: any,
    @Body() updateOwnProfileDto: UpdateOwnProfileDto,
  ) {
    return this.usersService.updateOwnProfile(req.user.id, updateOwnProfileDto);
  }

  @Get(':id')
  @RequireCapability('users.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.usersService.findOne(id, req.user);
  }

  @Post('invite')
  @RequireCapability('users.manage')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async invite(@Body() inviteUserDto: InviteUserDto, @Request() req: any) {
    return this.usersService.invite(inviteUserDto, req.user);
  }

  @Post()
  @RequireCapability('users.manage')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async create(@Body() createUserDto: CreateUserDto, @Request() req: any) {
    return this.usersService.createUser(createUserDto, req.user);
  }

  @Patch(':id')
  @RequireCapability('users.manage')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req: any) {
    return this.usersService.updateUser(id, updateUserDto, req.user);
  }

  @Patch(':id/deactivate')
  @RequireCapability('users.manage')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async deactivate(@Param('id') id: string, @Request() req: any) {
    return this.usersService.deactivateUser(id, req.user);
  }
}
