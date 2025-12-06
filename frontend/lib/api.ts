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
  login: async (email: string, password: string) => {
    const client = getClient();
    return await client.login(email, password);
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

  // Companies
  getCompanies: async () => {
    const client = getClient();
    return await client.getCompanies();
  },

  getCompany: async (id: string) => {
    const client = getClient();
    return await client.getCompany(id);
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
      documentCount: folder._count?.fileFolderLinks || 0,
      modifiedAt: folder.updatedAt || folder.createdAt,
      createdBy: folder.createdBy,
      createdByName: folder.creator?.name || folder.createdBy,
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
    data: {
      storagePath: string;
      fileName: string;
      fileType: string;
    }
  ) => {
    const client = getClient();
    return await client.uploadFileVersion(fileId, data);
  },

  restoreFileVersion: async (fileId: string, versionId: string) => {
    const client = getClient();
    return await client.restoreFileVersion(fileId, versionId);
  },

  getDocuments: async (folderId?: string) => {
    const client = getClient();
    const files = await client.getFiles();

    let documents = files.map((file: any) => {
      const folderLink = file.fileFolderLinks?.[0];
      return {
        id: file.id,
        name: file.fileName,
        type: file.fileType,
        size: 0,
        folderId: folderLink?.folderId || null,
        folder: folderLink?.folder?.name,
        scope: file.scopeLevel,
        scopeLevel: file.scopeLevel,
        status: "active",
        modifiedAt: file.updatedAt || file.createdAt,
        createdBy: file.createdBy,
        createdByName: file.creator?.name || file.createdBy,
        companyId: file.companyId,
      };
    });

    if (folderId) {
      documents = documents.filter((d: any) => d.folderId === folderId);
    }

    return documents;
  },

  getDocument: async (id: string) => {
    const client = getClient();
    const file = await client.getFile(id);
    const folderLink = file.fileFolderLinks?.[0];
    return {
      id: file.id,
      name: file.fileName,
      type: file.fileType,
      fileType: file.fileType,
      size: 0,
      folderId: folderLink?.folderId || null,
      folder: folderLink?.folder?.name,
      scope: file.scopeLevel,
      scopeLevel: file.scopeLevel,
      status: "active",
      modifiedAt: file.updatedAt || file.createdAt,
      createdBy: file.createdBy,
      createdByName: file.creator?.name || file.createdBy,
      richTextContent: file.richTextDoc?.htmlContent || null,
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

  updateFilePermissions: async (fileId: string, folderId: string, permissions: any) => {
    const client = getClient();
    return await client.updateFilePermissions(fileId, folderId, permissions);
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
};
