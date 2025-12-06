import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useWorkflowGoals(workflowId: string) {
  return useQuery({
    queryKey: ["workflows", workflowId, "goals"],
    queryFn: async () => {
      return await api.getWorkflowGoals(workflowId);
    },
    enabled: !!workflowId,
  });
}

export function useCreateWorkflowGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId, data }: { workflowId: string; data: any }) => {
      return await api.createWorkflowGoal(workflowId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflows", variables.workflowId, "goals"] });
      queryClient.invalidateQueries({ queryKey: ["workflows", variables.workflowId] });
      queryClient.invalidateQueries({ queryKey: ["my-goals"] });
      toast.success("Goal created successfully");
    },
  });
}

export function useUpdateWorkflowGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, data }: { goalId: string; data: any }) => {
      return await api.updateWorkflowGoal(goalId, data);
    },
    onSuccess: (data) => {
      const workflowId = data.workflow?.id;
      if (workflowId) {
        queryClient.invalidateQueries({ queryKey: ["workflows", workflowId, "goals"] });
        queryClient.invalidateQueries({ queryKey: ["workflows", workflowId] });
      }
      queryClient.invalidateQueries({ queryKey: ["my-goals"] });
      toast.success("Goal updated successfully");
    },
  });
}

export function useAchieveWorkflowGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, notes }: { goalId: string; notes?: string }) => {
      return await api.achieveWorkflowGoal(goalId, notes);
    },
    onSuccess: (data) => {
      const workflowId = data.workflow?.id;
      if (workflowId) {
        queryClient.invalidateQueries({ queryKey: ["workflows", workflowId, "goals"] });
        queryClient.invalidateQueries({ queryKey: ["workflows", workflowId] });
      }
      queryClient.invalidateQueries({ queryKey: ["my-goals"] });
      toast.success("Goal marked as achieved");
    },
  });
}

export function useDeleteWorkflowGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string) => {
      return await api.deleteWorkflowGoal(goalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["my-goals"] });
      toast.success("Goal deleted successfully");
    },
  });
}

export function useMyGoals() {
  return useQuery({
    queryKey: ["my-goals"],
    queryFn: async () => {
      return await api.getMyGoals();
    },
  });
}

