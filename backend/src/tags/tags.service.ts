import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class TagsService {
  constructor(
    private prisma: PrismaService,
    private permissionsService: PermissionsService,
  ) {}

  async getTags(companyId: string) {
    return this.prisma.tag.findMany({
      where: {
        companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createTag(companyId: string, name: string, userId: string) {
    // Check if tag already exists
    const existing = await this.prisma.tag.findFirst({
      where: {
        companyId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.tag.create({
      data: {
        name,
        companyId,
      },
    });
  }

  async getFileTags(fileId: string, userId: string) {
    // Check if user has read access to the file
    await this.permissionsService.assertPermission(userId, 'file', fileId, 'read');

    const fileTags = await this.prisma.fileTag.findMany({
      where: {
        fileId,
      },
      include: {
        tag: true,
      },
    });

    return fileTags.map(ft => ft.tag);
  }

  async updateFileTags(fileId: string, tagIds: string[], userId: string) {
    // Check if user has write access to the file
    await this.permissionsService.assertPermission(userId, 'file', fileId, 'write');

    // Get the file to ensure it exists and get companyId
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Verify all tags belong to the same company
    if (tagIds.length > 0) {
      const tags = await this.prisma.tag.findMany({
        where: {
          id: { in: tagIds },
          companyId: file.companyId,
        },
      });

      if (tags.length !== tagIds.length) {
        throw new ForbiddenException('One or more tags do not belong to your company');
      }
    }

    // Remove existing tags and add new ones in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Remove all existing tags for this file
      await tx.fileTag.deleteMany({
        where: {
          fileId,
        },
      });

      // Add new tags
      if (tagIds.length > 0) {
        await tx.fileTag.createMany({
          data: tagIds.map(tagId => ({
            fileId,
            tagId,
          })),
        });
      }

      // Return updated tags
      const updatedFileTags = await tx.fileTag.findMany({
        where: {
          fileId,
        },
        include: {
          tag: true,
        },
      });

      return updatedFileTags.map(ft => ft.tag);
    });
  }
}