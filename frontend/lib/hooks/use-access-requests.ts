import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// TODO: Create backend endpoints for access requests
// For now, this hook structure is ready for when endpoints are added

export function useAccessRequests() {
  return useQuery({
    queryKey: ["accessRequests"],
    queryFn: async () => {
      // TODO: Replace with real API call when endpoint is available
      // For now, return empty array or use localStorage fallback
      const stored = localStorage.getItem("accessRequests");
      return stored ? JSON.parse(stored) : [];
    },
  });
}

export function useCreateAccessRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      // TODO: Replace with real API call when endpoint is available
      // For now, save to localStorage
      const requests = JSON.parse(localStorage.getItem("accessRequests") || "[]");
      const newRequest = {
        ...data,
        id: `access-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      requests.push(newRequest);
      localStorage.setItem("accessRequests", JSON.stringify(requests));
      return newRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessRequests"] });
      toast.success("Access request created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create access request");
    },
  });
}

export function useUpdateAccessRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // TODO: Replace with real API call when endpoint is available
      const requests = JSON.parse(localStorage.getItem("accessRequests") || "[]");
      const index = requests.findIndex((r: any) => r.id === id);
      if (index === -1) throw new Error("Request not found");
      
      requests[index] = {
        ...requests[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("accessRequests", JSON.stringify(requests));
      return requests[index];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessRequests"] });
      toast.success("Access request updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update access request");
    },
  });
}
