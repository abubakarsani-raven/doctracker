import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useAccessRequests() {
  return useQuery({
    queryKey: ["accessRequests"],
    queryFn: async () => {
      try {
        return await api.getAccessRequests();
      } catch (error: any) {
        toast.error(error.message || "Failed to load access requests");
        throw error;
      }
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
  });
}
