import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      return await api.getCompanies();
    },
  });
}
