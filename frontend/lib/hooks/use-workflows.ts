import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      try {
        return await api.getWorkflows();
      } catch (error: any) {
        console.error("Error fetching workflows:", error);
        // Return empty array instead of throwing to prevent panic
        return [];
      }
    },
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ["workflows", id],
    queryFn: async () => {
      return await api.getWorkflow(id);
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return await api.createWorkflow(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      // Invalidate folder and document workflow queries if applicable
      if (variables.folderId) {
        queryClient.invalidateQueries({ queryKey: ["workflows", "folder", variables.folderId] });
      }
      if (variables.documentId) {
        queryClient.invalidateQueries({ queryKey: ["workflows", "document", variables.documentId] });
      }
      toast.success("Workflow created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create workflow");
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await api.updateWorkflow(id, data);
    },
    onSuccess: async (updatedWorkflow, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflows", variables.id] });
      
      // Invalidate folder and document workflow queries if workflow has folderId or documentId
      if (updatedWorkflow?.folderId) {
        queryClient.invalidateQueries({ queryKey: ["workflows", "folder", updatedWorkflow.folderId] });
      }
      if (updatedWorkflow?.documentId) {
        queryClient.invalidateQueries({ queryKey: ["workflows", "document", updatedWorkflow.documentId] });
      }
      
      toast.success("Workflow updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update workflow");
    },
  });
}

export function useWorkflowsByFolder(folderId: string) {
  return useQuery({
    queryKey: ["workflows", "folder", folderId],
    queryFn: async () => {
      return await api.getWorkflowsByFolder(folderId);
    },
    enabled: !!folderId,
  });
}

export function useWorkflowsByDocument(documentId: string) {
  return useQuery({
    queryKey: ["workflows", "document", documentId],
    queryFn: async () => {
      return await api.getWorkflowsByDocument(documentId);
    },
    enabled: !!documentId,
  });
}
