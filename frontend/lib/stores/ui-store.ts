import { create } from "zustand";

interface UIState {
  // Dialog states
  createWorkflowDialogOpen: boolean;
  createActionDialogOpen: boolean;
  setCreateWorkflowDialogOpen: (open: boolean) => void;
  setCreateActionDialogOpen: (open: boolean) => void;

  // Filter/search states
  workflowSearchQuery: string;
  workflowStatusFilter: string;
  setWorkflowSearchQuery: (query: string) => void;
  setWorkflowStatusFilter: (filter: string) => void;

  actionSearchQuery: string;
  actionStatusFilter: string;
  setActionSearchQuery: (query: string) => void;
  setActionStatusFilter: (filter: string) => void;

  documentSearchQuery: string;
  documentScopeFilter: string;
  setDocumentSearchQuery: (query: string) => void;
  setDocumentScopeFilter: (filter: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Dialog states
  createWorkflowDialogOpen: false,
  createActionDialogOpen: false,
  setCreateWorkflowDialogOpen: (open) => set({ createWorkflowDialogOpen: open }),
  setCreateActionDialogOpen: (open) => set({ createActionDialogOpen: open }),

  // Workflow filters
  workflowSearchQuery: "",
  workflowStatusFilter: "all",
  setWorkflowSearchQuery: (query) => set({ workflowSearchQuery: query }),
  setWorkflowStatusFilter: (filter) => set({ workflowStatusFilter: filter }),

  // Action filters
  actionSearchQuery: "",
  actionStatusFilter: "all",
  setActionSearchQuery: (query) => set({ actionSearchQuery: query }),
  setActionStatusFilter: (filter) => set({ actionStatusFilter: filter }),
  createActionDialogOpen: false,
  setCreateActionDialogOpen: (open) => set({ createActionDialogOpen: open }),

  // Document filters
  documentSearchQuery: "",
  documentScopeFilter: "all",
  setDocumentSearchQuery: (query) => set({ documentSearchQuery: query }),
  setDocumentScopeFilter: (filter) => set({ documentScopeFilter: filter }),
}));
