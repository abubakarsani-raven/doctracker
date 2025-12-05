/**
 * Mock API Service
 * Provides mock data for frontend development without backend
 */

import mockDataRaw from "./mock-data.json";

// Parse dates in mock data
const parseDates = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(parseDates);
  }
  if (data && typeof data === "object") {
    const parsed: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        parsed[key] = new Date(value);
      } else if (typeof value === "object" && value !== null) {
        parsed[key] = parseDates(value);
      } else {
        parsed[key] = value;
      }
    }
    return parsed;
  }
  return data;
};

const mockData = parseDates(mockDataRaw);

// Simulate API delay
const delay = (ms: number = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// Store for modifications (persists during session)
let dataStore = { ...mockData };

export const mockApi = {
  // Users
  async getUsers() {
    await delay();
    return dataStore.users;
  },

  async getUser(id: string) {
    await delay();
    return dataStore.users.find((u: any) => u.id === id) || null;
  },

  async getCurrentUser() {
    await delay();
    // Check localStorage for persisted user (from login)
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("mockCurrentUser") : null;
    if (storedUser) {
      const user = JSON.parse(storedUser);
      // Update dataStore to match
      dataStore.currentUser = user;
      return user;
    }
    return dataStore.currentUser;
  },

  // Companies
  async getCompanies() {
    await delay();
    return dataStore.companies;
  },

  async getCompany(id: string) {
    await delay();
    return dataStore.companies.find((c: any) => c.id === id) || null;
  },

  // Documents & Folders
  async getFolders(parentId?: string) {
    await delay();
    if (parentId !== undefined) {
      if (parentId) {
        return dataStore.folders.filter((f: any) => f.parentFolderId === parentId);
      }
      // If parentId is explicitly null/empty, return root folders only
      return dataStore.folders.filter((f: any) => !f.parentFolderId);
    }
    // If no parentId provided, return ALL folders (needed for permission filtering)
    return dataStore.folders;
  },

  async getFolder(id: string) {
    await delay();
    return dataStore.folders.find((f: any) => f.id === id) || null;
  },

  async getDocuments(folderId?: string) {
    await delay();
    if (folderId) {
      return dataStore.documents.filter((d: any) => d.folderId === folderId);
    }
    return dataStore.documents;
  },

  async getDocument(id: string) {
    await delay();
    return dataStore.documents.find((d: any) => d.id === id) || null;
  },

  async searchDocuments(query: string) {
    await delay();
    const lowerQuery = query.toLowerCase();
    return dataStore.documents.filter((d: any) =>
      d.name.toLowerCase().includes(lowerQuery) ||
      d.description?.toLowerCase().includes(lowerQuery) ||
      d.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
    );
  },

  // Workflows
  async getWorkflows() {
    await delay();
    return dataStore.workflows;
  },

  async getWorkflow(id: string) {
    await delay();
    return dataStore.workflows.find((w: any) => w.id === id) || null;
  },

  // Actions
  async getActions() {
    await delay();
    return dataStore.actions;
  },

  async getAction(id: string) {
    await delay();
    return dataStore.actions.find((a: any) => a.id === id) || null;
  },

  // External Documents
  async getExternalDocuments() {
    await delay();
    return dataStore.externalDocuments;
  },

  // Templates
  async getTemplates() {
    await delay();
    return dataStore.templates;
  },

  // Archived
  async getArchivedDocuments() {
    await delay();
    return dataStore.archivedDocuments;
  },

  // Notifications
  async getNotifications() {
    await delay();
    return dataStore.notifications.filter((n: any) => !n.read);
  },

  async getAllNotifications() {
    await delay();
    return dataStore.notifications;
  },

  async markNotificationRead(id: string) {
    await delay();
    const notification = dataStore.notifications.find((n: any) => n.id === id);
    if (notification) {
      notification.read = true;
    }
    return notification;
  },

  // Dashboard Stats
  async getDashboardStats() {
    await delay();
    return {
      totalDocuments: dataStore.documents.length,
      activeWorkflows: dataStore.workflows.filter((w: any) => w.status !== "completed").length,
      pendingActions: dataStore.actions.filter((a: any) => a.status === "pending").length,
      storageUsed: dataStore.documents.reduce((sum: number, d: any) => sum + d.size, 0),
      storageTotal: 60000000000, // 60 GB
    };
  },

  // Auth (mock - finds user by email and sets as currentUser)
  async login(email: string, password: string) {
    await delay(500);
    // Mock: Accept any password, but find user by email
    const user = dataStore.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error("Invalid email or password");
    }
    
    // Set the logged-in user as currentUser
    const currentUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      division: user.division,
    };
    
    dataStore.currentUser = currentUser;
    
    // Persist to localStorage for session persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("mockCurrentUser", JSON.stringify(currentUser));
    }
    
    return {
      user: currentUser,
      token: "mock-jwt-token",
    };
  },
};

// Helper to check if we're using mock data
export const USE_MOCK_DATA = true; // Set to false when backend is ready
