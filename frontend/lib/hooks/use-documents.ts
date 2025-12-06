import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useDocuments(folderId?: string) {
  return useQuery({
    queryKey: ["documents", folderId || "all"],
    queryFn: async () => {
      return await api.getDocuments(folderId);
    },
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ["documents", id],
    queryFn: async () => {
      return await api.getDocument(id);
    },
    enabled: !!id,
  });
}

export function useFolders() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: async () => {
      return await api.getFolders();
    },
  });
}

export function useFolder(id: string) {
  return useQuery({
    queryKey: ["folders", id],
    queryFn: async () => {
      return await api.getFolder(id);
    },
    enabled: !!id,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return await api.createFolder(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder created successfully");
    },
  });
}
