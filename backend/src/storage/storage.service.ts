import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StorageService {
  constructor(private prisma: PrismaService) {}

  async getCompanyStorage(companyId: string): Promise<number> {
    // Calculate total storage for a company by summing file sizes
    const result = await this.prisma.file.aggregate({
      where: { companyId },
      _sum: {
        fileSize: true,
      },
    });

    // Convert BigInt to number
    return result._sum.fileSize ? Number(result._sum.fileSize) : 0;
  }

  async getUserStorage(userId: string): Promise<number> {
    try {
      // Get user's company
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      });

      if (!user || !user.companyId) {
        return 0;
      }

      // For now, return company storage
      // In the future, could track per-user storage
      return this.getCompanyStorage(user.companyId);
    } catch (error) {
      console.error('[StorageService] Error getting user storage:', error);
      return 0;
    }
  }

  async getTotalStorage(): Promise<number> {
    // One aggregate over every file, rather than one query per company.
    // `File.companyId` is required and foreign-keyed, so summing without a
    // filter covers exactly the same rows the per-company loop did.
    const result = await this.prisma.file.aggregate({
      _sum: {
        fileSize: true,
      },
    });

    return result._sum.fileSize ? Number(result._sum.fileSize) : 0;
  }

  formatStorageSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

