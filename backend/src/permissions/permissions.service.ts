import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getFolderPermissions(folderId: string, visitedFolders: Set<string> = new Set()): Promise<any> {
    // Prevent infinite recursion
    if (visitedFolders.has(folderId)) {
      return {
        folderId,
        explicitPermissions: [],
        inheritedPermissions: [],
      };
    }
    visitedFolders.add(folderId);
    
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: {
        id: true,
        scopeLevel: true,
        departmentId: true,
        divisionId: true,
        companyId: true,
        parentFolderId: true,
        permissionsJson: true,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Get inherited permissions from parent folder if exists
    let inheritedPermissions: any[] = [];
    if (folder.parentFolderId) {
      const parentPermissions = await this.getFolderPermissions(folder.parentFolderId, visitedFolders);
      inheritedPermissions = (parentPermissions.explicitPermissions || []) as any[];
    }

    // Merge inherited permissions with folder's own permissions
    const ownPermissions = (folder.permissionsJson as any[]) || [];
    const allPermissions = [...inheritedPermissions, ...ownPermissions];

    // Remove duplicates (keep most specific - own permissions override inherited)
    const uniquePermissions = allPermissions.reduce((acc: any[], perm: any) => {
      const existing = acc.find((p: any) => p.userId === perm.userId);
      if (!existing) {
        acc.push(perm);
      } else {
        // Own permissions override inherited
        const isOwn = ownPermissions.includes(perm);
        if (isOwn) {
          const index = acc.indexOf(existing);
          acc[index] = perm;
        }
      }
      return acc;
    }, []);

    return {
      folderId,
      scopeLevel: folder.scopeLevel,
      departmentId: folder.departmentId,
      divisionId: folder.divisionId,
      companyId: folder.companyId,
      parentFolderId: folder.parentFolderId,
      explicitPermissions: uniquePermissions,
      inheritedPermissions: inheritedPermissions,
    };
  }

  async getFilePermissions(fileId: string, folderId?: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        scopeLevel: true,
        departmentId: true,
        divisionId: true,
        companyId: true,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Get permissions from FileFolderLink if folderId is provided
    let linkPermissions = null;
    if (folderId) {
      const link = await this.prisma.fileFolderLink.findUnique({
        where: {
          fileId_folderId: {
            fileId,
            folderId,
          },
        },
        select: {
          permissionsJson: true,
        },
      });
      linkPermissions = link?.permissionsJson;
    }

    return {
      fileId,
      folderId,
      scopeLevel: file.scopeLevel,
      departmentId: file.departmentId,
      divisionId: file.divisionId,
      companyId: file.companyId,
      explicitPermissions: linkPermissions || null,
    };
  }

  async updateFilePermissions(
    fileId: string,
    folderId: string,
    permissions: any,
    currentUser: any,
  ) {
    // Check if link exists
    const link = await this.prisma.fileFolderLink.findUnique({
      where: {
        fileId_folderId: {
          fileId,
          folderId,
        },
      },
    });

    if (!link) {
      throw new Error('File is not linked to this folder');
    }

    // Update permissions
    const updatedLink = await this.prisma.fileFolderLink.update({
      where: {
        fileId_folderId: {
          fileId,
          folderId,
        },
      },
      data: {
        permissionsJson: permissions,
      },
    });

    // TODO: Create audit log entry for permission change
    // TODO: Create notification for affected users

    return updatedLink;
  }

  async updateFolderPermissions(
    folderId: string,
    permissions: any,
    currentUser: any,
  ) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Update permissions
    const updatedFolder = await this.prisma.folder.update({
      where: { id: folderId },
      data: {
        permissionsJson: permissions,
      },
    });

    // TODO: Create audit log entry for permission change
    // TODO: Create notification for affected users

    return updatedFolder;
  }

  async checkPermission(
    userId: string,
    resourceType: 'folder' | 'file',
    resourceId: string,
    permission: 'read' | 'write' | 'delete' | 'share' | 'manage',
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        userDepartments: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      return false;
    }

    if (resourceType === 'folder') {
      const folder = await this.prisma.folder.findUnique({
        where: { id: resourceId },
      });

      if (!folder) {
        return false;
      }

      // Check scope-based access
      if (folder.scopeLevel === 'company' && folder.companyId === user.companyId) {
        return true;
      }

      if (folder.scopeLevel === 'department') {
        const userDeptIds = user.userDepartments.map((ud) => ud.departmentId);
        if (folder.departmentId && userDeptIds.includes(folder.departmentId)) {
          return true;
        }
      }

      // Check explicit permissions with inheritance
      try {
        const folderPermissions = await this.getFolderPermissions(resourceId);
        const explicitPerms = folderPermissions.explicitPermissions as any[];
        
        if (Array.isArray(explicitPerms)) {
          const userPerm = explicitPerms.find((p: any) => p.userId === userId);
          if (userPerm && userPerm.permissions.includes(permission)) {
            return true;
          }
        }
      } catch (error) {
        // If getFolderPermissions fails, continue with scope-based check
        console.error('Error getting folder permissions:', error);
      }
    } else if (resourceType === 'file') {
      const file = await this.prisma.file.findUnique({
        where: { id: resourceId },
      });

      if (!file) {
        return false;
      }

      // Check scope-based access
      if (file.scopeLevel === 'company' && file.companyId === user.companyId) {
        return true;
      }

      if (file.scopeLevel === 'department') {
        const userDeptIds = user.userDepartments.map((ud) => ud.departmentId);
        if (file.departmentId && userDeptIds.includes(file.departmentId)) {
          return true;
        }
      }

      // Check explicit permissions from FileFolderLink
      const links = await this.prisma.fileFolderLink.findMany({
        where: { fileId: resourceId },
        select: {
          permissionsJson: true,
        },
      });

      for (const link of links) {
        if (link.permissionsJson) {
          const perms = link.permissionsJson as any;
          if (Array.isArray(perms)) {
            const userPerm = perms.find((p: any) => p.userId === userId);
            if (userPerm && userPerm.permissions.includes(permission)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}

