import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/hooks/use-users";

export function useNotifications() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();

  return useQuery({
    queryKey: ["notifications", currentUser?.id],
    queryFn: async () => {
      const notifications = await api.getNotifications();
      return notifications || [];
    },
    enabled: !userLoading && !!currentUser?.id,
    refetchInterval: 30 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 10 * 1000,
    throwOnError: false,
  });
}

export function useUnreadNotificationsCount() {
  const { data: notifications } = useNotifications();
  return notifications?.filter((n: any) => !n.read).length || 0;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await api.markNotificationRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
