"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

interface MockDataContextType {
  currentUser: any;
  users: any[];
  companies: any[];
  documents: any[];
  folders: any[];
  workflows: any[];
  actions: any[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const MockDataContext = createContext<MockDataContextType | undefined>(undefined);

export function MockDataProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[Context] Loading data...');
      const [user, usersData, companiesData, docsData, foldersData, workflowsData, actionsData] = await Promise.all([
        api.getCurrentUser(),
        api.getUsers(),
        api.getCompanies(),
        api.getDocuments(),
        api.getFolders(),
        api.getWorkflows(),
        api.getActions(),
      ]);
      
      console.log('[Context] Data loaded:', {
        user: user?.email || 'none',
        users: usersData?.length || 0,
        companies: companiesData?.length || 0,
        documents: docsData?.length || 0,
        folders: foldersData?.length || 0,
        workflows: workflowsData?.length || 0,
        actions: actionsData?.length || 0,
      });
      
      console.log('[Context] Documents sample:', docsData?.slice(0, 2));
      console.log('[Context] Folders sample:', foldersData?.slice(0, 2));
      
      setCurrentUser(user);
      setUsers(usersData || []);
      setCompanies(companiesData || []);
      setDocuments(docsData || []);
      setFolders(foldersData || []);
      setWorkflows(workflowsData || []);
      setActions(actionsData || []);
      
      console.log('[Context] State updated');
    } catch (error) {
      console.error("[Context] Failed to load mock data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload when route changes (e.g., after login redirect)
  useEffect(() => {
    if (pathname && pathname.startsWith("/dashboard")) {
      loadData();
    }
  }, [pathname, loadData]);

  // Listen for localStorage changes (when user logs in/out in other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "mockCurrentUser" || e.key === "mockAuth") {
        loadData();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadData]);

  // Listen for custom event (triggered from login in same tab)
  useEffect(() => {
    const handleUserChange = () => {
      loadData();
    };

    window.addEventListener("mockUserChanged", handleUserChange);
    return () => {
      window.removeEventListener("mockUserChanged", handleUserChange);
    };
  }, [loadData]);

  return (
    <MockDataContext.Provider
      value={{
        currentUser,
        users,
        companies,
        documents,
        folders,
        workflows,
        actions,
        loading,
        refresh: loadData,
      }}
    >
      {children}
    </MockDataContext.Provider>
  );
}

export function useMockData() {
  const context = useContext(MockDataContext);
  if (context === undefined) {
    throw new Error("useMockData must be used within MockDataProvider");
  }
  return context;
}
