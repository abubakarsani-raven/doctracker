import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useActivity(filters?: {
  resourceType?: string;
  resourceId?: string;
  activityType?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["activity", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.resourceType) params.append("resourceType", filters.resourceType);
      if (filters?.resourceId) params.append("resourceId", filters.resourceId);
      if (filters?.activityType) params.append("activityType", filters.activityType);
      if (filters?.limit) params.append("limit", filters.limit.toString());
      
      return await api.getActivity(params.toString());
    },
  });
}

export function useRecentActivity(limit: number = 50) {
  return useQuery({
    queryKey: ["recentActivity", limit],
    queryFn: async () => {
      return await api.getRecentActivity(limit);
    },
  });
}

