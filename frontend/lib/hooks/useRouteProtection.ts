"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./use-users";
import { getPermissions, type Capability } from "@/lib/permissions";

interface RouteProtectionOptions {
  /** Capabilities the page needs. The user must hold all of them. */
  requires?: Capability | Capability[];
  /** Restrict to users whose reach spans every company. */
  requireMaster?: boolean;
  redirectTo?: string;
}

/**
 * Guard a page on capabilities rather than role names.
 *
 * Redirects are a convenience, not the boundary: each API call the page makes
 * is authorised again on the server.
 */
export function useRouteProtection(options: RouteProtectionOptions = {}) {
  const { requires, requireMaster = false, redirectTo = "/dashboard" } = options;
  const { data: currentUser, isLoading } = useCurrentUser();
  const router = useRouter();

  const required: Capability[] = requires
    ? Array.isArray(requires)
      ? requires
      : [requires]
    : [];

  const permissions = getPermissions(currentUser);
  // Capabilities arrive with the session, so waiting avoids bouncing a
  // legitimate admin off the page during the first render.
  const resolved = !isLoading && permissions.capabilities.length > 0;

  const isAuthorized =
    !!currentUser &&
    resolved &&
    (!requireMaster || permissions.dataScope === "all") &&
    required.every((capability) => permissions.capabilities.includes(capability));

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (!resolved) return;

    if (!isAuthorized) {
      router.push(redirectTo);
    }
  }, [currentUser, isLoading, resolved, isAuthorized, redirectTo, router]);

  return {
    isAuthorized,
    /** True while the session is still loading — render a skeleton, not a denial. */
    isChecking: isLoading || (!!currentUser && !resolved),
    permissions,
  };
}
