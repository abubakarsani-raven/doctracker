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
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

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
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        console.error('[API Client] Request failed:', error);
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[API Client] Request successful, data length:', Array.isArray(data) ? data.length : 'N/A');
      return data;
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
