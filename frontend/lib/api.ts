/**
 * API Service
 * All data comes from the backend database - no mock data
 */

import { getApiClient } from "./api-client";

// Helper to get API client (throws if not available)
const getClient = () => {
  // Only run on client side
  if (typeof window === 'undefined') {
    throw new Error("API client can only be accessed on the client side");
  }
  const client = getApiClient();
  if (!client) {
    throw new Error("API client not available. Please ensure the backend is running and NEXT_PUBLIC_API_URL is configured.");
  }
  return client;
};

export const api = {
  // Auth
  login: async (email: string, password: string, rememberMe = false) => {
    const client = getClient();
    return await client.login(email, password, rememberMe);
  },

  logout: async () => {
    const client = getClient();
    return await client.logout();
  },

  /** Quietly renew the access cookie; used by SessionKeepAlive. */
  refreshSession: async () => {
    const client = getClient();
    return await client.refreshToken();
  },

  register: async (data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    const client = getClient();
    return await client.register(data);
  },

  forgotPassword: async (email: string) => {
    const client = getClient();
    return await client.forgotPassword(email);
  },

  resetPassword: async (token: string, password: string) => {
    const client = getClient();
    return await client.resetPassword(token, password);
  },

  // Users
  getUsers: async () => {
    const client = getClient();
    return await client.getUsers();
  },

  getUser: async (id: string) => {
    const client = getClient();
    return await client.getUser(id);
  },

  getCurrentUser: async () => {
    const client = getClient();
    return await client.getCurrentUser();
  },

  inviteUser: async (data: {
    email: string;
    role: string;
    departmentId?: string;
    divisionId?: string;
    sendEmail?: boolean;
  }) => {
    const client = getClient();
    return await client.inviteUser(data);
  },

  updateOwnProfile: async (data: { name?: string; phone?: string }) => {
    const client = getClient();
    return await client.updateOwnProfile(data);
  },

  updateUser: async (id: string, data: {
    name?: string;
    email?: string;
    role?: string;
    departmentId?: string;
    divisionId?: string;
  }) => {
    const client = getClient();
    return await client.updateUser(id, data);
  },

  deactivateUser: async (id: string) => {
    const client = getClient();
    return await client.deactivateUser(id);
  },

  // Companies
  getCompanies: async () => {
    const client = getClient();
    return await client.getCompanies();
  },

  getCompany: async (id: string) => {
    const client = getClient();
    return await client.getCompany(id);
  },

  createCompany: async (data: {
    name: string;
    description?: string;
    address?: string;
  }) => {
    const client = getClient();
    return await client.createCompany(data);
  },

  updateCompany: async (id: string, data: {
    name?: string;
    description?: string;
    address?: string;
  }) => {
    const client = getClient();
    return await client.updateCompany(id, data);
  },

  // Documents & Folders
  getFolders: async (parentId?: string) => {
    const client = getClient();
    const folders = await client.getFolders(undefined, parentId);

    // Transform to expected format
    return folders.map((folder: any) => ({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      scope: folder.scopeLevel,
      scopeLevel: folder.scopeLevel,
      companyId: folder.companyId,
      departmentId: folder.departmentId,
      divisionId: folder.divisionId,
      parentFolderId: folder.parentFolderId,
      documentCount:
        folder.documentCount ??
        folder._count?.fileFolderLinks ??
        0,
      modifiedAt: folder.updatedAt || folder.createdAt,
      createdBy: folder.createdBy,
      createdByName: folder.creator?.name || folder.createdBy,
      // Carried so the UI can make the same access decision the API will.
      permissionsJson: folder.permissionsJson ?? null,
      // The server's own decision, when it sends one. Preferred over the
      // client-side mirror so the two can never disagree.
      access: folder.access ?? null,
    }));
  },

  getFolder: async (id: string) => {
    const client = getClient();
    const folder = await client.getFolder(id);
    return {
      ...folder,
      scope: folder.scopeLevel,
      scopeLevel: folder.scopeLevel,
      createdBy: folder.createdBy,
      createdByName: folder.creator?.name || folder.createdBy,
    };
  },

  createFolder: async (data: {
    name: string;
    description?: string;
    scopeLevel: string;
    parentFolderId?: string;
    departmentId?: string;
    divisionId?: string;
    companyId?: string;
  }) => {
    const client = getClient();
    return await client.createFolder(data);
  },

  createFile: async (data: {
    fileName: string;
    fileType: string;
    scopeLevel: string;
    folderId?: string;
    departmentId?: string;
    divisionId?: string;
  }) => {
    const client = getClient();
    return await client.createFile(data);
  },

  createRichTextDocument: async (data: {
    fileName: string;
    htmlContent: string;
    scopeLevel: string;
    folderId: string;
    departmentId?: string;
    divisionId?: string;
    companyId?: string;
  }) => {
    const client = getClient();
    return await client.createRichTextDocument(data);
  },

  updateRichTextDocument: async (fileId: string, htmlContent: string) => {
    const client = getClient();
    return await client.updateRichTextDocument(fileId, htmlContent);
  },

  getFileVersions: async (fileId: string) => {
    const client = getClient();
    const versions = await client.getFileVersions(fileId);
    return versions.map((v: any) => ({
      ...v,
      createdByName: v.creator?.name || v.createdBy,
    }));
  },

  uploadFileVersion: async (
    fileId: string,
    file: File | Blob,
    fileName?: string,
    changeNote?: string,
  ) => {
    const client = getClient();
    return await client.uploadFileVersion(fileId, file, fileName, changeNote);
  },

  restoreFileVersion: async (fileId: string, versionId: string) => {
    const client = getClient();
    return await client.restoreFileVersion(fileId, versionId);
  },

  getDocuments: async (folderId?: string) => {
    const client = getClient();
    // Exclude archived (and deleted) so the main library only lists live files.
    const files = await client.getFiles(undefined, false, false);

    let documents = files.map((file: any) => {
      const folderLink = file.fileFolderLinks?.[0];
      const folderIds = (file.fileFolderLinks ?? []).map((l: any) => l.folderId);
      return {
        id: file.id,
        name: file.fileName,
        type: file.fileType,
        // fileSize was previously hardcoded to 0, so every document reported
        // "0 Bytes". It arrives as a number now that the API serialises BigInt.
        size: Number(file.fileSize ?? 0),
        folderId: folderLink?.folderId || null,
        folder: folderLink?.folder?.name,
        folderIds,
        folderNames: (file.fileFolderLinks ?? []).map((l: any) => l.folder?.name),
        folderCount: (file.fileFolderLinks ?? []).length,
        scope: file.scopeLevel,
        scopeLevel: file.scopeLevel,
        status: file.deletedAt
          ? "deleted"
          : file.archivedAt
            ? "archived"
            : "active",
        modifiedAt: file.updatedAt || file.createdAt,
        createdBy: file.createdBy,
        createdByName: file.creator?.name || file.createdBy,
        companyId: file.companyId,
        // Carried so the UI can make the same access decision the API will.
        departmentId: file.departmentId,
        divisionId: file.divisionId,
        permissionsJson:
          folderLink?.permissionsJson ??
          folderLink?.folder?.permissionsJson ??
          file.permissionsJson ??
          null,
        access: file.access ?? null,
      };
    });

    if (folderId) {
      // A file may live in multiple folders — match any link, not only primary.
      documents = documents.filter(
        (d: any) =>
          d.folderId === folderId ||
          (Array.isArray(d.folderIds) && d.folderIds.includes(folderId)),
      );
    }

    return documents;
  },

  getArchivedDocuments: async () => {
    const client = getClient();
    const files = await client.getFiles(undefined, true, false); // includeArchived=true, includeDeleted=false

    // Filter to only archived documents and transform
    const archivedDocuments = files
      .filter((file: any) => file.archivedAt)
      .map((file: any) => {
        const folderLink = file.fileFolderLinks?.[0];
        return {
          id: file.id,
          name: file.fileName,
          type: file.fileType,
          size: Number(file.fileSize ?? 0),
          folderId: folderLink?.folderId || null,
          folder: folderLink?.folder?.name,
          folderIds: (file.fileFolderLinks ?? []).map((l: any) => l.folderId),
          folderNames: (file.fileFolderLinks ?? []).map((l: any) => l.folder?.name),
          folderCount: (file.fileFolderLinks ?? []).length,
          scope: file.scopeLevel,
          scopeLevel: file.scopeLevel,
          status: "archived",
          modifiedAt: file.updatedAt || file.createdAt,
          archivedAt: file.archivedAt,
          createdBy: file.createdBy,
          createdByName: file.creator?.name || file.createdBy,
          isRichTextDocument: file.fileType === 'html' || file.versions?.[0]?.isRichTextDocument,
          richTextContent: file.versions?.[0]?.richTextContent
        };
      });

    return archivedDocuments;
  },

  getDocument: async (id: string) => {
    const client = getClient();
    const file = await client.getFile(id);
    if (!file) {
      throw new Error('Document not found');
    }
    const folderLink = file.fileFolderLinks?.[0];
    return {
      id: file.id,
      name: file.fileName,
      type: file.fileType,
      fileType: file.fileType,
      size: Number(file.fileSize ?? 0),
      folderId: folderLink?.folderId || null,
      folder: folderLink?.folder?.name,
      folderIds: (file.fileFolderLinks ?? []).map((l: any) => l.folderId),
      scope: file.scopeLevel,
      scopeLevel: file.scopeLevel,
      status: file.deletedAt ? 'deleted' : file.archivedAt ? 'archived' : 'active',
      modifiedAt: file.updatedAt || file.createdAt,
      createdAt: file.createdAt,
      // Keep the user id separate from the display name for ACL / ownership checks.
      createdBy: file.createdBy,
      createdByName: file.creator?.name || file.createdBy,
      richTextContent: file.richTextDoc?.htmlContent || null,
      storagePath: file.storagePath,
      pageCount: file.pageCount ?? null,
      departmentId: file.departmentId,
      divisionId: file.divisionId,
      companyId: file.companyId,
      permissionsJson:
        file.permissionsJson ??
        folderLink?.permissionsJson ??
        folderLink?.folder?.permissionsJson ??
        null,
      access: file.access ?? null,
    };
  },

  // Workflows
  getWorkflows: async () => {
    const client = getClient();
    return await client.getWorkflows();
  },

  getWorkflow: async (id: string) => {
    const client = getClient();
    return await client.getWorkflow(id);
  },

  getWorkflowsByFolder: async (folderId: string) => {
    const client = getClient();
    return await client.getWorkflowsByFolder(folderId);
  },

  getWorkflowsByDocument: async (documentId: string) => {
    const client = getClient();
    return await client.getWorkflowsByDocument(documentId);
  },

  createWorkflow: async (data: any) => {
    const client = getClient();
    return await client.createWorkflow(data);
  },

  updateWorkflow: async (id: string, data: any) => {
    const client = getClient();
    return await client.updateWorkflow(id, data);
  },

  setWorkflowEndPoint: async (id: string, dueDate: string | null) => {
    const client = getClient();
    return await client.setWorkflowEndPoint(id, dueDate);
  },

  // Goals
  getWorkflowGoals: async (workflowId: string) => {
    const client = getClient();
    return await client.getWorkflowGoals(workflowId);
  },

  createWorkflowGoal: async (workflowId: string, data: any) => {
    const client = getClient();
    return await client.createWorkflowGoal(workflowId, data);
  },

  updateWorkflowGoal: async (goalId: string, data: any) => {
    const client = getClient();
    return await client.updateWorkflowGoal(goalId, data);
  },

  achieveWorkflowGoal: async (goalId: string, notes?: string) => {
    const client = getClient();
    return await client.achieveWorkflowGoal(goalId, notes);
  },

  getWorkflowFiles: async (workflowId: string) => {
    const client = getClient();
    return await client.getWorkflowFiles(workflowId);
  },

  attachFileToWorkflow: async (
    workflowId: string,
    data: { fileId: string; actionId?: string; note?: string },
  ) => {
    const client = getClient();
    return await client.attachFileToWorkflow(workflowId, data);
  },

  deleteWorkflowGoal: async (goalId: string) => {
    const client = getClient();
    return await client.deleteWorkflowGoal(goalId);
  },

  getMyGoals: async () => {
    const client = getClient();
    return await client.getMyGoals();
  },

  // Actions
  getActions: async () => {
    const client = getClient();
    return await client.getActions();
  },

  getAction: async (id: string) => {
    const client = getClient();
    return await client.getAction(id);
  },

  createAction: async (data: any) => {
    const client = getClient();
    return await client.createAction(data);
  },

  updateAction: async (id: string, data: any) => {
    const client = getClient();
    return await client.updateAction(id, data);
  },

  // Notifications
  getNotifications: async () => {
    const client = getClient();
    return await client.getNotifications();
  },

  getAllNotifications: async () => {
    const client = getClient();
    return await client.getNotifications();
  },

  markNotificationRead: async (id: string) => {
    const client = getClient();
    return await client.markNotificationRead(id);
  },

  // Access Requests
  getAccessRequests: async () => {
    const client = getClient();
    return await client.getAccessRequests();
  },

  getAccessRequest: async (id: string) => {
    const client = getClient();
    return await client.getAccessRequest(id);
  },

  createAccessRequest: async (data: any) => {
    const client = getClient();
    return await client.createAccessRequest(data);
  },

  updateAccessRequest: async (id: string, data: any) => {
    const client = getClient();
    return await client.updateAccessRequest(id, data);
  },

  deleteAccessRequest: async (id: string) => {
    const client = getClient();
    return await client.deleteAccessRequest(id);
  },

  // Approval Requests
  getApprovalRequests: async () => {
    const client = getClient();
    return await client.getApprovalRequests();
  },

  getApprovalRequest: async (id: string) => {
    const client = getClient();
    return await client.getApprovalRequest(id);
  },

  createApprovalRequest: async (data: any) => {
    const client = getClient();
    return await client.createApprovalRequest(data);
  },

  updateApprovalRequest: async (id: string, data: any) => {
    const client = getClient();
    return await client.updateApprovalRequest(id, data);
  },

  deleteApprovalRequest: async (id: string) => {
    const client = getClient();
    return await client.deleteApprovalRequest(id);
  },

  // Permissions
  getFolderPermissions: async (folderId: string) => {
    const client = getClient();
    return await client.getFolderPermissions(folderId);
  },

  getFilePermissions: async (fileId: string, folderId?: string) => {
    const client = getClient();
    return await client.getFilePermissions(fileId, folderId);
  },

  updateFilePermissions: async (
    fileId: string,
    folderId: string,
    permissions: any,
    onRevoke?: "leave" | "flag",
  ) => {
    const client = getClient();
    return await client.updateFilePermissions(fileId, folderId, permissions, onRevoke);
  },

  updateFolderPermissions: async (
    folderId: string,
    permissions: any,
    onRevoke?: "leave" | "flag",
  ) => {
    const client = getClient();
    return await client.updateFolderPermissions(folderId, permissions, onRevoke);
  },

  getMyPermissions: async () => {
    const client = getClient();
    return await client.getMyPermissions();
  },

  checkPermission: async (
    userId: string,
    resourceType: 'folder' | 'file',
    resourceId: string,
    permission: 'read' | 'write' | 'delete' | 'share' | 'manage',
  ) => {
    const client = getClient();
    return await client.checkPermission(userId, resourceType, resourceId, permission);
  },

  // Storage
  getCompanyStorage: async (companyId: string) => {
    const client = getClient();
    return await client.getCompanyStorage(companyId);
  },

  getUserStorage: async () => {
    const client = getClient();
    return await client.getUserStorage();
  },

  getTotalStorage: async () => {
    const client = getClient();
    return await client.getTotalStorage();
  },

  // Activity
  getActivity: async (queryParams?: string) => {
    const client = getClient();
    return await client.getActivity(queryParams);
  },

  getRecentActivity: async (limit: number = 50) => {
    const client = getClient();
    return await client.getRecentActivity(limit);
  },

  // File Upload
  uploadFile: async (
    file: File,
    data: {
      scopeLevel: string;
      folderId?: string;
      departmentId?: string;
      divisionId?: string;
      companyId?: string;
      fileName?: string;
    },
  ) => {
    const client = getClient();
    return await client.uploadFile(file, data);
  },

  // Document Notes
  getDocumentNotes: async (documentId: string) => {
    const client = getClient();
    return await client.getDocumentNotes(documentId);
  },

  createDocumentNote: async (documentId: string, data: { content: string; isPublic: boolean }) => {
    const client = getClient();
    return await client.createDocumentNote(documentId, data);
  },

  updateDocumentNote: async (noteId: string, data: { content?: string; isPublic?: boolean }) => {
    const client = getClient();
    return await client.updateDocumentNote(noteId, data);
  },

  deleteDocumentNote: async (noteId: string) => {
    const client = getClient();
    return await client.deleteDocumentNote(noteId);
  },

  // File Operations
  getDocumentBlob: async (fileId: string) => {
    const client = getClient();
    return await client.getDocumentBlob(fileId);
  },

  downloadDocument: async (fileId: string) => {
    const client = getClient();
    return await client.downloadDocument(fileId);
  },

  downloadFileVersion: async (fileId: string, versionId: string) => {
    const client = getClient();
    return await client.downloadFileVersion(fileId, versionId);
  },

  renameDocument: async (fileId: string, fileName: string) => {
    const client = getClient();
    return await client.renameDocument(fileId, fileName);
  },

  archiveDocument: async (fileId: string) => {
    const client = getClient();
    return await client.archiveDocument(fileId);
  },

  unarchiveDocument: async (fileId: string) => {
    const client = getClient();
    return await client.unarchiveDocument(fileId);
  },

  deleteDocument: async (fileId: string) => {
    const client = getClient();
    return await client.deleteDocument(fileId);
  },

  restoreDocument: async (fileId: string) => {
    const client = getClient();
    return await client.restoreDocument(fileId);
  },

  moveDocument: async (fileId: string, folderId: string) => {
    const client = getClient();
    return await client.moveDocument(fileId, folderId);
  },

  // Folder Operations
  updateFolder: async (folderId: string, data: { name?: string; description?: string }) => {
    const client = getClient();
    return await client.updateFolder(folderId, data);
  },

  archiveFolder: async (folderId: string) => {
    const client = getClient();
    return await client.archiveFolder(folderId);
  },

  deleteFolder: async (folderId: string) => {
    const client = getClient();
    return await client.deleteFolder(folderId);
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    const client = getClient();
    const [documents, workflows, actions, storageData] = await Promise.all([
      client.getFiles().catch(() => []),
      client.getWorkflows().catch(() => []),
      client.getActions().catch(() => []),
      client.getStorageStats().catch(() => ({ bytes: 0 })),
    ]);

    return {
      totalDocuments: documents?.length || 0,
      activeWorkflows:
        workflows?.filter(
          (w: any) => w.status !== "completed" && w.status !== "cancelled"
        ).length || 0,
      pendingActions:
        actions?.filter((a: any) => a.status === "pending").length || 0,
      storageUsed: storageData?.bytes || 0,
    };
  },

  searchDocuments: async (query: string, skip?: number, take?: number) => {
    const client = getClient();
    return await client.searchFiles(query, skip, take);
  },

  // Tags
  getTags: async (companyId?: string) => {
    const client = getClient();
    return await client.getTags(companyId);
  },

  createTag: async (name: string) => {
    const client = getClient();
    return await client.createTag(name);
  },

  getFileTags: async (fileId: string) => {
    const client = getClient();
    return await client.getFileTags(fileId);
  },

  updateFileTags: async (fileId: string, tagIds: string[]) => {
    const client = getClient();
    return await client.updateFileTags(fileId, tagIds);
  },

  // Signatures
  createSignatureRequest: async (fileId: string, participants: Array<{email: string, name: string, signingOrder: number}>) => {
    const client = getClient();
    return await client.createSignatureRequest(fileId, participants);
  },

  getSignatureRequest: async (requestId: string) => {
    const client = getClient();
    return await client.getSignatureRequest(requestId);
  },

  signDocument: async (
    requestId: string,
    participantId: string,
    signatureImageData: string,
    placement: {
      page: number;
      xPercent: number;
      yPercent: number;
      widthPercent?: number;
    },
    savedSignatureId?: string,
  ) => {
    const client = getClient();
    return await client.signDocument(
      requestId,
      participantId,
      signatureImageData,
      placement,
      savedSignatureId,
    );
  },

  getFileSignatureRequests: async (fileId: string) => {
    const client = getClient();
    return await client.getFileSignatureRequests(fileId);
  },

  listSavedSignatures: async () => {
    const client = getClient();
    return await client.listSavedSignatures();
  },

  createSavedSignature: async (data: {
    label: string;
    imageData: string;
    isDefault?: boolean;
  }) => {
    const client = getClient();
    return await client.createSavedSignature(data);
  },

  updateSavedSignature: async (
    id: string,
    data: { label?: string; imageData?: string; isDefault?: boolean },
  ) => {
    const client = getClient();
    return await client.updateSavedSignature(id, data);
  },

  deleteSavedSignature: async (id: string) => {
    const client = getClient();
    return await client.deleteSavedSignature(id);
  },
};
