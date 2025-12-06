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
        userDepartments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    // Transform user to include role from userRoles and department names
    if (user) {
      const departmentNames = user.userDepartments.map((ud: any) => ud.department.name);
      return {
        ...user,
        role: user.userRoles[0]?.role?.name || 'Staff',
        department: departmentNames[0] || null, // For backward compatibility
        departments: departmentNames, // Array of all departments
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
        userDepartments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    // Transform user to include role from userRoles and department names
    if (user) {
      const departmentNames = user.userDepartments.map((ud: any) => ud.department.name);
      return {
        ...user,
        role: user.userRoles[0]?.role?.name || 'Staff',
        department: departmentNames[0] || null, // For backward compatibility
        departments: departmentNames, // Array of all departments
      };
    }
    return user;
  }

  async findAll(currentUser?: any) {
    const where: any = {};
    
    // Non-Master users only see users from their company
    if (currentUser && currentUser.role !== 'Master') {
      if (currentUser.companyId) {
        where.companyId = currentUser.companyId;
      }
    }
    
    return this.prisma.user.findMany({
      where,
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
