import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      return await api.getCompanies();
    },
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ["companies", id],
    queryFn: async () => {
      return await api.getCompany(id);
    },
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      address?: string;
    }) => {
      return await api.createCompany(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company created");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create company");
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        address?: string;
        isActive?: boolean;
      };
    }) => {
      return await api.updateCompany(id, data);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["companies", vars.id] });
      toast.success("Company updated");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update company");
    },
  });
}

export function useDeactivateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => api.deactivateCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company deactivated");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to deactivate company");
    },
  });
}

export function useActivateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => api.activateCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company reactivated");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to activate company");
    },
  });
}

export function useTransferCompanyOwnership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceCompanyId,
      targetCompanyId,
      transferAll,
    }: {
      sourceCompanyId: string;
      targetCompanyId: string;
      transferAll?: boolean;
    }) =>
      api.transferCompanyOwnership(sourceCompanyId, {
        targetCompanyId,
        transferAll: transferAll ?? true,
      }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success(
        `Transferred ${result?.filesMoved ?? 0} documents and ${
          result?.foldersMoved ?? 0
        } folders`,
      );
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to transfer ownership");
    },
  });
}
