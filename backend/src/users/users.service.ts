import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        company: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
    
    // Transform user to include role from userRoles
    if (user) {
      return {
        ...user,
        role: user.userRoles[0]?.role?.name || 'Staff',
      };
    }
    return user;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        company: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
    
    // Transform user to include role from userRoles
    if (user) {
      return {
        ...user,
        role: user.userRoles[0]?.role?.name || 'Staff',
      };
    }
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        company: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async create(data: { email: string; password: string; name?: string; companyId?: string }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        companyId: data.companyId,
      },
    });
  }
}
