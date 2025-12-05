import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.workflow.findMany({
      include: {
        company: true,
        document: true,
        actions: true,
        routingHistory: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.workflow.findUnique({
      where: { id },
      include: {
        company: true,
        document: true,
        actions: true,
        routingHistory: {
          orderBy: {
            routedAt: 'asc',
          },
        },
      },
    });
  }

  async create(data: any) {
    return this.prisma.workflow.create({
      data,
      include: {
        company: true,
        document: true,
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.workflow.update({
      where: { id },
      data,
    });
  }
}
