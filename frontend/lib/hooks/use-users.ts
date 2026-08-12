import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      return await api.getUsers();
    },
  });
}

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => api.getRoles(),
    enabled,
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      return await api.getCurrentUser();
    },
    retry: false,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      name: string;
      roleId?: string;
      departmentIds?: string[];
      companyId?: string;
      sendEmail?: boolean;
    }) => {
      return await api.inviteUser(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      name: string;
      password?: string;
      roleId?: string;
      departmentIds?: string[];
      divisionIds?: string[];
      companyId?: string;
      status?: string;
    }) => {
      return await api.createUser(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateOwnProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name?: string; phone?: string }) => {
      return await api.updateOwnProfile(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        email?: string;
        role?: string;
        departmentId?: string;
        divisionId?: string;
      };
    }) => {
      return await api.updateUser(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await api.deactivateUser(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
