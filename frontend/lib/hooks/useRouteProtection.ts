"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMockData } from "@/lib/contexts/MockDataContext";
import { isCompanyAdmin } from "@/lib/cross-company-utils";

interface RouteProtectionOptions {
  requireAdmin?: boolean;
  requireMaster?: boolean;
  redirectTo?: string;
}

export function useRouteProtection(options: RouteProtectionOptions = {}) {
  const { requireAdmin = false, requireMaster = false, redirectTo = "/dashboard" } = options;
  const { currentUser } = useMockData();
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (requireMaster && currentUser.role !== "Master") {
      router.push(redirectTo);
      return;
    }

    if (requireAdmin) {
      const isAdmin = currentUser.role === "Master" || isCompanyAdmin(currentUser);
      if (!isAdmin) {
        router.push(redirectTo);
        return;
      }
    }
  }, [currentUser, requireAdmin, requireMaster, redirectTo, router]);

  return {
    isAuthorized:
      currentUser &&
      (!requireAdmin || currentUser.role === "Master" || isCompanyAdmin(currentUser)) &&
      (!requireMaster || currentUser.role === "Master"),
  };
}
