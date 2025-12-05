import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.action.findMany({
      include: {
        workflow: true,
        document: true,
        creator: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.action.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            company: true,
          },
        },
        document: true,
        creator: true,
      },
    });
  }

  async create(data: any) {
    return this.prisma.action.create({
      data,
      include: {
        workflow: true,
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.action.update({
      where: { id },
      data,
    });
  }
}
