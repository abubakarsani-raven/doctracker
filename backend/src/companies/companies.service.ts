import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser?: any) {
    const where: any = {};
    
    // Only an instance-wide scope sees other companies.
    if (currentUser && currentUser.permissions?.dataScope !== 'all') {
      if (currentUser.companyId) {
        where.id = currentUser.companyId;
      } else {
        // User has no company, return empty
        return [];
      }
    }
    
    return this.prisma.company.findMany({
      where,
      include: {
        departments: {
          include: {
            divisions: true,
          },
        },
        _count: {
          select: {
            users: true,
            // Soft-deleted files should not inflate company document stats.
            files: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        departments: {
          include: {
            divisions: true,
          },
        },
        _count: {
          select: {
            users: true,
            files: { where: { deletedAt: null } },
          },
        },
      },
    });
  }

  async create(
    data: {
      name: string;
      departments?: Array<{
        name: string;
        description?: string;
        divisions?: Array<{ name: string; description?: string }>;
      }>;
    },
    _currentUser?: any,
  ) {
    return this.prisma.company.create({
      data: {
        name: data.name,
        departments: data.departments?.length
          ? {
              create: data.departments.map((dept) => ({
                name: dept.name,
                description: dept.description,
                divisions: dept.divisions?.length
                  ? {
                      create: dept.divisions.map((div) => ({
                        name: div.name,
                        description: div.description,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: {
        departments: { include: { divisions: true } },
      },
    });
  }

  async update(id: string, data: { name?: string }, _currentUser?: any) {
    return this.prisma.company.update({
      where: { id },
      data: { ...(data.name !== undefined ? { name: data.name } : {}) },
      include: {
        departments: { include: { divisions: true } },
      },
    });
  }
}
