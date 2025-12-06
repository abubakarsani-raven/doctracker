import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        const notifications = await api.getNotifications();
        console.log('[useNotifications] Fetched notifications:', notifications?.length || 0);
        return notifications || [];
      } catch (error: any) {
        console.error('[useNotifications] Error fetching notifications:', error);
        console.error('[useNotifications] Error details:', {
          message: error.message,
          stack: error.stack,
        });
        // Return empty array on error instead of throwing
        return [];
      }
    },
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    retry: 1, // Only retry once on failure
    staleTime: 0, // Always consider data stale to ensure fresh fetches
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
    onError: (error: any) => {
      toast.error(error.message || "Failed to mark notification as read");
    },
  });
}
