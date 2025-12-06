import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useActions() {
  return useQuery({
    queryKey: ["actions"],
    queryFn: async () => {
      try {
        return await api.getActions();
      } catch (error: any) {
        console.error("Error fetching actions:", error);
        // Return empty array instead of throwing to prevent panic
        return [];
      }
    },
  });
}

export function useAction(id: string) {
  return useQuery({
    queryKey: ["actions", id],
    queryFn: async () => {
      try {
        return await api.getAction(id);
      } catch (error: any) {
        console.error("Error fetching action:", error);
        throw error; // Re-throw for individual action queries
      }
    },
    enabled: !!id,
  });
}

export function useActionsByWorkflow(workflowId: string) {
  return useQuery({
    queryKey: ["actions", "workflow", workflowId],
    queryFn: async () => {
      const allActions = await api.getActions();
      return allActions.filter((action: any) => action.workflowId === workflowId);
    },
    enabled: !!workflowId,
  });
}

export function useCreateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return await api.createAction(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      toast.success("Action created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create action");
    },
  });
}

export function useUpdateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await api.updateAction(id, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["actions", variables.id] });
      // Invalidate workflow actions if action has workflowId
      if (variables.data?.workflowId) {
        queryClient.invalidateQueries({
          queryKey: ["actions", "workflow", variables.data.workflowId],
        });
      }
      toast.success("Action updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update action");
    },
  });
}
