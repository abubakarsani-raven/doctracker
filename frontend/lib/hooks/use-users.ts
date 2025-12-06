import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      return await api.getUsers();
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      return await api.getCurrentUser();
    },
    retry: false, // Don't retry if user is not logged in
  });
}
