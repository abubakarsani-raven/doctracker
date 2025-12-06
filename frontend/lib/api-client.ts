/**
 * API Client for making HTTP requests to the backend
 */

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    console.log('[API Client] Initializing with baseURL:', baseURL);
    // Only access localStorage on client side to avoid hydration issues
    if (typeof window !== 'undefined') {
      try {
        // Check for both authToken and access_token (for compatibility)
        this.token = localStorage.getItem('authToken') || localStorage.getItem('access_token');
        console.log('[API Client] Token loaded:', this.token ? 'exists' : 'not found');
      } catch (error) {
        // localStorage might not be available
        this.token = null;
        console.error('[API Client] Error loading token:', error);
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    console.log('[API Client] Making request:', options.method || 'GET', url);
    
    const headers: Record<string, string> = {};

    // Only set Content-Type for JSON, not for FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Merge existing headers if provided
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log('[API Client] Using auth token');
    } else {
      console.warn('[API Client] No auth token available');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('[API Client] Response status:', response.status, response.statusText);

      if (!response.ok) {
        let error: any = { message: 'Request failed' };
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            error = await response.json();
          } else {
            const text = await response.text();
            error = { message: text || `HTTP error! status: ${response.status}` };
          }
        } catch (e) {
          console.error('[API Client] Failed to parse error response:', e);
          error = { message: `HTTP error! status: ${response.status}` };
        }
        console.error('[API Client] Request failed:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          error: error,
        });
        throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
      }

      // Handle response based on content type
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('[API Client] Request successful, data length:', Array.isArray(data) ? data.length : 'N/A');
        return data;
      } else {
        // For non-JSON responses (e.g., file uploads), return text or blob
        const text = await response.text();
        try {
          // Try to parse as JSON if possible
          return JSON.parse(text) as T;
        } catch {
          return text as T;
        }
      }
    } catch (error) {
      console.error('[API Client] Request error:', error);
      throw error;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        // Store in both places for compatibility
        localStorage.setItem('authToken', token);
        localStorage.setItem('access_token', token);
      } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('access_token');
      }
    }
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.access_token);
    return result;
  }

  // Users
  async getUsers() {
    return this.request<any[]>('/users');
  }

  async getUser(id: string) {
    return this.request<any>(`/users/${id}`);
  }

  async getCurrentUser() {
    return this.request<any>('/users/me');
  }

  // Companies
  async getCompanies() {
    return this.request<any[]>('/companies');
  }

  async getCompany(id: string) {
    return this.request<any>(`/companies/${id}`);
  }

  // Workflows
  async getWorkflows() {
    return this.request<any[]>('/workflows');
  }

  async getWorkflow(id: string) {
    return this.request<any>(`/workflows/${id}`);
  }

  async getWorkflowsByFolder(folderId: string) {
    return this.request<any[]>(`/workflows/folder/${folderId}`);
  }

  async getWorkflowsByDocument(documentId: string) {
    return this.request<any[]>(`/workflows/document/${documentId}`);
  }

  async createWorkflow(data: any) {
    return this.request<any>('/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(id: string, data: any) {
    return this.request<any>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Goals
  async getWorkflowGoals(workflowId: string) {
    return this.request<any[]>(`/workflows/${workflowId}/goals`);
  }

  async createWorkflowGoal(workflowId: string, data: any) {
    return this.request<any>(`/workflows/${workflowId}/goals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkflowGoal(goalId: string, data: any) {
    return this.request<any>(`/workflows/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async achieveWorkflowGoal(goalId: string, notes?: string) {
    return this.request<any>(`/workflows/goals/${goalId}/achieve`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
  }

  async deleteWorkflowGoal(goalId: string) {
    return this.request<any>(`/workflows/goals/${goalId}/delete`, {
      method: 'POST',
    });
  }

  async getMyGoals() {
    return this.request<any[]>('/workflows/goals/my-goals');
  }

  // Actions
  async getActions() {
    return this.request<any[]>('/actions');
  }

  async getAction(id: string) {
    return this.request<any>(`/actions/${id}`);
  }

  async createAction(data: any) {
    return this.request<any>('/actions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAction(id: string, data: any) {
    return this.request<any>(`/actions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Files & Folders
  async getFiles(companyId?: string) {
    const query = companyId ? `?companyId=${companyId}` : '';
    console.log('[API Client] getFiles called, URL:', `/files${query}`);
    const result = await this.request<any[]>(`/files${query}`);
    console.log('[API Client] getFiles result:', result?.length || 0, 'files');
    return result;
  }

  async getFile(id: string) {
    return this.request<any>(`/files/${id}`);
  }

  async getFolders(companyId?: string, parentId?: string) {
    const params = new URLSearchParams();
    if (companyId) params.append('companyId', companyId);
    if (parentId !== undefined) params.append('parentId', parentId || '');
    const query = params.toString() ? `?${params.toString()}` : '';
    console.log('[API Client] getFolders called, URL:', `/files/folders${query}`);
    const result = await this.request<any[]>(`/files/folders${query}`);
    console.log('[API Client] getFolders result:', result?.length || 0, 'folders');
    return result;
  }

  async getFolder(id: string) {
    return this.request<any>(`/files/folders/${id}`);
  }

  async createFolder(data: {
    name: string;
    description?: string;
    scopeLevel: string;
    parentFolderId?: string;
    departmentId?: string;
    divisionId?: string;
  }) {
    return this.request<any>('/files/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createFile(data: {
    fileName: string;
    fileType: string;
    scopeLevel: string;
    folderId?: string;
    departmentId?: string;
    divisionId?: string;
  }) {
    return this.request<any>('/files', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createRichTextDocument(data: {
    fileName: string;
    htmlContent: string;
    scopeLevel: string;
    folderId: string;
    departmentId?: string;
    divisionId?: string;
  }) {
    return this.request<any>('/files/rich-text', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRichTextDocument(fileId: string, htmlContent: string) {
    return this.request<any>(`/files/rich-text/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify({ htmlContent }),
    });
  }

  async getFileVersions(fileId: string) {
    return this.request<any[]>(`/files/${fileId}/versions`);
  }

  async uploadFileVersion(fileId: string, data: {
    storagePath: string;
    fileName: string;
    fileType: string;
  }) {
    return this.request<any>(`/files/${fileId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async restoreFileVersion(fileId: string, versionId: string) {
    return this.request<any>(`/files/${fileId}/versions/${versionId}/restore`, {
      method: 'POST',
    });
  }

  // Notifications
  async getNotifications() {
    return this.request<any[]>('/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  // Access Requests
  async getAccessRequests() {
    return this.request<any[]>('/access-requests');
  }

  async getAccessRequest(id: string) {
    return this.request<any>(`/access-requests/${id}`);
  }

  async createAccessRequest(data: any) {
    return this.request<any>('/access-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccessRequest(id: string, data: any) {
    return this.request<any>(`/access-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccessRequest(id: string) {
    return this.request<any>(`/access-requests/${id}`, {
      method: 'DELETE',
    });
  }

  // Approval Requests
  async getApprovalRequests() {
    return this.request<any[]>('/approval-requests');
  }

  async getApprovalRequest(id: string) {
    return this.request<any>(`/approval-requests/${id}`);
  }

  async createApprovalRequest(data: any) {
    return this.request<any>('/approval-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateApprovalRequest(id: string, data: any) {
    return this.request<any>(`/approval-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteApprovalRequest(id: string) {
    return this.request<any>(`/approval-requests/${id}`, {
      method: 'DELETE',
    });
  }

  // Permissions
  async getFolderPermissions(folderId: string) {
    return this.request<any>(`/permissions/folder/${folderId}`);
  }

  async getFilePermissions(fileId: string, folderId?: string) {
    const url = folderId
      ? `/permissions/file/${fileId}?folderId=${folderId}`
      : `/permissions/file/${fileId}`;
    return this.request<any>(url);
  }

  async updateFilePermissions(fileId: string, folderId: string, permissions: any) {
    return this.request<any>(`/permissions/file/${fileId}?folderId=${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  async checkPermission(
    userId: string,
    resourceType: 'folder' | 'file',
    resourceId: string,
    permission: 'read' | 'write' | 'delete' | 'share' | 'manage',
  ) {
    return this.request<{ hasPermission: boolean }>(
      `/permissions/check?userId=${userId}&resourceType=${resourceType}&resourceId=${resourceId}&permission=${permission}`,
    );
  }

  // Storage
  async getCompanyStorage(companyId: string) {
    return this.request<{ bytes: number; formatted: string }>(`/storage/company/${companyId}`);
  }

  async getUserStorage() {
    return this.request<{ bytes: number; formatted: string }>('/storage/user');
  }

  async getStorageStats(companyId?: string) {
    const query = companyId ? `?companyId=${companyId}` : '';
    return this.request<{ bytes: number }>(`/storage/stats${query}`);
  }

  async getTotalStorage() {
    return this.request<{ bytes: number; formatted: string }>('/storage/total');
  }

  // Activity
  async getActivity(queryParams?: string) {
    const url = queryParams ? `/activity?${queryParams}` : '/activity';
    return this.request<any[]>(url);
  }

  async getRecentActivity(limit: number = 50) {
    return this.request<any[]>(`/activity/recent?limit=${limit}`);
  }

  // File Upload
  async uploadFile(
    file: File,
    data: {
      scopeLevel: string;
      folderId?: string;
      departmentId?: string;
      divisionId?: string;
    },
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scopeLevel', data.scopeLevel);
    if (data.folderId) formData.append('folderId', data.folderId);
    if (data.departmentId) formData.append('departmentId', data.departmentId);
    if (data.divisionId) formData.append('divisionId', data.divisionId);

    return this.request<any>('/files/upload', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
      headers: {},
    });
  }

  // Document Notes
  async getDocumentNotes(documentId: string) {
    return this.request<any[]>(`/document-notes/document/${documentId}`);
  }

  async createDocumentNote(documentId: string, data: { content: string; isPublic: boolean }) {
    return this.request<any>(`/document-notes/document/${documentId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDocumentNote(noteId: string, data: { content?: string; isPublic?: boolean }) {
    return this.request<any>(`/document-notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDocumentNote(noteId: string) {
    return this.request<any>(`/document-notes/${noteId}`, {
      method: 'DELETE',
    });
  }
}

// Create API client instance only on client side to avoid hydration issues
let apiClientInstance: ApiClient | null = null;

export const getApiClient = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!apiClientInstance) {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003';
    apiClientInstance = new ApiClient(API_BASE_URL);
  }
  
  return apiClientInstance;
};
