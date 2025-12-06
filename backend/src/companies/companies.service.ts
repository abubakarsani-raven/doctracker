import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser?: any) {
    const where: any = {};
    
    // Non-Master users only see their own company
    if (currentUser && currentUser.role !== 'Master') {
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
      },
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
      },
    });
  }
}
