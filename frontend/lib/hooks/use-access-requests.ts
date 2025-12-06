import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useAccessRequests() {
  return useQuery({
    queryKey: ["accessRequests"],
    queryFn: async () => {
      return await api.getAccessRequests();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to load access requests");
    },
  });
}

export function useCreateAccessRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return await api.createAccessRequest(data);
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
      return await api.updateAccessRequest(id, data);
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
