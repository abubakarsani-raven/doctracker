import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CrossCompanyApprovalRequest } from "@/lib/cross-company-utils";

// TODO: Create backend endpoints for approval requests
// For now, this hook structure is ready for when endpoints are added

export function useApprovalRequests() {
  return useQuery({
    queryKey: ["approvalRequests"],
    queryFn: async () => {
      // TODO: Replace with real API call when endpoint is available
      const stored = localStorage.getItem("crossCompanyApprovals");
      return (stored ? JSON.parse(stored) : []) as CrossCompanyApprovalRequest[];
    },
  });
}

export function useCreateApprovalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CrossCompanyApprovalRequest, "id" | "requestedAt" | "status">) => {
      // TODO: Replace with real API call when endpoint is available
      const requests = JSON.parse(localStorage.getItem("crossCompanyApprovals") || "[]");
      const newRequest: CrossCompanyApprovalRequest = {
        ...data,
        id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        requestedAt: new Date().toISOString(),
        status: "pending",
      };
      requests.push(newRequest);
      localStorage.setItem("crossCompanyApprovals", JSON.stringify(requests));
      return newRequest;
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
      // TODO: Replace with real API call when endpoint is available
      const requests = JSON.parse(localStorage.getItem("crossCompanyApprovals") || "[]");
      const index = requests.findIndex((r: CrossCompanyApprovalRequest) => r.id === id);
      if (index === -1) throw new Error("Request not found");
      
      requests[index] = {
        ...requests[index],
        ...data,
      };
      localStorage.setItem("crossCompanyApprovals", JSON.stringify(requests));
      return requests[index];
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
