import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { CrossCompanyApprovalRequest } from "@/lib/cross-company-utils";

export function useApprovalRequests() {
  return useQuery({
    queryKey: ["approvalRequests"],
    queryFn: async () => {
      return await api.getApprovalRequests();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to load approval requests");
    },
  });
}

export function useCreateApprovalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CrossCompanyApprovalRequest, "id" | "requestedAt" | "status">) => {
      return await api.createApprovalRequest(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvalRequests"] });
      toast.success("Approval request created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create approval request");
    },
  });
}

export function useUpdateApprovalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CrossCompanyApprovalRequest> }) => {
      return await api.updateApprovalRequest(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvalRequests"] });
      toast.success("Approval request updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update approval request");
    },
  });
}
