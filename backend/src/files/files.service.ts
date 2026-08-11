import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { PermissionsService } from '../permissions/permissions.service';
import { sanitizeRichTextHtml } from '../common/sanitize-html';
import { ObjectStorageService } from '../object-storage';
import { OBJECT_STORAGE } from '../object-storage';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { Readable } from 'stream';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
    private permissionsService: PermissionsService,
    @Inject(OBJECT_STORAGE) private objectStorage: ObjectStorageService,
  ) {}

  async getFiles(companyId?: string, includeDeleted: boolean = false, includeArchived: boolean = true) {
    try {
      const where: any = {
        deletedAt: null, // Exclude soft-deleted files by default
      };
      
      if (companyId) {
        where.companyId = companyId;
      }
      
      if (!includeArchived) {
        where.archivedAt = null;
      }
      
      if (includeDeleted) {
        delete where.deletedAt;
      }
      
      return await this.prisma.file.findMany({
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
    } catch (error) {
      console.error('[FilesService] Error getting files:', error);
      throw error;
    }
  }

  async getFile(id: string, currentUser?: any) {
    const file = await this.prisma.file.findUnique({
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
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.richTextDoc?.htmlContent) {
      file.richTextDoc.htmlContent = sanitizeRichTextHtml(file.richTextDoc.htmlContent);
    }

    const isPdf =
      file.fileType === 'pdf' ||
      file.fileType === 'application/pdf' ||
      file.fileName?.toLowerCase().endsWith('.pdf');

    let pageCount: number | null = null;
    if (isPdf && file.storagePath && !file.storagePath.startsWith('rich-text-content://')) {
      pageCount = await this.getPdfPageCount(file.storagePath);
    }

    return { ...file, pageCount };
  }

  async getPdfPageCount(storagePath: string): Promise<number | null> {
    try {
      const stream = await this.objectStorage.getStream(storagePath);
      const buffer = await this.streamToBuffer(stream);
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      return pdf.getPageCount();
    } catch (error) {
      console.warn('[FilesService] Could not read PDF page count:', (error as Error).message);
      return null;
    }
  }

  private streamToBuffer(stream: Readable | NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async getFolders(companyId?: string, parentId?: string, includeDeleted: boolean = false, includeArchived: boolean = true) {
    try {
      const where: any = {
        deletedAt: null, // Exclude soft-deleted folders by default
      };
      
      if (companyId) {
        where.companyId = companyId;
      }
      
      if (parentId !== undefined) {
        where.parentFolderId = parentId;
      }
      
      if (!includeArchived) {
        where.archivedAt = null;
      }
      
      if (includeDeleted) {
        delete where.deletedAt;
      }
      
      const folders = await this.prisma.folder.findMany({
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

      return this.withDocumentCounts(folders, {
        companyId,
        includeDeleted,
        includeArchived,
      });
    } catch (error) {
      console.error('[FilesService] Error getting folders:', error);
      throw error;
    }
  }

  /**
   * Attach `documentCount` = files in this folder + nested folders.
   * Parent registries often have zero direct links but many documents beneath.
   */
  private async withDocumentCounts<
    T extends {
      id: string;
      parentFolderId?: string | null;
      _count?: { fileFolderLinks?: number };
    },
  >(
    folders: T[],
    scope: {
      companyId?: string;
      includeDeleted: boolean;
      includeArchived: boolean;
    },
  ): Promise<Array<T & { documentCount: number }>> {
    if (!folders.length) return [];

    // Tree membership must use the full company tree, not only the page's
    // filtered rows (e.g. parentId=…), or nested file counts go missing.
    const treeWhere: any = {};
    if (!scope.includeDeleted) treeWhere.deletedAt = null;
    if (!scope.includeArchived) treeWhere.archivedAt = null;
    if (scope.companyId) treeWhere.companyId = scope.companyId;

    const treeFolders = await this.prisma.folder.findMany({
      where: treeWhere,
      select: { id: true, parentFolderId: true },
    });

    const links = await this.prisma.fileFolderLink.groupBy({
      by: ['folderId'],
      _count: { _all: true },
      where: {
        folderId: { in: treeFolders.map((f) => f.id) },
        file: { deletedAt: null },
      },
    });
    const directByFolder = new Map(
      links.map((row) => [row.folderId, row._count._all]),
    );

    const childrenByParent = new Map<string, string[]>();
    for (const folder of treeFolders) {
      const parentId = folder.parentFolderId;
      if (!parentId) continue;
      const list = childrenByParent.get(parentId);
      if (list) list.push(folder.id);
      else childrenByParent.set(parentId, [folder.id]);
    }

    const memo = new Map<string, number>();
    const countTree = (folderId: string): number => {
      const cached = memo.get(folderId);
      if (cached !== undefined) return cached;
      let total = directByFolder.get(folderId) ?? 0;
      for (const childId of childrenByParent.get(folderId) ?? []) {
        total += countTree(childId);
      }
      memo.set(folderId, total);
      return total;
    };

    return folders.map((folder) => ({
      ...folder,
      documentCount: countTree(folder.id),
    }));
  }

  async getFolder(id: string, currentUser?: any) {
    const folder = await this.prisma.folder.findUnique({
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
    
    if (!folder) {
      return null;
    }
    
    // Check access control - same company unless instance-wide scope
    if (currentUser) {
      const seesAll = currentUser.permissions?.dataScope === 'all';
      if (!seesAll && folder.companyId !== currentUser.companyId) {
        throw new ForbiddenException(
          'Access denied: Folder belongs to a different company',
        );
      }
    }
    
    return folder;
  }

  /**
   * How deep the folder tree may go, counting the top level as 1.
   * Beyond three levels the breadcrumb stops being readable and people lose
   * track of where a document actually lives.
   */
  static readonly MAX_FOLDER_DEPTH = 3;

  /** Depth of a folder, where a top-level folder is 1. */
  async getFolderDepth(folderId: string): Promise<number> {
    let depth = 1;
    let currentId: string | null = folderId;
    const seen = new Set<string>();

    while (currentId) {
      if (seen.has(currentId)) break; // guard against a cycle
      seen.add(currentId);

      const folder = await this.prisma.folder.findUnique({
        where: { id: currentId },
        select: { parentFolderId: true },
      });
      if (!folder?.parentFolderId) break;

      depth += 1;
      currentId = folder.parentFolderId;

      if (depth > FilesService.MAX_FOLDER_DEPTH + 1) break;
    }

    return depth;
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
    if (data.parentFolderId) {
      const parentDepth = await this.getFolderDepth(data.parentFolderId);
      if (parentDepth >= FilesService.MAX_FOLDER_DEPTH) {
        throw new BadRequestException(
          `Folders can only be ${FilesService.MAX_FOLDER_DEPTH} levels deep. ` +
            `This one is already at level ${parentDepth}, so it cannot hold subfolders.`,
        );
      }
    }

    // Access is need-to-know, so a new folder starts with no grants and would
    // be invisible to everyone but its creator. The chosen scope is turned into
    // a matching opening grant, which is what people mean when they file a
    // folder "for the Legal department". It is an ordinary ACL entry — visible
    // in Manage access, and revocable.
    const openingGrants = buildOpeningGrants(data);

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
        permissionsJson: openingGrants as any,
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
    fileSize?: number;
  }) {
    // Create the file
    const file = await this.prisma.file.create({
      data: {
        fileName: data.fileName,
        fileType: data.fileType,
        storagePath: data.storagePath,
        fileSize: data.fileSize ? BigInt(data.fileSize) : null,
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

    // Link file to folder if provided — verify folder exists and same company
    if (data.folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: data.folderId },
        select: { id: true, companyId: true, deletedAt: true },
      });
      if (!folder || folder.deletedAt) {
        throw new NotFoundException('Folder not found');
      }
      if (folder.companyId !== data.companyId) {
        throw new BadRequestException(
          'Cannot link a file to a folder in another company',
        );
      }
      await this.prisma.fileFolderLink.create({
        data: {
          fileId: file.id,
          folderId: data.folderId,
        },
      });
    }

    // Return file with folder link
    const createdFile = await this.prisma.file.findUnique({
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

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: data.createdBy,
        companyId: data.companyId,
        activityType: 'document_uploaded',
        resourceType: 'document',
        resourceId: file.id,
        description: `Document "${data.fileName}" was uploaded`,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    return createdFile;
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
    const safeHtml = sanitizeRichTextHtml(data.htmlContent);
    await this.prisma.richTextDocument.create({
      data: {
        fileId: file.id,
        htmlContent: safeHtml,
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
    const safeHtml = sanitizeRichTextHtml(htmlContent);
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
        htmlContent: safeHtml,
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
    fileSize?: number,
    fileName?: string,
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
      throw new NotFoundException('File not found');
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
        ...(fileSize != null ? { fileSize: BigInt(fileSize) } : {}),
        ...(fileName ? { fileName } : {}),
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

  // -------------------------------------------------------------------------
  // File Operations (Rename, Archive, Delete, Move, Restore)
  // -------------------------------------------------------------------------

  async renameFile(fileId: string, fileName: string, updatedBy: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, fileName: true, companyId: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: { 
        fileName,
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

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: updatedBy,
        companyId: file.companyId,
        activityType: 'document_renamed',
        resourceType: 'document',
        resourceId: fileId,
        description: `Document renamed from "${file.fileName}" to "${fileName}"`,
      });
    } catch (error) {
      console.error('Failed to log rename activity:', error);
    }

    return updatedFile;
  }

  async archiveFile(fileId: string, archivedBy: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, fileName: true, companyId: true, archivedAt: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.archivedAt) {
      throw new BadRequestException('File is already archived');
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: { 
        archivedAt: new Date(),
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

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: archivedBy,
        companyId: file.companyId,
        activityType: 'document_archived',
        resourceType: 'document',
        resourceId: fileId,
        description: `Document "${file.fileName}" was archived`,
      });
    } catch (error) {
      console.error('Failed to log archive activity:', error);
    }

    return updatedFile;
  }

  async unarchiveFile(fileId: string, unarchivedBy: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, fileName: true, companyId: true, archivedAt: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.archivedAt) {
      throw new BadRequestException('File is not archived');
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: { 
        archivedAt: null,
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

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: unarchivedBy,
        companyId: file.companyId,
        activityType: 'document_unarchived',
        resourceType: 'document',
        resourceId: fileId,
        description: `Document "${file.fileName}" was unarchived`,
      });
    } catch (error) {
      console.error('Failed to log unarchive activity:', error);
    }

    return updatedFile;
  }

  async softDeleteFile(fileId: string, deletedBy: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, fileName: true, companyId: true, deletedAt: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.deletedAt) {
      throw new BadRequestException('File is already deleted');
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: { 
        deletedAt: new Date(),
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

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: deletedBy,
        companyId: file.companyId,
        activityType: 'document_deleted',
        resourceType: 'document',
        resourceId: fileId,
        description: `Document "${file.fileName}" was deleted`,
      });
    } catch (error) {
      console.error('Failed to log delete activity:', error);
    }

    return updatedFile;
  }

  async restoreFile(fileId: string, restoredBy: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, fileName: true, companyId: true, deletedAt: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.deletedAt) {
      throw new BadRequestException('File is not deleted');
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: { 
        deletedAt: null,
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

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: restoredBy,
        companyId: file.companyId,
        activityType: 'document_restored',
        resourceType: 'document',
        resourceId: fileId,
        description: `Document "${file.fileName}" was restored from trash`,
      });
    } catch (error) {
      console.error('Failed to log restore activity:', error);
    }

    return updatedFile;
  }

  async moveFile(fileId: string, folderId: string, movedBy: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { 
        id: true, 
        fileName: true, 
        companyId: true,
        fileFolderLinks: {
          include: {
            folder: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Verify target folder exists
    const targetFolder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, name: true, companyId: true },
    });

    if (!targetFolder) {
      throw new NotFoundException('Target folder not found');
    }

    // Ensure same company
    if (file.companyId !== targetFolder.companyId) {
      throw new BadRequestException('Cannot move file to a folder in another company');
    }

    // Get current folder names for logging
    const currentFolders = file.fileFolderLinks.map(link => link.folder.name).join(', ');

    // Remove existing folder links
    await this.prisma.fileFolderLink.deleteMany({
      where: { fileId },
    });

    // Create new folder link
    await this.prisma.fileFolderLink.create({
      data: {
        fileId,
        folderId,
      },
    });

    // Update file timestamp
    await this.prisma.file.update({
      where: { id: fileId },
      data: { updatedAt: new Date() },
    });

    // Get updated file
    const updatedFile = await this.prisma.file.findUnique({
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
      },
    });

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: movedBy,
        companyId: file.companyId,
        activityType: 'document_moved',
        resourceType: 'document',
        resourceId: fileId,
        description: `Document "${file.fileName}" moved from [${currentFolders}] to "${targetFolder.name}"`,
      });
    } catch (error) {
      console.error('Failed to log move activity:', error);
    }

    return updatedFile;
  }

  // -------------------------------------------------------------------------
  // Folder Operations (Update, Archive, Delete)
  // -------------------------------------------------------------------------

  async updateFolder(folderId: string, data: { name?: string; description?: string }, updatedBy: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, name: true, companyId: true },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const updatedFolder = await this.prisma.folder.update({
      where: { id: folderId },
      data: {
        ...data,
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
        _count: {
          select: {
            fileFolderLinks: true,
          },
        },
      },
    });

    // Log activity if name changed
    if (data.name && data.name !== folder.name) {
      try {
        await this.activityService.createActivity({
          userId: updatedBy,
          companyId: folder.companyId,
          activityType: 'folder_renamed',
          resourceType: 'folder',
          resourceId: folderId,
          description: `Folder renamed from "${folder.name}" to "${data.name}"`,
        });
      } catch (error) {
        console.error('Failed to log folder update activity:', error);
      }
    }

    return updatedFolder;
  }

  async archiveFolder(folderId: string, archivedBy: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, name: true, companyId: true, archivedAt: true },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.archivedAt) {
      throw new BadRequestException('Folder is already archived');
    }

    const updatedFolder = await this.prisma.folder.update({
      where: { id: folderId },
      data: { 
        archivedAt: new Date(),
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
        _count: {
          select: {
            fileFolderLinks: true,
          },
        },
      },
    });

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: archivedBy,
        companyId: folder.companyId,
        activityType: 'folder_archived',
        resourceType: 'folder',
        resourceId: folderId,
        description: `Folder "${folder.name}" was archived`,
      });
    } catch (error) {
      console.error('Failed to log folder archive activity:', error);
    }

    return updatedFolder;
  }

  async softDeleteFolder(folderId: string, deletedBy: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, name: true, companyId: true, deletedAt: true },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.deletedAt) {
      throw new BadRequestException('Folder is already deleted');
    }

    const updatedFolder = await this.prisma.folder.update({
      where: { id: folderId },
      data: { 
        deletedAt: new Date(),
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
        _count: {
          select: {
            fileFolderLinks: true,
          },
        },
      },
    });

    // Log activity
    try {
      await this.activityService.createActivity({
        userId: deletedBy,
        companyId: folder.companyId,
        activityType: 'folder_deleted',
        resourceType: 'folder',
        resourceId: folderId,
        description: `Folder "${folder.name}" was deleted`,
      });
    } catch (error) {
      console.error('Failed to log folder delete activity:', error);
    }

    return updatedFolder;
  }

  // -------------------------------------------------------------------------
  // Object Storage Operations
  // -------------------------------------------------------------------------

  async uploadToStorage(
    buffer: Buffer,
    companyId: string,
    fileId: string,
    originalName: string,
    mimeType: string
  ): Promise<string> {
    const extension = path.extname(originalName);
    const uuid = require('crypto').randomUUID();
    const key = `${companyId}/${fileId}/${uuid}${extension}`;
    
    return await this.objectStorage.put(key, buffer, mimeType);
  }

  async getFileStream(storagePath: string) {
    if (
      !storagePath ||
      storagePath.startsWith('pending://') ||
      storagePath.startsWith('rich-text-content://')
    ) {
      throw new BadRequestException('File content is not available for download');
    }
    return await this.objectStorage.getStream(storagePath);
  }

  async getFileMetadata(storagePath: string) {
    return await this.objectStorage.head(storagePath);
  }

  async createVersion(fileId: string, versionData: {
    versionNumber: number;
    storagePath: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedBy: string;
  }) {
    return this.prisma.fileVersion.create({
      data: {
        fileId,
        versionNumber: versionData.versionNumber,
        storagePath: versionData.storagePath,
        createdBy: versionData.uploadedBy,
      },
    });
  }

  async searchFiles(
    companyId: string,
    user: any,
    query: string,
    skip: number = 0,
    take: number = 50
  ) {
    // Build search conditions
    const where: any = {
      companyId,
      deletedAt: null, // Only search non-deleted files
      OR: [
        {
          fileName: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          richTextDoc: {
            htmlContent: {
              contains: query,
              mode: 'insensitive',
            },
          },
        },
      ],
    };

    // Get total count and items
    const [total, items] = await Promise.all([
      this.prisma.file.count({ where }),
      this.prisma.file.findMany({
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
          richTextDoc: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
    ]);

    // Filter results by user's read permissions
    const filteredItems = await this.permissionsService.filterReadable(user.id, 'file', items);

    return {
      items: filteredItems,
      total,
    };
  }
}

/**
 * The initial ACL for a newly created folder, derived from the scope chosen at
 * creation. A department-scoped folder opens to that department; a
 * division-scoped one to that division. A company-scoped folder gets no subject
 * grant here — the caller decides who to add — but the creator always retains
 * access through the creator rule.
 */
function buildOpeningGrants(data: {
  scopeLevel: string;
  departmentId?: string;
  divisionId?: string;
  createdBy: string;
}) {
  const grantedAt = new Date().toISOString();
  const base = { effect: 'allow' as const, grantedBy: data.createdBy, grantedAt };
  const grants: any[] = [];

  if (data.scopeLevel === 'department' && data.departmentId) {
    grants.push({
      ...base,
      subjectType: 'department',
      subjectId: data.departmentId,
      permissions: ['read', 'write', 'share'],
    });
  } else if (data.scopeLevel === 'division' && data.divisionId) {
    grants.push({
      ...base,
      subjectType: 'division',
      subjectId: data.divisionId,
      permissions: ['read', 'write', 'share'],
    });
  }

  return grants;
}
