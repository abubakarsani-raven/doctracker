"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Building2, FolderTree, Layers } from "lucide-react";
import { toast } from "sonner";
import { useCreateFolder, useFolders } from "@/lib/hooks/use-documents";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { cn } from "@/lib/utils";

/** Folders may nest three levels deep; mirrors FilesService.MAX_FOLDER_DEPTH. */
const MAX_FOLDER_DEPTH = 3;

const TOP_LEVEL = "__top__";

type Scope = "company" | "department" | "division";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects the parent, e.g. when opened from inside a folder. */
  parentFolderId?: string;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentFolderId,
}: CreateFolderDialogProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: companies = [] } = useCompanies();
  const { data: allFolders = [] } = useFolders();
  const { permissions, canOn, isMaster } = usePermissions();
  const createFolder = useCreateFolder();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<Scope>("department");
  const [parentId, setParentId] = useState<string>(parentFolderId ?? TOP_LEVEL);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [divisionId, setDivisionId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");

  // Master (or any user without a company on their profile) must pick/pass one.
  const needsCompanyPicker =
    isMaster ||
    permissions.dataScope === "all" ||
    !currentUser?.companyId;

  // Depth of each folder, so anything already at the limit can be ruled out as
  // a parent before the user picks it.
  const depthOf = useMemo(() => {
    const byId = new Map<string, any>(allFolders.map((f: any) => [f.id, f]));
    const cache = new Map<string, number>();

    const walk = (id: string, seen = new Set<string>()): number => {
      if (cache.has(id)) return cache.get(id)!;
      if (seen.has(id)) return 1;
      seen.add(id);
      const folder = byId.get(id);
      const depth = folder?.parentFolderId
        ? walk(folder.parentFolderId, seen) + 1
        : 1;
      cache.set(id, depth);
      return depth;
    };

    return walk;
  }, [allFolders]);

  /** Folders that can still take a child, and that the user may write into. */
  const parentOptions = useMemo(
    () =>
      allFolders
        .filter((f: any) => depthOf(f.id) < MAX_FOLDER_DEPTH)
        .filter((f: any) => canOn(f, "write", "folder"))
        .map((f: any) => ({ id: f.id, name: f.name, depth: depthOf(f.id) }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name)),
    [allFolders, depthOf, canOn],
  );

  const selectedParent = useMemo(() => {
    if (parentId === TOP_LEVEL) return null;
    return allFolders.find((f: any) => f.id === parentId) ?? null;
  }, [allFolders, parentId]);

  /** Effective company for this create — parent folder wins, then picker/user. */
  const resolvedCompanyId =
    selectedParent?.companyId ||
    companyId ||
    currentUser?.companyId ||
    undefined;

  /** Departments and divisions the user may file into. */
  const { departments, divisions } = useMemo(() => {
    const company = (companies as any[]).find(
      (c) => c.id === resolvedCompanyId,
    );
    const all = company?.departments ?? [];

    // Someone whose reach is company-wide can file into any department; anyone
    // else only into the ones they belong to.
    const canFileAnywhere =
      permissions.dataScope === "all" || permissions.dataScope === "company";

    const departments = all.filter(
      (d: any) => canFileAnywhere || permissions.departmentIds.includes(d.id),
    );

    const divisions = departments.flatMap((d: any) =>
      (d.divisions ?? [])
        .filter(
          (v: any) => canFileAnywhere || permissions.divisionIds.includes(v.id),
        )
        .map((v: any) => ({ ...v, departmentName: d.name })),
    );

    return { departments, divisions };
  }, [companies, resolvedCompanyId, permissions]);

  // Reset to a sensible starting state each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setParentId(parentFolderId ?? TOP_LEVEL);
    const parent = parentFolderId
      ? allFolders.find((f: any) => f.id === parentFolderId)
      : null;
    setCompanyId(
      parent?.companyId || currentUser?.companyId || (companies as any[])[0]?.id || "",
    );
    setDepartmentId("");
    setDivisionId("");
    setScope("department");
  }, [open, parentFolderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the company (or parent) changes, pick a default department/division.
  useEffect(() => {
    if (!open) return;
    setDepartmentId(departments[0]?.id ?? "");
    setDivisionId(divisions[0]?.id ?? "");
    if (!departments.length && !divisions.length) {
      setScope("company");
    } else if (scope === "department" && !departments.length) {
      setScope(divisions.length ? "division" : "company");
    } else if (scope === "division" && !divisions.length) {
      setScope(departments.length ? "department" : "company");
    }
  }, [open, resolvedCompanyId, departments, divisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const parentDepth = parentId === TOP_LEVEL ? 0 : depthOf(parentId);
  const newDepth = parentDepth + 1;
  const atDepthLimit = newDepth > MAX_FOLDER_DEPTH;

  const scopeNeedsDepartment = scope === "department";
  const scopeNeedsDivision = scope === "division";
  const missingTarget =
    (scopeNeedsDepartment && !departmentId) || (scopeNeedsDivision && !divisionId);
  const missingCompany = needsCompanyPicker && !resolvedCompanyId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Give the folder a name");
      return;
    }
    if (missingCompany) {
      toast.error("Choose which company this folder belongs to");
      return;
    }
    if (missingTarget) {
      toast.error(`Choose which ${scope} this folder is for`);
      return;
    }

    // A division sits inside a department; send both so the grant and the
    // breadcrumb are complete.
    const division = divisions.find((d: any) => d.id === divisionId);

    try {
      await createFolder.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        scopeLevel: scope,
        parentFolderId: parentId === TOP_LEVEL ? undefined : parentId,
        departmentId: scopeNeedsDivision
          ? division?.departmentId
          : scopeNeedsDepartment
            ? departmentId
            : undefined,
        divisionId: scopeNeedsDivision ? divisionId : undefined,
        companyId: resolvedCompanyId,
      });

      setName("");
      setDescription("");
      onOpenChange(false);
    } catch {
      // The mutation hook surfaces the error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Folders can be three levels deep. Whoever you file it for gets access
            straight away; you can change that later under Manage access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 Board Papers"
              autoFocus
              required
              disabled={createFolder.isPending}
            />
          </div>

          {/* Where it goes */}
          <div className="space-y-2">
            <Label htmlFor="folder-parent" className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5" />
              Inside
            </Label>
            <Select
              value={parentId}
              onValueChange={setParentId}
              disabled={createFolder.isPending}
            >
              <SelectTrigger id="folder-parent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOP_LEVEL}>Top level</SelectItem>
                {parentOptions.map((folder: any) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {"— ".repeat(folder.depth - 1)}
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {atDepthLimit
                ? `That folder is already at level ${MAX_FOLDER_DEPTH}.`
                : `This will be level ${newDepth} of ${MAX_FOLDER_DEPTH}.`}
            </p>
          </div>

          {/* Company — required for Master / users without a company on profile */}
          {needsCompanyPicker && !selectedParent?.companyId && (
            <div className="space-y-2">
              <Label htmlFor="folder-company" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Company
              </Label>
              <Select
                value={companyId}
                onValueChange={setCompanyId}
                disabled={createFolder.isPending}
              >
                <SelectTrigger id="folder-company">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {(companies as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Who it is for */}
          <div className="space-y-2">
            <Label>Who it is for</Label>
            <div className="flex gap-1 rounded-md border p-1">
              {(
                [
                  { value: "department", label: "A department", icon: Building2 },
                  { value: "division", label: "A division", icon: Layers },
                  { value: "company", label: "Nobody yet", icon: FolderTree },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const disabled =
                  (option.value === "department" && departments.length === 0) ||
                  (option.value === "division" && divisions.length === 0);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled || createFolder.isPending}
                    onClick={() => setScope(option.value)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      scope === option.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                      disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            {scopeNeedsDepartment && (
              <Select
                value={departmentId}
                onValueChange={setDepartmentId}
                disabled={createFolder.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {scopeNeedsDivision && (
              <Select
                value={divisionId}
                onValueChange={setDivisionId}
                disabled={createFolder.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.departmentName} → {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <p className="text-xs text-muted-foreground">
              {scope === "company"
                ? "Only you will see it until you share it under Manage access."
                : `Everyone in that ${scope} gets read, write and share access.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder-description">Description</Label>
            <Textarea
              id="folder-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={2}
              disabled={createFolder.isPending}
            />
          </div>

          {atDepthLimit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Folders stop at {MAX_FOLDER_DEPTH} levels. Pick a shallower
                location.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createFolder.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createFolder.isPending ||
                atDepthLimit ||
                missingTarget ||
                missingCompany
              }
            >
              {createFolder.isPending ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
