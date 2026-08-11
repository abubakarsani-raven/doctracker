"use client";

import { useMemo } from "react";
import { useCurrentUser } from "@/lib/hooks/use-users";
import {
  Capability,
  EffectivePermissions,
  ResourcePermission,
  ScopedResource,
  can,
  canAll,
  canAny,
  checkResourceAccess,
  describeScope,
  explainDenial,
  getPermissions,
} from "@/lib/permissions";

export interface UsePermissions {
  /** Resolved permissions for the signed-in user. */
  permissions: EffectivePermissions;
  /** True once the session has loaded and capabilities are known. */
  ready: boolean;
  /** Does the user hold this capability? */
  can: (capability: Capability) => boolean;
  canAll: (...capabilities: Capability[]) => boolean;
  canAny: (...capabilities: Capability[]) => boolean;
  /** Can the user perform this verb on this specific folder or document? */
  canOn: (
    resource: ScopedResource | null | undefined,
    permission: ResourcePermission,
    resourceType?: "folder" | "document",
  ) => boolean;
  /** Why not — a sentence for a tooltip, or null when allowed. */
  whyNot: (
    resource: ScopedResource | null | undefined,
    permission: ResourcePermission,
    resourceType?: "folder" | "document",
  ) => string | null;
  /** One-line description of the user's data scope. */
  scopeDescription: string;
  isMaster: boolean;
}

/**
 * Read the current user's capabilities.
 *
 * These decide what the interface offers. The API applies the same rules again
 * on every request, so a stale or tampered client cannot gain access — it can
 * only end up showing a control that then fails with a 403.
 */
export function usePermissions(): UsePermissions {
  const { data: currentUser, isLoading } = useCurrentUser();

  return useMemo(() => {
    const permissions = getPermissions(currentUser);
    const ready = !isLoading && permissions.capabilities.length > 0;

    return {
      permissions,
      ready,
      can: (capability) => can(currentUser, capability),
      canAll: (...capabilities) => canAll(currentUser, ...capabilities),
      canAny: (...capabilities) => canAny(currentUser, ...capabilities),
      canOn: (resource, permission, resourceType = "document") =>
        checkResourceAccess(currentUser, resource, permission, resourceType),
      whyNot: (resource, permission, resourceType = "document") =>
        explainDenial(currentUser, resource, permission, resourceType),
      scopeDescription: describeScope(permissions),
      isMaster: permissions.dataScope === "all",
    };
  }, [currentUser, isLoading]);
}
