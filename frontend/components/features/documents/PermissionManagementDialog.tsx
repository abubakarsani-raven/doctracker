"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownToLine,
  Ban,
  Check,
  Building2,
  Layers,
  Shield,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { useUsers } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { AclEntry, ResourcePermission, SubjectType } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface PermissionManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  documentId?: string;
  /** Shown in the header so it is clear what is being edited. */
  resourceName?: string;
  /** Called after ACL save, revoke-all, or restore. */
  onChanged?: () => void;
}

const PERMISSION_ORDER: ResourcePermission[] = [
  "read",
  "write",
  "delete",
  "share",
  "manage",
];

const PERMISSION_LABELS: Record<ResourcePermission, string> = {
  read: "Read",
  write: "Write",
  delete: "Delete",
  share: "Share",
  manage: "Manage",
};

const PERMISSION_HINTS: Record<ResourcePermission, string> = {
  read: "Open and download",
  write: "Edit and upload new versions",
  delete: "Remove permanently",
  share: "Add to other folders",
  manage: "Change who has access",
};

export function PermissionManagementDialog({
  open,
  onOpenChange,
  folderId,
  documentId,
  resourceName,
  onChanged,
}: PermissionManagementDialogProps) {
  const { data: users = [] } = useUsers();
  const { data: companies = [] } = useCompanies();
  const { can, isMaster } = usePermissions();

  const [entries, setEntries] = useState<AclEntry[]>([]);
  const [inherited, setInherited] = useState<AclEntry[]>([]);
  // Granting to a whole department or division is the common case under
  // need-to-know: naming every person individually does not scale.
  const [subjectType, setSubjectType] = useState<SubjectType>("department");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<
    ResourcePermission[]
  >(["read"]);
  const [selectedEffect, setSelectedEffect] = useState<"allow" | "deny">("allow");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // What to do about work already assigned to anyone losing access. Defaults to
  // leaving it alone — dropping someone's in-progress work should be a choice.
  const [onRevoke, setOnRevoke] = useState<"leave" | "flag">("leave");
  const [accessRevokedAt, setAccessRevokedAt] = useState<string | null>(null);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [locking, setLocking] = useState(false);

  // The reassignment prompt is only relevant when access is actually being
  // taken away, so it stays hidden until there is a deny entry.
  const hasDenyEntries = entries.some((entry) => entry.effect === "deny");

  const isFolder = !documentId;
  const canManage = can(
    isFolder ? "folders.manage_permissions" : "documents.manage_permissions",
  );

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = documentId
        ? await api.getFilePermissions(documentId, folderId)
        : folderId
          ? await api.getFolderPermissions(folderId)
          : null;

      if (!data) {
        setEntries([]);
        setInherited([]);
        return;
      }

      const explicit: AclEntry[] = Array.isArray(data.explicitPermissions)
        ? data.explicitPermissions
        : [];
      const key = (entry: AclEntry) => `${entry.subjectType}:${entry.subjectId}`;
      const inheritedKeys = new Set(
        (Array.isArray(data.inheritedPermissions)
          ? data.inheritedPermissions
          : []
        ).map((entry: AclEntry) => key(entry)),
      );

      // Entries that came from a parent folder are shown read-only: editing
      // them here would silently write a copy onto this resource.
      setEntries(explicit.filter((entry) => !inheritedKeys.has(key(entry))));
      setInherited(
        (Array.isArray(data.inheritedPermissions)
          ? data.inheritedPermissions
          : []) as AclEntry[],
      );
      setAccessRevokedAt(data.accessRevokedAt ?? null);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.isForbidden
            ? "You do not have permission to view the access list for this item."
            : error.message
          : "Could not load permissions.";
      setLoadError(message);
      setEntries([]);
      setInherited([]);
    } finally {
      setLoading(false);
    }
  }, [documentId, folderId]);

  useEffect(() => {
    if (open) loadPermissions();
  }, [open, loadPermissions]);

  const userById = useMemo(() => {
    const map = new Map<string, any>();
    for (const user of users as any[]) map.set(user.id, user);
    return map;
  }, [users]);

  /** Departments and divisions available as grant targets, flattened. */
  const groups = useMemo(() => {
    const departments: Array<{ id: string; name: string; company: string }> = [];
    const divisions: Array<{ id: string; name: string; company: string }> = [];

    for (const company of companies as any[]) {
      for (const department of company.departments ?? []) {
        departments.push({
          id: department.id,
          name: department.name,
          company: company.name,
        });
        for (const division of department.divisions ?? []) {
          divisions.push({
            id: division.id,
            name: `${department.name} → ${division.name}`,
            company: company.name,
          });
        }
      }
    }
    return { departments, divisions };
  }, [companies]);

  const subjectName = useCallback(
    (entry: Pick<AclEntry, "subjectType" | "subjectId" | "subjectName">) => {
      if (entry.subjectType === "user") {
        const user = userById.get(entry.subjectId);
        return {
          name: user?.name || entry.subjectName || "Unknown user",
          detail: user?.email || "User",
        };
      }
      const pool =
        entry.subjectType === "department" ? groups.departments : groups.divisions;
      const match = pool.find((g) => g.id === entry.subjectId);
      return {
        name: match?.name || entry.subjectName || `Unknown ${entry.subjectType}`,
        detail: match
          ? `${match.company} · everyone in this ${entry.subjectType}`
          : entry.subjectType === "department"
            ? "Department"
            : "Division",
      };
    },
    [userById, groups],
  );

  /** Candidates for the currently selected subject type, minus ones already listed. */
  const options = useMemo(() => {
    const taken = new Set(
      entries
        .filter((entry) => entry.subjectType === subjectType)
        .map((entry) => entry.subjectId),
    );

    if (subjectType === "user") {
      return (users as any[])
        .filter((user) => !taken.has(user.id))
        .map((user) => ({ id: user.id, label: `${user.name} · ${user.role}` }));
    }
    const pool =
      subjectType === "department" ? groups.departments : groups.divisions;
    return pool
      .filter((group) => !taken.has(group.id))
      .map((group) => ({ id: group.id, label: `${group.name} (${group.company})` }));
  }, [subjectType, users, groups, entries]);

  const handleAddEntry = () => {
    if (!selectedUserId) {
      toast.error(`Select a ${subjectType} first`);
      return;
    }
    if (selectedPermissions.length === 0) {
      toast.error("Select at least one permission");
      return;
    }

    setEntries((current) => [
      ...current,
      {
        subjectType,
        subjectId: selectedUserId,
        ...(subjectType === "user" ? { userId: selectedUserId } : {}),
        permissions: [...selectedPermissions],
        effect: selectedEffect,
      },
    ]);

    setSelectedUserId("");
    setSelectedPermissions(["read"]);
    setSelectedEffect("allow");
  };

  const handleRemoveEntry = (entry: AclEntry) => {
    setEntries((current) =>
      current.filter(
        (candidate) =>
          !(
            candidate.subjectType === entry.subjectType &&
            candidate.subjectId === entry.subjectId
          ),
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (documentId) {
        if (!folderId) {
          // File ACLs live on the file-folder link, so there is nowhere to
          // store them without knowing which folder is meant.
          toast.error(
            "Open this document from inside a folder to change its permissions.",
          );
          return;
        }
        await api.updateFilePermissions(documentId, folderId, entries, onRevoke);
      } else if (folderId) {
        await api.updateFolderPermissions(folderId, entries, onRevoke);
      }

      toast.success("Permissions updated", {
        description: "Changes take effect immediately.",
      });
      onChanged?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Could not update permissions", {
        description:
          error instanceof ApiError ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!documentId) return;
    setLocking(true);
    try {
      await api.revokeAllFileAccess(documentId);
      toast.success("All access revoked", {
        description:
          "Only Master and Group Secretary can open this file until access is restored.",
      });
      setAccessRevokedAt(new Date().toISOString());
      setRevokeConfirmOpen(false);
      onChanged?.();
    } catch (error) {
      toast.error("Could not revoke access", {
        description:
          error instanceof ApiError ? error.message : "Please try again.",
      });
    } finally {
      setLocking(false);
    }
  };

  const handleRestoreAccess = async () => {
    if (!documentId) return;
    setLocking(true);
    try {
      await api.restoreFileAccess(documentId);
      toast.success("Access restored", {
        description: "Previous grants and role reach apply again.",
      });
      setAccessRevokedAt(null);
      onChanged?.();
    } catch (error) {
      toast.error("Could not restore access", {
        description:
          error instanceof ApiError ? error.message : "Please try again.",
      });
    } finally {
      setLocking(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage access
          </DialogTitle>
          <DialogDescription>
            {resourceName ? (
              <>
                Who can reach <span className="font-medium">{resourceName}</span>,
                beyond the people its scope already covers.
              </>
            ) : (
              <>
                Grant access to people outside this {isFolder ? "folder" : "document"}
                &rsquo;s scope, or revoke it from people inside it.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!canManage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your role cannot change permissions. You can review the current
              access list, but not edit it.
            </AlertDescription>
          </Alert>
        )}

        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {documentId && isMaster && !loadError && (
          <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
            <Label className="text-base font-semibold">Group lock</Label>
            {accessRevokedAt ? (
              <>
                <Alert variant="destructive">
                  <Ban className="h-4 w-4" />
                  <AlertDescription>
                    All access is revoked. Company admins, department
                    leaders, creators, and named shares cannot open this
                    file. Only Master and Group Secretary can.
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  disabled={locking}
                  onClick={handleRestoreAccess}
                >
                  {locking ? "Restoring…" : "Restore access"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Pull this file back so nobody in any company can open it,
                  including people who already had a grant. You can restore
                  access later; existing shares are kept, not deleted.
                </p>
                <Button
                  variant="destructive"
                  disabled={locking}
                  onClick={() => setRevokeConfirmOpen(true)}
                >
                  Revoke all access
                </Button>
              </>
            )}
          </div>
        )}

        <div className="space-y-6 py-2">
          {/* Add an entry */}
          {canManage && !loadError && (
            <div className="space-y-4 rounded-lg border p-4">
              <Label className="text-base font-semibold">Add a person</Label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Give access to</Label>
                  <div className="flex gap-1 rounded-md border p-1">
                    {(
                      [
                        { value: "department", label: "Department", icon: Building2 },
                        { value: "division", label: "Division", icon: Layers },
                        { value: "user", label: "Person", icon: User },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const active = subjectType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setSubjectType(option.value);
                            setSelectedUserId("");
                          }}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select a ${subjectType}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No {subjectType}s left to add
                        </div>
                      ) : (
                        options.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Effect</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={selectedEffect === "allow" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedEffect("allow")}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Allow
                    </Button>
                    <Button
                      type="button"
                      variant={
                        selectedEffect === "deny" ? "destructive" : "outline"
                      }
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedEffect("deny")}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Deny
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedEffect === "allow"
                      ? "Grants access this person would not otherwise have."
                      : "Revokes access their role or department would otherwise give them. Deny always wins."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PERMISSION_ORDER.map((permission) => (
                    <label
                      key={permission}
                      htmlFor={`perm-${permission}`}
                      className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        id={`perm-${permission}`}
                        className="mt-0.5"
                        checked={selectedPermissions.includes(permission)}
                        onCheckedChange={(checked) => {
                          setSelectedPermissions((current) =>
                            checked
                              ? [...current, permission]
                              : current.filter((p) => p !== permission),
                          );
                        }}
                      />
                      <span>
                        <span className="font-medium">
                          {PERMISSION_LABELS[permission]}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {PERMISSION_HINTS[permission]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleAddEntry}
                disabled={!selectedUserId || selectedPermissions.length === 0}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add entry
              </Button>
            </div>
          )}

          {/* Direct entries */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Direct access ({entries.length})
            </Label>

            {loading ? (
              <div className="space-y-2 rounded-lg border p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : entries.length === 0 ? (
              <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                No direct entries. Access follows this{" "}
                {isFolder ? "folder" : "document"}&rsquo;s scope.
              </p>
            ) : (
              <ScrollArea className="max-h-[280px] rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Effect</TableHead>
                      <TableHead>Permissions</TableHead>
                      {canManage && <TableHead className="w-16" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const subject = subjectName(entry);
                      const isDeny = entry.effect === "deny";
                      const SubjectIcon =
                        entry.subjectType === "user"
                          ? User
                          : entry.subjectType === "department"
                            ? Building2
                            : Layers;
                      return (
                        <TableRow key={`${entry.subjectType}:${entry.subjectId}`}>
                          <TableCell>
                            <div className="flex items-center gap-2 font-medium">
                              <SubjectIcon
                                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              {subject.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {subject.detail}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={isDeny ? "destructive" : "secondary"}
                              className="gap-1"
                            >
                              {isDeny ? (
                                <Ban className="h-3 w-3" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              {isDeny ? "Deny" : "Allow"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {entry.permissions.map((permission) => (
                                <Badge
                                  key={permission}
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    isDeny && "line-through opacity-70",
                                  )}
                                >
                                  {PERMISSION_LABELS[permission] ?? permission}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${subject.name}`}
                                onClick={() => handleRemoveEntry(entry)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>

          {/* Inherited entries — read-only */}
          {inherited.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <ArrowDownToLine className="h-4 w-4" />
                Inherited from parent folders ({inherited.length})
              </Label>
              <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
                {inherited.map((entry) => {
                  const subject = subjectName(entry);
                  return (
                    <div
                      key={`inherited-${entry.subjectType}:${entry.subjectId}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate">
                        {subject.name}
                        <span className="text-muted-foreground">
                          {" "}
                          · {subject.detail}
                        </span>
                      </span>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Badge
                          variant={
                            entry.effect === "deny" ? "destructive" : "secondary"
                          }
                          className="text-xs"
                        >
                          {entry.effect === "deny" ? "Deny" : "Allow"}
                        </Badge>
                        {entry.permissions.map((permission) => (
                          <Badge
                            key={permission}
                            variant="outline"
                            className="text-xs"
                          >
                            {PERMISSION_LABELS[permission] ?? permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="pt-2 text-xs text-muted-foreground">
                  Change these on the parent folder. Adding the same person here
                  overrides what they inherit.
                </p>
              </div>
            </div>
          )}
        </div>

        {canManage && hasDenyEntries && (
          <div className="rounded-lg border border-dashed p-3">
            <Label className="text-sm font-semibold">
              Work already assigned to people losing access
            </Label>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={onRevoke === "leave" ? "default" : "outline"}
                onClick={() => setOnRevoke("leave")}
              >
                Leave it alone
              </Button>
              <Button
                type="button"
                size="sm"
                variant={onRevoke === "flag" ? "default" : "outline"}
                onClick={() => setOnRevoke("flag")}
              >
                Flag for reassignment
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {onRevoke === "leave"
                ? "Open actions stay assigned to them. Nothing else changes."
                : "Their open actions on this item are marked blocked, and the person who created each action is told to reassign it."}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !canManage || loading || !!loadError}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {documentId && isMaster && (
      <ConfirmDialog
        open={revokeConfirmOpen}
        onOpenChange={setRevokeConfirmOpen}
        title="Revoke all access?"
        description={`“${resourceName || "This file"}” will be closed to everyone except Master and Group Secretary. Pending access requests will be closed. Existing shares stay on file and return if you restore access.`}
        confirmLabel="Revoke all access"
        variant="destructive"
        loading={locking}
        onConfirm={handleRevokeAll}
      />
    )}
    </>
  );
}
