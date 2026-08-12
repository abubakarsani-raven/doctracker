/** Shared helpers for role permissionsJson from GET /roles. */

export type RoleRecord = {
  id: string;
  name: string;
  permissionsJson?: {
    dataScope?: string;
    capabilities?: string[];
    description?: string;
  } | null;
};

export function parseRoleMeta(role: RoleRecord | undefined | null) {
  const json = role?.permissionsJson;
  const capabilities = Array.isArray(json?.capabilities)
    ? json!.capabilities.filter((c): c is string => typeof c === "string")
    : [];
  return {
    description:
      typeof json?.description === "string" ? json.description : undefined,
    dataScope:
      typeof json?.dataScope === "string" ? json.dataScope : undefined,
    capabilities,
  };
}

/** Human labels for capability ids shown in admin UI. */
export function formatCapability(capability: string): string {
  const [area, ...rest] = capability.split(".");
  const action = rest.join(".") || area;
  const areaLabel = area.replace(/_/g, " ");
  const actionLabel = action.replace(/_/g, " ");
  return `${areaLabel}: ${actionLabel}`;
}

export function formatDataScope(scope?: string): string {
  switch (scope) {
    case "all":
      return "All companies";
    case "company":
      return "Entire company";
    case "department":
      return "Own department";
    case "division":
      return "Own division";
    case "own":
      return "Own records only";
    default:
      return scope || "Unknown";
  }
}
