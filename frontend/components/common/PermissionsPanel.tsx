"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { CAPABILITIES, type Capability } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Capabilities grouped for display, each with the wording a person would use.
 *
 * Grouping by name prefix was tried first and produced an "Other" bucket full
 * of bare verbs — three separate rows reading "View", two reading "Assign".
 * Spelling out each label is longer but unambiguous, which is the entire point
 * of showing someone their own permissions.
 */
const GROUPS: Array<{
  title: string;
  items: Array<{ capability: Capability; label: string }>;
}> = [
  {
    title: "Documents",
    items: [
      { capability: "documents.view", label: "Open and download" },
      { capability: "documents.create", label: "Upload and create" },
      { capability: "documents.edit", label: "Edit content" },
      { capability: "documents.delete", label: "Delete" },
      { capability: "documents.share", label: "Add to other folders" },
      {
        capability: "documents.manage_permissions",
        label: "Change who has access",
      },
    ],
  },
  {
    title: "Folders",
    items: [
      { capability: "folders.create", label: "Create folders" },
      { capability: "folders.edit", label: "Rename and move" },
      { capability: "folders.delete", label: "Delete folders" },
      {
        capability: "folders.manage_permissions",
        label: "Change who has access",
      },
    ],
  },
  {
    title: "Workflows and actions",
    items: [
      { capability: "workflows.view", label: "View workflows" },
      { capability: "workflows.create", label: "Start a workflow" },
      { capability: "workflows.edit", label: "Edit a workflow" },
      { capability: "workflows.delete", label: "Delete a workflow" },
      { capability: "workflows.assign", label: "Route documents to people" },
      { capability: "actions.assign", label: "Assign actions to people" },
      { capability: "actions.complete", label: "Complete actions" },
    ],
  },
  {
    title: "Requests and approvals",
    items: [
      { capability: "access_requests.create", label: "Request access" },
      {
        capability: "access_requests.review",
        label: "Approve access requests",
      },
      {
        capability: "approvals.review",
        label: "Approve cross-company requests",
      },
    ],
  },
  {
    title: "Administration",
    items: [
      { capability: "users.view", label: "See the people directory" },
      { capability: "users.manage", label: "Add and edit users" },
      { capability: "companies.view_all", label: "See every company" },
      { capability: "companies.manage", label: "Create and edit companies" },
      { capability: "reports.view", label: "View reports" },
      { capability: "storage.view", label: "View storage usage" },
      { capability: "activity.view_all", label: "See the full audit trail" },
    ],
  },
];

/**
 * Shows the signed-in user exactly what their role permits.
 *
 * Worth its space because the alternative is discovering a missing permission
 * by clicking something and having nothing happen.
 */
export function PermissionsPanel() {
  const { permissions, scopeDescription, ready } = usePermissions();

  const grouped = useMemo(() => {
    const labelled = new Set(
      GROUPS.flatMap((group) => group.items.map((item) => item.capability)),
    );

    // A capability added to the vocabulary but not given a label here still
    // appears, so it can never become silently invisible.
    const unlabelled = CAPABILITIES.filter(
      (capability) => !labelled.has(capability),
    ).map((capability) => ({
      capability,
      label: capability.replace(/[._]/g, " "),
    }));

    return unlabelled.length
      ? [...GROUPS, { title: "Other", items: unlabelled }]
      : GROUPS;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Your permissions
        </CardTitle>
        <CardDescription>
          Set by your role. Contact an administrator to change them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!ready ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-muted/40 p-4">
              <div>
                <p className="register-label">Role</p>
                <p className="mt-1 font-medium">{permissions.role}</p>
              </div>
              <div className="hidden h-8 w-px bg-border sm:block" aria-hidden />
              <div className="min-w-[12rem] flex-1">
                <p className="register-label">You can reach</p>
                <p className="mt-1 font-medium">{scopeDescription}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Access to any individual folder or document also depends on it
              being shared with you, your department or your division.
            </p>

            {grouped.map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="text-sm font-semibold">{section.title}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {section.items.map(({ capability, label }) => {
                    const held = permissions.capabilities.includes(capability);
                    return (
                      <div
                        key={capability}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                          held
                            ? "border-border"
                            : "border-dashed text-muted-foreground",
                        )}
                      >
                        {held ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-hidden
                          />
                        ) : (
                          <Minus
                            className="h-4 w-4 shrink-0 opacity-50"
                            aria-hidden
                          />
                        )}
                        <span>{label}</span>
                        <span className="sr-only">
                          {held ? "allowed" : "not allowed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {permissions.canAssignDocuments && (
              <Badge variant="secondary">
                Can assign documents to other people
              </Badge>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
