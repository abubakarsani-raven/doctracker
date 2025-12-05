/**
 * API Service
 * Switches between mock data and real API based on environment
 */

import { mockApi, USE_MOCK_DATA } from "./mock-api";

// Check if we should use the real API (only on client side to avoid hydration issues)
// Try backend by default if API URL is configured, fallback to mock if it fails
const shouldUseRealAPI = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  // Always try backend if API URL is configured, or if explicitly enabled
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  return !!apiUrl || process.env.NEXT_PUBLIC_USE_REAL_API === 'true';
};

// Import API client when backend is available
let apiClientModule: any = null;
let apiClientPromise: Promise<any> | null = null;

// Initialize API client (only on client side)
const getApiClient = async () => {
  // Always return null on server side to avoid hydration mismatches
  if (typeof window === 'undefined') {
    console.log('[API] getApiClient: Server side, returning null');
    return null;
  }
  
  // Check if API URL is configured
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003';
  console.log('[API] getApiClient: API_BASE_URL =', API_BASE_URL);
  
  if (!API_BASE_URL) {
    console.log('[API] getApiClient: No API URL configured, returning null');
    return null;
  }
  
  if (apiClientModule) {
    const client = apiClientModule.getApiClient();
    console.log('[API] getApiClient: Using cached module, client =', client ? 'exists' : 'null');
    return client;
  }
  
  if (!apiClientPromise) {
    console.log('[API] getApiClient: Loading api-client module...');
    apiClientPromise = import('./api-client').then((module) => {
      apiClientModule = module;
      const client = module.getApiClient();
      console.log('[API] getApiClient: Module loaded, client =', client ? 'exists' : 'null');
      return client;
    }).catch((error) => {
      console.error('[API] getApiClient: Failed to load module, falling back to mock data', error);
      return null;
    });
  }
  
  const client = await apiClientPromise;
  console.log('[API] getApiClient: Final client =', client ? 'exists' : 'null');
  return client;
};

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.login(email, password);
        } catch (error) {
          console.error('Backend login failed, falling back to mock:', error);
          return mockApi.login(email, password);
        }
      }
    }
    return mockApi.login(email, password);
  },

  // Users
  getUsers: async () => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getUsers();
        } catch (error) {
          console.error('Backend getUsers failed, falling back to mock:', error);
          return mockApi.getUsers();
        }
      }
    }
    return mockApi.getUsers();
  },
  
  getUser: async (id: string) => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getUser(id);
        } catch (error) {
          console.error('Backend getUser failed, falling back to mock:', error);
          return mockApi.getUser(id);
        }
      }
    }
    return mockApi.getUser(id);
  },
  
  getCurrentUser: async () => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getCurrentUser();
        } catch (error) {
          console.error('Backend getCurrentUser failed, falling back to mock:', error);
          return mockApi.getCurrentUser();
        }
      }
    }
    return mockApi.getCurrentUser();
  },

  // Companies
  getCompanies: async () => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getCompanies();
        } catch (error) {
          console.error('Backend getCompanies failed, falling back to mock:', error);
          return mockApi.getCompanies();
        }
      }
    }
    return mockApi.getCompanies();
  },
  
  getCompany: async (id: string) => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getCompany(id);
        } catch (error) {
          console.error('Backend getCompany failed, falling back to mock:', error);
          return mockApi.getCompany(id);
        }
      }
    }
    return mockApi.getCompany(id);
  },

  // Documents & Folders
  getFolders: async (parentId?: string) => {
    // Always try backend first if available
    console.log('[API] getFolders called, parentId:', parentId);
    const client = await getApiClient();
    console.log('[API] getApiClient returned:', client ? 'client exists' : 'null');
    
    if (client) {
      try {
        console.log('[API] Fetching folders from backend...');
        // Get folders from backend (will use user's company automatically)
        const folders = await client.getFolders(undefined, parentId);
        console.log('[API] Backend returned folders:', folders?.length || 0);
        
        // Transform to expected format
        const transformed = folders.map((folder: any) => ({
          id: folder.id,
          name: folder.name,
          description: folder.description,
          scope: folder.scopeLevel, // Map scopeLevel to scope for compatibility
          scopeLevel: folder.scopeLevel, // Keep original for permission checks
          companyId: folder.companyId,
          departmentId: folder.departmentId,
          divisionId: folder.divisionId,
          parentFolderId: folder.parentFolderId,
          documentCount: folder._count?.fileFolderLinks || 0,
          modifiedAt: folder.updatedAt || folder.createdAt,
          createdBy: folder.createdBy, // Keep the user ID for permission checks
          createdByName: folder.creator?.name || folder.createdBy, // Display name
        }));
        
        console.log('[API] Returning folders:', transformed.length);
        return transformed;
      } catch (error) {
        console.error('[API] Backend getFolders failed, falling back to mock:', error);
        return mockApi.getFolders(parentId);
      }
    }
    console.log('[API] No API client available, using mock data');
    return mockApi.getFolders(parentId);
  },
  
  getFolder: async (id: string) => {
    // Always try backend first if available
    const client = await getApiClient();
    if (client) {
      try {
        const folder = await client.getFolder(id);
        // Transform to expected format
        return {
          ...folder,
          scope: folder.scopeLevel, // Map scopeLevel to scope for compatibility
          scopeLevel: folder.scopeLevel, // Keep original for permission checks
          createdBy: folder.createdBy, // Keep the user ID for permission checks
          createdByName: folder.creator?.name || folder.createdBy, // Display name
        };
      } catch (error) {
        console.error('Backend getFolder failed, falling back to mock:', error);
        return mockApi.getFolder(id);
      }
    }
    return mockApi.getFolder(id);
  },

  createFolder: async (data: {
    name: string;
    description?: string;
    scopeLevel: string;
    parentFolderId?: string;
    departmentId?: string;
    divisionId?: string;
  }) => {
    console.log('[API] createFolder called:', data);
    const client = await getApiClient();
    if (client) {
      try {
        console.log('[API] Creating folder via backend...');
        const folder = await client.createFolder(data);
        console.log('[API] Folder created:', folder);
        return folder;
      } catch (error) {
        console.error('[API] Backend createFolder failed:', error);
        throw error;
      }
    }
    throw new Error('API client not available');
  },

  createFile: async (data: {
    fileName: string;
    fileType: string;
    scopeLevel: string;
    folderId?: string;
    departmentId?: string;
    divisionId?: string;
  }) => {
    const client = await getApiClient();
    if (client) {
      try {
        return await client.createFile(data);
      } catch (error) {
        console.error('Backend createFile failed:', error);
        throw error;
      }
    }
    throw new Error('API client not available');
  },

  createRichTextDocument: async (data: {
    fileName: string;
    htmlContent: string;
    scopeLevel: string;
    folderId: string;
    departmentId?: string;
    divisionId?: string;
  }) => {
    const client = await getApiClient();
    if (client) {
      try {
        return await client.createRichTextDocument(data);
      } catch (error) {
        console.error('Backend createRichTextDocument failed:', error);
        throw error;
      }
    }
    throw new Error('API client not available');
  },

  updateRichTextDocument: async (fileId: string, htmlContent: string) => {
    const client = await getApiClient();
    if (client) {
      try {
        return await client.updateRichTextDocument(fileId, htmlContent);
      } catch (error) {
        console.error('Backend updateRichTextDocument failed:', error);
        throw error;
      }
    }
    throw new Error('API client not available');
  },

  getFileVersions: async (fileId: string) => {
    const client = await getApiClient();
    if (client) {
      try {
        const versions = await client.getFileVersions(fileId);
        // Transform to include creator name and preserve rich text content
        return versions.map((v: any) => ({
          ...v,
          createdByName: v.creator?.name || v.createdBy,
          // Rich text content and flag are already included from backend
        }));
      } catch (error) {
        console.error('Backend getFileVersions failed:', error);
        return [];
      }
    }
    return [];
  },

  uploadFileVersion: async (fileId: string, data: {
    storagePath: string;
    fileName: string;
    fileType: string;
  }) => {
    const client = await getApiClient();
    if (client) {
      try {
        return await client.uploadFileVersion(fileId, data);
      } catch (error) {
        console.error('Backend uploadFileVersion failed:', error);
        throw error;
      }
    }
    throw new Error('API client not available');
  },

  restoreFileVersion: async (fileId: string, versionId: string) => {
    const client = await getApiClient();
    if (client) {
      try {
        return await client.restoreFileVersion(fileId, versionId);
      } catch (error) {
        console.error('Backend restoreFileVersion failed:', error);
        throw error;
      }
    }
    throw new Error('API client not available');
  },
  
  getDocuments: async (folderId?: string) => {
    // Always try backend first if available
    console.log('[API] getDocuments called, folderId:', folderId);
    const client = await getApiClient();
    console.log('[API] getApiClient returned:', client ? 'client exists' : 'null');
    
    if (client) {
      try {
        console.log('[API] Fetching files from backend...');
        // Get files from backend (will use user's company automatically)
        const files = await client.getFiles();
        console.log('[API] Backend returned files:', files?.length || 0);
        
        // Transform files to documents format and filter by folder if needed
        let documents = files.map((file: any) => {
          const folderLink = file.fileFolderLinks?.[0];
          return {
            id: file.id,
            name: file.fileName,
            type: file.fileType,
            size: 0, // File size not stored in DB
            folderId: folderLink?.folderId || null,
            folder: folderLink?.folder?.name,
            scope: file.scopeLevel, // Map scopeLevel to scope for compatibility
            scopeLevel: file.scopeLevel, // Keep original for permission checks
            status: 'active',
            modifiedAt: file.updatedAt || file.createdAt,
            createdBy: file.createdBy, // Keep the user ID for permission checks
            createdByName: file.creator?.name || file.createdBy, // Display name
            companyId: file.companyId, // Add companyId for filtering
          };
        });
        
        if (folderId) {
          documents = documents.filter((d: any) => d.folderId === folderId);
        }
        
        console.log('[API] Returning documents:', documents.length);
        return documents;
      } catch (error) {
        console.error('[API] Backend getDocuments failed, falling back to mock:', error);
        return mockApi.getDocuments(folderId);
      }
    }
    console.log('[API] No API client available, using mock data');
    return mockApi.getDocuments(folderId);
  },
  
  getDocument: async (id: string) => {
    // Always try backend first if available
    const client = await getApiClient();
    if (client) {
      try {
        const file = await client.getFile(id);
        const folderLink = file.fileFolderLinks?.[0];
        return {
          id: file.id,
          name: file.fileName,
          type: file.fileType,
          fileType: file.fileType, // Alias for compatibility
          size: 0,
          folderId: folderLink?.folderId || null,
          folder: folderLink?.folder?.name,
          scope: file.scopeLevel, // Map scopeLevel to scope for compatibility
          scopeLevel: file.scopeLevel, // Keep original for permission checks
          status: 'active',
          modifiedAt: file.updatedAt || file.createdAt,
          createdBy: file.createdBy, // Keep the user ID for permission checks
          createdByName: file.creator?.name || file.createdBy, // Display name
          richTextContent: file.richTextDoc?.htmlContent || null, // Rich text content if available
        };
      } catch (error) {
        console.error('Backend getDocument failed, falling back to mock:', error);
        return mockApi.getDocument(id);
      }
    }
    return mockApi.getDocument(id);
  },
  
  searchDocuments: (query: string) => mockApi.searchDocuments(query),

  // Workflows
  getWorkflows: async () => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getWorkflows();
        } catch (error) {
          console.error('Backend getWorkflows failed, falling back to mock:', error);
          return mockApi.getWorkflows();
        }
      }
    }
    return mockApi.getWorkflows();
  },
  
  getWorkflow: async (id: string) => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getWorkflow(id);
        } catch (error) {
          console.error('Backend getWorkflow failed, falling back to mock:', error);
          return mockApi.getWorkflow(id);
        }
      }
    }
    return mockApi.getWorkflow(id);
  },

  // Actions
  getActions: async () => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getActions();
        } catch (error) {
          console.error('Backend getActions failed, falling back to mock:', error);
          return mockApi.getActions();
        }
      }
    }
    return mockApi.getActions();
  },
  
  getAction: async (id: string) => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getAction(id);
        } catch (error) {
          console.error('Backend getAction failed, falling back to mock:', error);
          return mockApi.getAction(id);
        }
      }
    }
    return mockApi.getAction(id);
  },

  // External Documents (still using mock)
  getExternalDocuments: () => mockApi.getExternalDocuments(),

  // Templates (still using mock)
  getTemplates: () => mockApi.getTemplates(),

  // Archived (still using mock)
  getArchivedDocuments: () => mockApi.getArchivedDocuments(),

  // Notifications
  getNotifications: async () => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getNotifications();
        } catch (error) {
          console.error('Backend getNotifications failed, falling back to mock:', error);
          return mockApi.getNotifications();
        }
      }
    }
    return mockApi.getNotifications();
  },
  
  getAllNotifications: async () => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.getNotifications();
        } catch (error) {
          console.error('Backend getAllNotifications failed, falling back to mock:', error);
          return mockApi.getAllNotifications();
        }
      }
    }
    return mockApi.getAllNotifications();
  },
  
  markNotificationRead: async (id: string) => {
    if (shouldUseRealAPI()) {
      const client = await getApiClient();
      if (client) {
        try {
          return await client.markNotificationRead(id);
        } catch (error) {
          console.error('Backend markNotificationRead failed, falling back to mock:', error);
          return mockApi.markNotificationRead(id);
        }
      }
    }
    return mockApi.markNotificationRead(id);
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    const client = await getApiClient();
    if (client) {
      try {
        // Calculate stats from backend data
        const [documents, workflows, actions] = await Promise.all([
          client.getFiles().catch(() => []),
          client.getWorkflows().catch(() => []),
          client.getActions().catch(() => []),
        ]);

        // Calculate storage used (if we track file sizes)
        const storageUsed = 0; // TODO: Calculate from actual file sizes when available

        return {
          totalDocuments: documents?.length || 0,
          activeWorkflows: workflows?.filter((w: any) => 
            w.status !== "completed" && w.status !== "cancelled"
          ).length || 0,
          pendingActions: actions?.filter((a: any) => 
            a.status === "pending"
          ).length || 0,
          storageUsed,
        };
      } catch (error) {
        console.error('Backend getDashboardStats failed, falling back to mock:', error);
        return mockApi.getDashboardStats();
      }
    }
    return mockApi.getDashboardStats();
  },
};
