/**
 * API Client for making HTTP requests to the backend
 */

/**
 * An error carrying the HTTP status, so callers can tell "you may not do this"
 * (403) apart from "you are signed out" (401) and from a transport failure.
 * Previously every failure collapsed into a generic Error and the UI could only
 * report "something went wrong".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  /** The signed-in user is not allowed to perform this action. */
  get isForbidden() {
    return this.status === 403;
  }

  /** No valid session — the token is missing, expired or rejected. */
  get isUnauthorized() {
    return this.status === 401;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

/** Notified whenever the API rejects a request for permission reasons. */
type AuthFailureHandler = (error: ApiError) => void;

let authFailureHandler: AuthFailureHandler | null = null;
/** Prevents a burst of 401s from stacking redirects / toasts. */
let sessionExpiryHandled = false;

/**
 * Register a single place to react to 401/403 responses — see
 * `components/common/ApiErrorListener.tsx`. Kept out of the client itself so
 * this module stays free of React and toast dependencies.
 */
export function onAuthFailure(handler: AuthFailureHandler | null) {
  authFailureHandler = handler;
  if (handler) {
    // New listener (e.g. remount after login) may handle a fresh expiry.
    sessionExpiryHandled = false;
  }
}

const CSRF_STORAGE_KEY = "dt_csrf_token";

/** In-memory CSRF fallback when document.cookie cannot see dt_csrf (cross-origin). */
let csrfTokenMemory: string | null = null;

function persistCsrfToken(token: string | null) {
  csrfTokenMemory = token;
  if (typeof window === "undefined") return;
  try {
    if (token) {
      sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(CSRF_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

function readStoredCsrfToken(): string | null {
  if (csrfTokenMemory) return csrfTokenMemory;
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(CSRF_STORAGE_KEY);
    if (stored) {
      csrfTokenMemory = stored;
      return stored;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Clear client-side auth leftovers. Cookies are cleared by /auth/logout. */
export function clearClientSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("sessionUser");
    localStorage.removeItem("mockCurrentUser");
    localStorage.removeItem("mockAuth");
  } catch {
    // ignore
  }
  persistCsrfToken(null);
}

/**
 * Read CSRF token: prefer first-party dt_csrf cookie, then body/session fallback.
 */
function getCSRFToken(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(/dt_csrf=([^;]+)/);
  if (match) {
    const fromCookie = decodeURIComponent(match[1]);
    persistCsrfToken(fromCookie);
    return fromCookie;
  }

  return readStoredCsrfToken();
}

/**
 * Check if method is mutating (requires CSRF token)
 */
function isMutatingMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  /** Shared across concurrent 401s so only one refresh is issued. */
  private refreshInFlight: Promise<any> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    console.log('[API Client] Initializing with baseURL:', baseURL);
    // Only access localStorage on client side to avoid hydration issues
    if (typeof window !== 'undefined') {
      try {
        // Keep existing token loading for backward compatibility during migration
        this.token = localStorage.getItem('authToken') || localStorage.getItem('access_token');
        console.log('[API Client] Token loaded:', this.token ? 'exists' : 'not found');
      } catch (error) {
        // localStorage might not be available
        this.token = null;
        console.error('[API Client] Error loading token:', error);
      }
    }
  }

  /**
   * Make a request, refreshing the access token once if it has expired.
   *
   * Access tokens last 15 minutes. On 401 we refresh silently and retry —
   * we must NOT notify the auth-failure handler until refresh has failed,
   * otherwise the UI logs the user out while they are still working.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    try {
      return await this.rawRequest<T>(endpoint, options);
    } catch (error) {
      const canRetry =
        error instanceof ApiError &&
        error.isUnauthorized &&
        !endpoint.startsWith('/auth/');

      if (!canRetry) {
        this.notifyAuthFailure(error);
        throw error;
      }

      try {
        await this.ensureFreshSession();
      } catch {
        this.notifyAuthFailure(error);
        throw error;
      }

      try {
        return await this.rawRequest<T>(endpoint, options);
      } catch (retryError) {
        this.notifyAuthFailure(retryError);
        throw retryError;
      }
    }
  }

  /** Refresh the access cookie if needed; coalesces parallel callers. */
  async ensureFreshSession(): Promise<void> {
    this.refreshInFlight ??= this.rawRequest<{
      access_token?: string;
      csrfToken?: string;
    }>('/auth/refresh', {
      method: 'POST',
    })
      .then((result) => {
        if (result?.access_token) {
          this.setToken(result.access_token);
        }
        if (result?.csrfToken) {
          persistCsrfToken(result.csrfToken);
        }
        return result;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });
    await this.refreshInFlight;
  }

  private notifyAuthFailure(error: unknown) {
    if (!(error instanceof ApiError)) return;

    // 403 = signed in but not allowed — toast only, stay on page.
    if (error.isForbidden) {
      authFailureHandler?.(error);
      return;
    }

    if (!error.isUnauthorized) return;

    // Session is dead (refresh already failed, or this was an auth call).
    if (sessionExpiryHandled) return;
    sessionExpiryHandled = true;
    clearClientSession();
    this.setToken(null);
    authFailureHandler?.(error);
  }

  private async rawRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    console.log('[API Client] Making request:', method, url);
    
    const headers: Record<string, string> = {};

    // Only set Content-Type for JSON, not for FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add CSRF token for mutating requests
    if (isMutatingMethod(method)) {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
        console.log('[API Client] Added CSRF token');
      } else {
        console.warn('[API Client] No CSRF token available for mutating request');
      }
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

    // Add Authorization header for backward compatibility (cookies are primary now)
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log('[API Client] Using auth token');
    } else {
      console.log('[API Client] Using cookie-based auth');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Always include cookies
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
          console.warn('[API Client] Failed to parse error response:', e);
          error = { message: `HTTP error! status: ${response.status}` };
        }

        const message = Array.isArray(error?.message)
          ? error.message.join(', ')
          : error?.message || error?.error || `Request failed (HTTP ${response.status})`;

        // Expected auth/permission failures are handled by callers / ApiErrorListener.
        // Logging them with console.error makes Next.js treat them as "Issues".
        if (response.status === 401 || response.status === 403) {
          console.warn('[API Client] Request rejected:', response.status, method, endpoint, message);
        } else {
          console.error('[API Client] Request failed:', {
            status: response.status,
            statusText: response.statusText,
            url: url,
            error: error,
          });
        }

        // Do not call authFailureHandler here — `request()` refreshes on 401
        // first. Premature logout was kicking users out mid-work.
        throw new ApiError(response.status, message, error);
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
      if (error instanceof ApiError) throw error;
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
        // Clear all localStorage auth data when logging out
        localStorage.removeItem('authToken');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user'); // Clear any stored user data
        localStorage.removeItem('sessionUser'); // Alternative user storage
      }
    }
  }

  // Auth
  async login(email: string, password: string, rememberMe = false) {
    const result = await this.request<{ access_token: string; user: any; csrfToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });

    // Cookies (via same-origin /api-backend proxy) are primary for REST.
    // Keep access_token for WebSocket handshake — WS still hits Railway
    // directly and cannot read first-party Vercel cookies.
    if (result?.access_token) {
      this.setToken(result.access_token);
    } else {
      this.setToken(null);
    }
    if (result?.csrfToken) {
      persistCsrfToken(result.csrfToken);
    }

    console.log('[API Client] Login successful, using cookie-based auth');
    return result;
  }

  /**
   * Refresh access token using refresh token cookie
   */
  async refreshToken() {
    try {
      await this.ensureFreshSession();
      // A successful refresh means we are authenticated again.
      sessionExpiryHandled = false;
      console.log('[API Client] Token refreshed');
    } catch (error) {
      this.notifyAuthFailure(error);
      throw error;
    }
  }

  /**
   * Logout - clear cookies and local state
   */
  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.warn('[API Client] Logout request failed:', error);
    }

    clearClientSession();
    this.setToken(null);
    persistCsrfToken(null);
    sessionExpiryHandled = false;
    console.log('[API Client] Logged out');
  }

  /**
   * Get current CSRF token
   */
  async getCSRFToken() {
    const result = await this.request<{ csrfToken: string }>('/auth/csrf');
    if (result?.csrfToken) {
      persistCsrfToken(result.csrfToken);
    }
    return result;
  }

  /**
   * Register new user account
   */
  async register(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    return this.request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
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

  async inviteUser(data: {
    email: string;
    role: string;
    departmentId?: string;
    divisionId?: string;
    sendEmail?: boolean;
  }) {
    return this.request<any>('/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createUser(data: {
    email: string;
    name: string;
    role: string;
    departmentId?: string;
    divisionId?: string;
  }) {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: {
    name?: string;
    email?: string;
    role?: string;
    departmentId?: string;
    divisionId?: string;
  }) {
    return this.request<any>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateOwnProfile(data: { name?: string; phone?: string }) {
    return this.request<any>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deactivateUser(id: string) {
    return this.request<any>(`/users/${id}/deactivate`, {
      method: 'PATCH',
    });
  }

  // Companies
  async getCompanies() {
    return this.request<any[]>('/companies');
  }

  async getCompany(id: string) {
    return this.request<any>(`/companies/${id}`);
  }

  async createCompany(data: {
    name: string;
    description?: string;
    address?: string;
  }) {
    return this.request<any>('/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCompany(id: string, data: {
    name?: string;
    description?: string;
    address?: string;
  }) {
    return this.request<any>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  async setWorkflowEndPoint(id: string, dueDate: string | null) {
    return this.request<any>(`/workflows/${id}/end-point`, {
      method: 'PUT',
      body: JSON.stringify({ dueDate }),
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

  async getWorkflowFiles(workflowId: string) {
    return this.request<any[]>(`/workflows/${workflowId}/files`);
  }

  async attachFileToWorkflow(
    workflowId: string,
    data: { fileId: string; actionId?: string; note?: string },
  ) {
    return this.request<any>(`/workflows/${workflowId}/files`, {
      method: 'POST',
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
  async getFiles(companyId?: string, includeArchived?: boolean, includeDeleted?: boolean) {
    const params = new URLSearchParams();
    if (companyId) params.append('companyId', companyId);
    if (includeArchived !== undefined) params.append('includeArchived', includeArchived.toString());
    if (includeDeleted !== undefined) params.append('includeDeleted', includeDeleted.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    console.log('[API Client] getFiles called, URL:', `/files${query}`);
    const result = await this.request<any[]>(`/files${query}`);
    console.log('[API Client] getFiles result:', result?.length || 0, 'files');
    return result;
  }

  async getFile(id: string) {
    return this.request<any>(`/files/${id}`);
  }

  async searchFiles(query: string, skip?: number, take?: number) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (skip !== undefined) params.append('skip', skip.toString());
    if (take !== undefined) params.append('take', take.toString());
    return this.request<{items: any[], total: number}>(`/files/search?${params.toString()}`);
  }

  // Tags
  async getTags(companyId?: string) {
    const params = companyId ? `?companyId=${companyId}` : '';
    return this.request<any[]>(`/tags${params}`);
  }

  async createTag(name: string) {
    return this.request<any>('/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getFileTags(fileId: string) {
    return this.request<any[]>(`/tags/files/${fileId}`);
  }

  async updateFileTags(fileId: string, tagIds: string[]) {
    return this.request<any[]>(`/tags/files/${fileId}`, {
      method: 'POST',
      body: JSON.stringify({ tagIds }),
    });
  }

  // Signatures
  async createSignatureRequest(fileId: string, participants: Array<{email: string, name: string, signingOrder: number, userId?: string}>) {
    return this.request<any>('/signatures/requests', {
      method: 'POST',
      body: JSON.stringify({ fileId, participants }),
    });
  }

  async getSignatureRequest(requestId: string) {
    return this.request<any>(`/signatures/requests/${requestId}`);
  }

  async signDocument(
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
  ) {
    return this.request<any>(`/signatures/requests/${requestId}/participants/${participantId}/sign`, {
      method: 'POST',
      body: JSON.stringify({
        signatureImageData,
        savedSignatureId,
        placement,
      }),
    });
  }

  async getFileSignatureRequests(fileId: string) {
    return this.request<any[]>(`/signatures/requests/file/${fileId}`);
  }

  async listSavedSignatures() {
    return this.request<
      Array<{
        id: string;
        label: string;
        imageData: string;
        isDefault: boolean;
        createdAt: string;
        updatedAt: string;
      }>
    >('/signatures/saved');
  }

  async createSavedSignature(data: {
    label: string;
    imageData: string;
    isDefault?: boolean;
  }) {
    return this.request<any>('/signatures/saved', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSavedSignature(
    id: string,
    data: { label?: string; imageData?: string; isDefault?: boolean },
  ) {
    return this.request<any>(`/signatures/saved/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSavedSignature(id: string) {
    return this.request<{ ok: boolean }>(`/signatures/saved/${id}`, {
      method: 'DELETE',
    });
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
    /** Required when creating as Master (no company on the user). */
    companyId?: string;
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
    companyId?: string;
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

  async uploadFileVersion(
    fileId: string,
    file: File | Blob,
    fileName?: string,
    changeNote?: string,
  ) {
    const formData = new FormData();
    const name =
      fileName ||
      (file instanceof File && file.name ? file.name : 'upload');
    formData.append('file', file, name);
    if (changeNote?.trim()) {
      formData.append('changeNote', changeNote.trim());
    }

    return this.request<any>(`/files/${fileId}/versions`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type — browser sets multipart boundary
      headers: {},
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

  async updateFilePermissions(
    fileId: string,
    folderId: string,
    permissions: any,
    onRevoke?: 'leave' | 'flag',
  ) {
    return this.request<any>(`/permissions/file/${fileId}?folderId=${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, onRevoke }),
    });
  }

  async updateFolderPermissions(
    folderId: string,
    permissions: any,
    onRevoke?: 'leave' | 'flag',
  ) {
    return this.request<any>(`/permissions/folder/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, onRevoke }),
    });
  }

  /** The caller's own resolved capabilities and data scope. */
  async getMyPermissions() {
    return this.request<any>('/permissions/me');
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
      /** Required when uploading as Master (no company on the user). */
      companyId?: string;
      /** Display name; the real extension is kept by the server. */
      fileName?: string;
    },
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scopeLevel', data.scopeLevel);
    if (data.fileName) formData.append('fileName', data.fileName);
    if (data.folderId) formData.append('folderId', data.folderId);
    if (data.departmentId) formData.append('departmentId', data.departmentId);
    if (data.divisionId) formData.append('divisionId', data.divisionId);
    if (data.companyId) formData.append('companyId', data.companyId);

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

  // File Operations
  /**
   * Fetch a file as a Blob (authenticated). Caller must revoke any object URL
   * created from the result.
   */
  async getDocumentBlob(fileId: string): Promise<{ blob: Blob; contentType: string; fileName?: string }> {
    const doFetch = () =>
      fetch(`${this.baseURL}/files/${fileId}/download`, {
        credentials: 'include',
        headers: {
          'X-CSRF-Token': getCSRFToken() || '',
        },
      });

    let response = await doFetch();
    if (response.status === 401) {
      try {
        await this.ensureFreshSession();
        response = await doFetch();
      } catch {
        const err = new ApiError(401, 'Failed to load document');
        this.notifyAuthFailure(err);
        throw err;
      }
    }

    if (!response.ok) {
      let detail = 'Failed to load document';
      try {
        const body = await response.json();
        if (body?.message) {
          detail = Array.isArray(body.message)
            ? body.message.join(', ')
            : String(body.message);
        }
      } catch {
        // non-JSON error body
      }
      const err = new ApiError(response.status, detail);
      this.notifyAuthFailure(err);
      throw err;
    }

    const blob = await response.blob();
    const contentType =
      response.headers.get('content-type') || blob.type || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition');
    const fileName = contentDisposition
      ?.split('filename=')[1]
      ?.replace(/"/g, '')
      ?.trim();

    return { blob, contentType, fileName };
  }

  async downloadDocument(fileId: string): Promise<void> {
    const { blob, fileName } = await this.getDocumentBlob(fileId);
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.style.display = 'none';
    if (fileName) {
      link.download = fileName;
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }

  async downloadFileVersion(fileId: string, versionId: string): Promise<void> {
    const doFetch = () =>
      fetch(`${this.baseURL}/files/${fileId}/versions/${versionId}/download`, {
        credentials: 'include',
        headers: {
          'X-CSRF-Token': getCSRFToken() || '',
        },
      });

    let response = await doFetch();
    if (response.status === 401) {
      try {
        await this.ensureFreshSession();
        response = await doFetch();
      } catch {
        const err = new ApiError(401, 'Failed to download version');
        this.notifyAuthFailure(err);
        throw err;
      }
    }

    if (!response.ok) {
      const err = new ApiError(response.status, 'Failed to download version');
      this.notifyAuthFailure(err);
      throw err;
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const contentDisposition = response.headers.get('content-disposition');
    const fileName = contentDisposition
      ?.split('filename=')[1]
      ?.replace(/"/g, '')
      ?.trim();

    const link = document.createElement('a');
    link.href = blobUrl;
    link.style.display = 'none';
    if (fileName) link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }

  async renameDocument(fileId: string, fileName: string) {
    return this.request<any>(`/files/${fileId}/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ fileName }),
    });
  }

  async archiveDocument(fileId: string) {
    return this.request<any>(`/files/${fileId}/archive`, {
      method: 'POST',
    });
  }

  async unarchiveDocument(fileId: string) {
    return this.request<any>(`/files/${fileId}/unarchive`, {
      method: 'POST',
    });
  }

  async deleteDocument(fileId: string) {
    return this.request<any>(`/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  async restoreDocument(fileId: string) {
    return this.request<any>(`/files/${fileId}/restore`, {
      method: 'POST',
    });
  }

  async moveDocument(fileId: string, folderId: string) {
    return this.request<any>(`/files/${fileId}/move`, {
      method: 'POST',
      body: JSON.stringify({ folderId }),
    });
  }

  // Folder Operations
  async updateFolder(folderId: string, data: { name?: string; description?: string }) {
    return this.request<any>(`/files/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async archiveFolder(folderId: string) {
    return this.request<any>(`/files/folders/${folderId}/archive`, {
      method: 'POST',
    });
  }

  async deleteFolder(folderId: string) {
    return this.request<any>(`/files/folders/${folderId}`, {
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
    // Relative `/api-backend` (Vercel rewrite) or absolute local/Railway URL.
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003';
    apiClientInstance = new ApiClient(API_BASE_URL.replace(/\/$/, ''));
  }
  
  return apiClientInstance;
};
