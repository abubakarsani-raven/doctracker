import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from './require-capability.decorator';

@Controller('roles')
export class RolesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @RequireCapability('users.manage')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        canAssignDocuments: true,
        permissionsJson: true,
      },
    });
  }
}
