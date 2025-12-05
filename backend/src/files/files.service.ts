import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async getFiles(companyId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    return this.prisma.file.findMany({
      where,
      include: {
        fileFolderLinks: {
          include: {
            folder: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getFile(id: string) {
    return this.prisma.file.findUnique({
      where: { id },
      include: {
        fileFolderLinks: {
          include: {
            folder: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        richTextDoc: {
          select: {
            id: true,
            htmlContent: true,
          },
        },
      },
    });
  }

  async getFolders(companyId?: string, parentId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (parentId !== undefined) {
      where.parentFolderId = parentId;
    }
    return this.prisma.folder.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            fileFolderLinks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getFolder(id: string) {
    return this.prisma.folder.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fileFolderLinks: {
          include: {
            file: true,
          },
        },
      },
    });
  }

  async createFolder(data: {
    name: string;
    description?: string;
    scopeLevel: string;
    companyId: string;
    parentFolderId?: string;
    departmentId?: string;
    divisionId?: string;
    createdBy: string;
  }) {
    return this.prisma.folder.create({
      data: {
        name: data.name,
        description: data.description,
        scopeLevel: data.scopeLevel,
        companyId: data.companyId,
        parentFolderId: data.parentFolderId,
        departmentId: data.departmentId,
        divisionId: data.divisionId,
        createdBy: data.createdBy,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            fileFolderLinks: true,
          },
        },
      },
    });
  }

  async createFile(data: {
    fileName: string;
    fileType: string;
    storagePath: string;
    scopeLevel: string;
    companyId: string;
    folderId?: string;
    departmentId?: string;
    divisionId?: string;
    createdBy: string;
  }) {
    // Create the file
    const file = await this.prisma.file.create({
      data: {
        fileName: data.fileName,
        fileType: data.fileType,
        storagePath: data.storagePath,
        scopeLevel: data.scopeLevel,
        companyId: data.companyId,
        departmentId: data.departmentId,
        divisionId: data.divisionId,
        createdBy: data.createdBy,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Link file to folder if provided
    if (data.folderId) {
      await this.prisma.fileFolderLink.create({
        data: {
          fileId: file.id,
          folderId: data.folderId,
        },
      });
    }

    // Return file with folder link
    return this.prisma.file.findUnique({
      where: { id: file.id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fileFolderLinks: {
          include: {
            folder: true,
          },
        },
      },
    });
  }

  async createRichTextDocument(data: {
    fileName: string;
    htmlContent: string;
    scopeLevel: string;
    companyId: string;
    folderId: string;
    departmentId?: string;
    divisionId?: string;
    createdBy: string;
  }) {
    // Create the file first
    const file = await this.prisma.file.create({
      data: {
        fileName: data.fileName,
        fileType: 'html',
        storagePath: `/storage/${data.companyId}/${data.fileName}`,
        scopeLevel: data.scopeLevel,
        companyId: data.companyId,
        departmentId: data.departmentId,
        divisionId: data.divisionId,
        createdBy: data.createdBy,
      },
    });

    // Link file to folder
    await this.prisma.fileFolderLink.create({
      data: {
        fileId: file.id,
        folderId: data.folderId,
      },
    });

    // Create rich text document
    await this.prisma.richTextDocument.create({
      data: {
        fileId: file.id,
        htmlContent: data.htmlContent,
        createdBy: data.createdBy,
      },
    });

    // Return file with rich text content
    return this.prisma.file.findUnique({
      where: { id: file.id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fileFolderLinks: {
          include: {
            folder: true,
          },
        },
        richTextDoc: true,
      },
    });
  }

  async updateRichTextDocument(fileId: string, htmlContent: string, updatedBy: string) {
    // Get current rich text content to save as version
    const currentRichText = await this.prisma.richTextDocument.findUnique({
      where: { fileId },
      select: { htmlContent: true },
    });

    // Get current max version number
    const maxVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const newVersionNumber = (maxVersion?.versionNumber || 0) + 1;

    // Save current HTML content as a version before updating
    // For rich text documents, we store the HTML content in the storagePath field
    // Using a prefix to distinguish rich text versions from file versions
    if (currentRichText?.htmlContent) {
      await this.prisma.fileVersion.create({
        data: {
          fileId,
          versionNumber: newVersionNumber,
          storagePath: `rich-text-content://${Buffer.from(currentRichText.htmlContent).toString('base64')}`, // Store HTML content as base64 in storagePath
          createdBy: updatedBy,
        },
      });
    }

    // Update the rich text document
    await this.prisma.richTextDocument.update({
      where: { fileId },
      data: {
        htmlContent,
        updatedAt: new Date(),
      },
    });

    // Update file's updatedAt timestamp
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        updatedAt: new Date(),
      },
    });

    // Keep only the 10 most recent versions (delete older ones)
    const allVersions = await this.prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });

    if (allVersions.length > 10) {
      const versionsToDelete = allVersions.slice(10); // Get versions beyond the 10th
      await this.prisma.fileVersion.deleteMany({
        where: {
          id: {
            in: versionsToDelete.map((v) => v.id),
          },
        },
      });
    }

    // Return updated file with rich text content
    return this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fileFolderLinks: {
          include: {
            folder: true,
          },
        },
        richTextDoc: true,
      },
    });
  }

  async getFileVersions(fileId: string) {
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: {
        versionNumber: 'desc',
      },
      take: 10, // Limit to 10 versions
    });

    // Fetch creator information for each version and extract rich text content if applicable
    const versionsWithCreators = await Promise.all(
      versions.map(async (version) => {
        const creator = await this.prisma.user.findUnique({
          where: { id: version.createdBy },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        // Check if this is a rich text version (starts with "rich-text-content://")
        const isRichTextVersion = version.storagePath.startsWith('rich-text-content://');
        let richTextContent: string | null = null;

        if (isRichTextVersion) {
          try {
            // Extract and decode the base64 HTML content
            const base64Content = version.storagePath.replace('rich-text-content://', '');
            richTextContent = Buffer.from(base64Content, 'base64').toString('utf-8');
          } catch (error) {
            console.error('Error decoding rich text version content:', error);
          }
        }

        return {
          ...version,
          creator: creator || null,
          isRichTextVersion,
          richTextContent,
        };
      })
    );

    return versionsWithCreators;
  }

  async uploadFileVersion(
    fileId: string,
    storagePath: string,
    createdBy: string,
  ) {
    // Get current max version number
    const maxVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const newVersionNumber = (maxVersion?.versionNumber || 0) + 1;

    // Get file to save current version before updating
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Save current file as a version before updating
    await this.prisma.fileVersion.create({
      data: {
        fileId,
        versionNumber: newVersionNumber,
        storagePath: file.storagePath, // Save current storage path
        createdBy,
      },
    });

    // Update file with new storage path
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        storagePath,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fileFolderLinks: {
          include: {
            folder: true,
          },
        },
      },
    });

    // Keep only the 10 most recent versions (delete older ones)
    const allVersions = await this.prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });

    if (allVersions.length > 10) {
      const versionsToDelete = allVersions.slice(10); // Get versions beyond the 10th
      await this.prisma.fileVersion.deleteMany({
        where: {
          id: {
            in: versionsToDelete.map((v) => v.id),
          },
        },
      });
    }

    return updatedFile;
  }

  async restoreFileVersion(fileId: string, versionId: string, restoredBy: string) {
    // Get the version to restore
    const version = await this.prisma.fileVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.fileId !== fileId) {
      throw new Error('Version not found or does not belong to this file');
    }

    // Get the file to check its type
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        richTextDoc: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Check if this is a rich text version
    const isRichTextVersion = version.storagePath.startsWith('rich-text-content://');

    if (isRichTextVersion && file.richTextDoc) {
      // Restore rich text content
      // Extract and decode the HTML content
      const base64Content = version.storagePath.replace('rich-text-content://', '');
      const htmlContent = Buffer.from(base64Content, 'base64').toString('utf-8');

      // Use updateRichTextDocument which will save current content as a version first
      return await this.updateRichTextDocument(fileId, htmlContent, restoredBy);
    } else if (!isRichTextVersion) {
      // Restore file version - save current file as version first, then restore
      // Get current max version number
      const maxVersion = await this.prisma.fileVersion.findFirst({
        where: { fileId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      const newVersionNumber = (maxVersion?.versionNumber || 0) + 1;

      // Save current file state as a version before restoring
      await this.prisma.fileVersion.create({
        data: {
          fileId,
          versionNumber: newVersionNumber,
          storagePath: file.storagePath,
          createdBy: restoredBy,
        },
      });

      // Restore the version's storage path
      const updatedFile = await this.prisma.file.update({
        where: { id: fileId },
        data: {
          storagePath: version.storagePath,
          updatedAt: new Date(),
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          fileFolderLinks: {
            include: {
              folder: true,
            },
          },
        },
      });

      // Keep only the 10 most recent versions (delete older ones)
      const allVersions = await this.prisma.fileVersion.findMany({
        where: { fileId },
        orderBy: { versionNumber: 'desc' },
        select: { id: true },
      });

      if (allVersions.length > 10) {
        const versionsToDelete = allVersions.slice(10);
        await this.prisma.fileVersion.deleteMany({
          where: {
            id: {
              in: versionsToDelete.map((v) => v.id),
            },
          },
        });
      }

      return updatedFile;
    } else {
      throw new Error('Cannot restore rich text version to non-rich-text file');
    }
  }
}
