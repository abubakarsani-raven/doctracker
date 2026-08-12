import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ensure at least one active company exists. Master / documents need a home
   * org — without one, uploads and folders have nowhere to live.
   */
  async ensureDefaultCompany(): Promise<{ id: string; name: string }> {
    const active = await this.prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    if (active) return active;

    const any = await this.prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, isActive: true },
    });
    if (any) {
      return this.prisma.company.update({
        where: { id: any.id },
        data: { isActive: true },
        select: { id: true, name: true },
      });
    }

    return this.prisma.company.create({
      data: {
        name: 'System',
        description: 'Default organisation created automatically',
        isActive: true,
      },
      select: { id: true, name: true },
    });
  }

  async findAll(currentUser?: any) {
    await this.ensureDefaultCompany();

    const where: any = {};

    // Only an instance-wide scope sees other companies.
    if (currentUser && currentUser.permissions?.dataScope !== 'all') {
      if (currentUser.companyId) {
        where.id = currentUser.companyId;
      } else {
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
            files: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
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
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async create(
    data: {
      name: string;
      description?: string;
      address?: string;
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
        description: data.description,
        address: data.address,
        isActive: true,
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

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      address?: string;
      isActive?: boolean;
    },
    _currentUser?: any,
  ) {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    if (data.isActive === false && existing.isActive) {
      const activeCount = await this.prisma.company.count({
        where: { isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException(
          'Cannot deactivate the last active company. Create or reactivate another company first.',
        );
      }
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: {
        departments: { include: { divisions: true } },
        _count: {
          select: {
            users: true,
            files: { where: { deletedAt: null } },
          },
        },
      },
    });
  }

  /**
   * Master-only: move document ownership (files + folders) from one company
   * to another. Deactivated-company files stay until transferred.
   */
  async transferOwnership(
    sourceCompanyId: string,
    targetCompanyId: string,
    options: {
      transferAll?: boolean;
      fileIds?: string[];
      folderIds?: string[];
    } = {},
  ) {
    if (sourceCompanyId === targetCompanyId) {
      throw new BadRequestException('Source and target company must differ');
    }

    const [source, target] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: sourceCompanyId } }),
      this.prisma.company.findUnique({ where: { id: targetCompanyId } }),
    ]);
    if (!source) throw new NotFoundException('Source company not found');
    if (!target) throw new NotFoundException('Target company not found');
    if (!target.isActive) {
      throw new BadRequestException(
        'Cannot transfer ownership into a deactivated company',
      );
    }

    const transferAll = !!options.transferAll;
    const fileIds = options.fileIds?.filter(Boolean) ?? [];
    const folderIds = options.folderIds?.filter(Boolean) ?? [];

    if (!transferAll && !fileIds.length && !folderIds.length) {
      throw new BadRequestException(
        'Pass transferAll, or specific fileIds / folderIds',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const folderWhere = transferAll
        ? { companyId: sourceCompanyId }
        : { companyId: sourceCompanyId, id: { in: folderIds } };

      const fileWhere = transferAll
        ? { companyId: sourceCompanyId, deletedAt: null }
        : {
            companyId: sourceCompanyId,
            deletedAt: null,
            id: { in: fileIds },
          };

      const foldersMoved = await tx.folder.updateMany({
        where: folderWhere,
        data: { companyId: targetCompanyId },
      });

      const filesMoved = await tx.file.updateMany({
        where: fileWhere,
        data: { companyId: targetCompanyId },
      });

      // Workflows + tags that still point at the source company stay put unless
      // transferAll — Master can re-home documents without relocating open work.
      return {
        sourceCompanyId,
        targetCompanyId,
        foldersMoved: foldersMoved.count,
        filesMoved: filesMoved.count,
      };
    });
  }
}
