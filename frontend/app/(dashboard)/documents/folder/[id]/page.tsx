"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { FolderCard, DocumentCard, EmptyState, LoadingState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadDialog } from "@/components/features/documents/FileUploadDialog";
import { CreateFolderDialog } from "@/components/features/documents/CreateFolderDialog";
import { CreateWorkflowDialog } from "@/components/features/workflows/CreateWorkflowDialog";
import { Upload, FolderPlus, Grid3x3, List, Search, ArrowLeft, Workflow, RefreshCw } from "lucide-react";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { PermissionButton } from "@/components/common/PermissionButton";
import { useFolder, useFolders } from "@/lib/hooks/use-documents";
import { useDocuments } from "@/lib/hooks/use-documents";
import { useWorkflowsByFolder } from "@/lib/hooks/use-workflows";
import { WorkflowList } from "@/components/features/workflows/WorkflowList";
import { countDocumentsInFolderTree } from "@/lib/folder-utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function FolderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const folderId = params.id as string;
  
  const { can, canOn, whyNot, permissions } = usePermissions();
  const {
    data: folder,
    isLoading: folderLoading,
    refetch: refetchFolder,
  } = useFolder(folderId);
  const {
    data: allFolders = [],
    isFetching: foldersFetching,
    refetch: refetchFolders,
  } = useFolders();
  const {
    data: allDocuments = [],
    isFetching: documentsFetching,
    refetch: refetchDocuments,
  } = useDocuments();
  const { data: workflows = [], isLoading: workflowsLoading } = useWorkflowsByFolder(folderId);

  const refreshingFolders = foldersFetching && !folderLoading;
  const refreshingDocuments = documentsFetching && !folderLoading;

  const refreshFolders = async () => {
    await Promise.all([
      refetchFolder(),
      refetchFolders(),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
    ]);
  };

  const refreshDocuments = async () => {
    await Promise.all([
      refetchDocuments(),
      queryClient.invalidateQueries({ queryKey: ["documents"] }),
    ]);
  };

  const refreshAll = async () => {
    await Promise.all([refreshFolders(), refreshDocuments()]);
    toast.success("Folders and documents refreshed");
  };

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("modified");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [createWorkflowDialogOpen, setCreateWorkflowDialogOpen] = useState(false);

  const loading = folderLoading;

  // Build folder path hierarchy (all parent folders)
  const folderPath = useMemo(() => {
    if (!folder || !allFolders.length) return [];

    const buildPath = (folderId: string, folders: any[]): any[] => {
      const currentFolder = folders.find((f: any) => f.id === folderId);
      if (!currentFolder) return [];

      const path: any[] = [currentFolder];

      if (currentFolder.parentFolderId) {
        const parentPath = buildPath(currentFolder.parentFolderId, folders);
        return [...parentPath, ...path];
      }

      return path;
    };

    return buildPath(folderId, allFolders);
  }, [folder, allFolders, folderId]);

  // Folder and document access is decided by lib/permissions from the
  // capabilities the API resolved for this session, rather than re-derived here
  // from the role name.
  const hasFolderPermission = (target: any): boolean =>
    canOn(target, "read", "folder");

  // Folder loaded from the API → allow viewing the shell (open-via-child).
  // Per-card canOn still gates individual items; do not hard-deny the page
  // solely because canOn(folder, "read") is false.
  const canOpenFolder = !!folder;

  // Filter subfolders and documents for this folder
  const subfolders = useMemo(() => {
    if (!folderId) return [];
    return allFolders.filter((f: any) => f.parentFolderId === folderId);
  }, [allFolders, folderId]);

  const documents = useMemo(() => {
    if (!folderId) return [];
    return allDocuments.filter(
      (d: any) =>
        d.folderId === folderId ||
        (Array.isArray(d.folderIds) && d.folderIds.includes(folderId)),
    );
  }, [allDocuments, folderId]);

  // Get parent folder for back button
  const getParentFolder = () => {
    if (!folder || !folder.parentFolderId) return null;
    return allFolders.find((f: any) => f.id === folder.parentFolderId);
  };

  const handleBack = () => {
    const parent = getParentFolder();
    if (parent) {
      router.push(`/documents/folder/${parent.id}`);
    } else {
      router.push("/documents");
    }
  };

  const filteredSubfolders = useMemo(() => {
    return subfolders
      .map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        scope: folder.scope,
        scopeLevel: folder.scopeLevel ?? folder.scope,
        documentCount: countDocumentsInFolderTree(
          folder.id,
          allFolders,
          allDocuments,
        ),
        modifiedAt: new Date(folder.modifiedAt),
        createdBy: folder.createdBy,
        companyId: folder.companyId,
        departmentId: folder.departmentId,
        divisionId: folder.divisionId,
        permissionsJson: folder.permissionsJson,
        access: folder.access,
      }))
      .filter((folder: any) =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [subfolders, allFolders, allDocuments, searchQuery]);

  const filteredDocuments = useMemo(() => {
    return documents
      .map((doc: any) => ({
        // Preserve ACL / scope fields so canOn on cards matches the API.
        ...doc,
        folder: folder?.name || doc.folder || "",
        modifiedAt: new Date(doc.modifiedAt),
      }))
      .filter((doc: any) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [documents, folder, searchQuery]);

  // Apply sorting
  const sortedSubfolders = useMemo(() => {
    const sorted = [...filteredSubfolders];
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "modified":
        return sorted.sort(
          (a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime()
        );
      default:
        return sorted;
    }
  }, [filteredSubfolders, sortBy]);

  const sortedDocuments = useMemo(() => {
    const sorted = [...filteredDocuments];
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "size":
        return sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
      case "modified":
        return sorted.sort(
          (a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime()
        );
      default:
        return sorted;
    }
  }, [filteredDocuments, sortBy]);

  if (loading) {
    return <LoadingState type="card" />;
  }

  // Folder payload from the API is enough to render the shell; cards use canOn.
  if (!folder || !canOpenFolder) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={FolderPlus}
          title="Folder not found"
          description="The folder you're looking for doesn't exist or has been deleted."
          action={{
            label: "Go Back",
            onClick: () => router.push("/documents"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
              {folder.name}
            </h1>
            {folder.description && (
              <p className="break-words text-muted-foreground">{folder.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
          <PermissionButton
            variant="outline"
            allowed={can("folders.create") && canOn(folder, "write", "folder")}
            reason={
              whyNot(folder, "write", "folder") ??
              `The ${permissions.role} role cannot create folders.`
            }
            onClick={() => setCreateFolderDialogOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </PermissionButton>
          <PermissionButton
            variant="outline"
            allowed={can("workflows.create")}
            reason={`The ${permissions.role} role cannot create workflows.`}
            onClick={() => setCreateWorkflowDialogOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <Workflow className="mr-2 h-4 w-4" />
            Create Workflow
          </PermissionButton>
          <PermissionButton
            allowed={can("documents.create") && canOn(folder, "write", "folder")}
            reason={
              whyNot(folder, "write", "folder") ??
              `The ${permissions.role} role cannot upload documents.`
            }
            onClick={() => setUploadDialogOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </PermissionButton>
        </div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList className="flex-wrap">
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/documents">Documents</BreadcrumbLink>
          </BreadcrumbItem>
          {folderPath.map((folderInPath, index) => (
            <React.Fragment key={folderInPath.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {index === folderPath.length - 1 ? (
                  <BreadcrumbPage className="break-words">
                    {folderInPath.name}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={`/documents/folder/${folderInPath.id}`}
                    className="break-words"
                  >
                    {folderInPath.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="relative w-full min-w-0 flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={refreshingFolders || refreshingDocuments}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                refreshingFolders || refreshingDocuments ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modified">Last Modified</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
              <SelectItem value="created">Date Created</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1 border rounded-md">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
        {/* Workflows Section */}
        <WorkflowList
          workflows={workflows}
          isLoading={workflowsLoading}
          title="Related Workflows"
        />

        {/* Subfolders Section */}
        {sortedSubfolders.length > 0 && (
          <div>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Folders</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await refreshFolders();
                  toast.success("Folders refreshed");
                }}
                disabled={refreshingFolders}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshingFolders ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "space-y-4"
              }
            >
              {sortedSubfolders.map((subfolder) => {
                const subfolderPermission =
                  (subfolder as any).access?.canRead === true ||
                  hasFolderPermission(subfolder);
                return (
                  <FolderCard
                    key={subfolder.id}
                    folder={subfolder}
                    hasAccess={subfolderPermission}
                    onView={(id) => router.push(`/documents/folder/${id}`)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Documents Section */}
        {sortedDocuments.length > 0 && (
          <div>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Documents</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await refreshDocuments();
                  toast.success("Documents refreshed");
                }}
                disabled={refreshingDocuments}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshingDocuments ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "space-y-4"
              }
            >
              {sortedDocuments.map((doc) => {
                // A document inherits the containing folder's scope when its
                // own scope fields are not populated.
                const docFolder = allFolders.find((f: any) => f.id === (doc as any).folderId);
                const hasDocPermission =
                  (doc as any).access?.canRead === true ||
                  canOn(
                    {
                      ...doc,
                      companyId: (doc as any).companyId ?? docFolder?.companyId,
                      departmentId:
                        (doc as any).departmentId ?? docFolder?.departmentId,
                      divisionId:
                        (doc as any).divisionId ?? docFolder?.divisionId,
                      scopeLevel:
                        (doc as any).scopeLevel ??
                        doc.scope ??
                        docFolder?.scopeLevel,
                      permissionsJson:
                        (doc as any).permissionsJson ??
                        docFolder?.permissionsJson,
                    },
                    "read",
                    "document",
                  );

                return (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    hasAccess={hasDocPermission}
                    onView={(id) => router.push(`/documents/${id}`)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {sortedSubfolders.length === 0 && sortedDocuments.length === 0 && (
          <EmptyState
            icon={FolderPlus}
            title={searchQuery ? "No results found" : "Folder is empty"}
            description={
              searchQuery
                ? "Try adjusting your search query"
                : "Get started by uploading your first document or creating a subfolder"
            }
            action={
              !searchQuery
                ? {
                    label: "Upload Document",
                    onClick: () => setUploadDialogOpen(true),
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* Dialogs */}
      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        folderId={folderId}
      />
      <CreateFolderDialog
        open={createFolderDialogOpen}
        onOpenChange={setCreateFolderDialogOpen}
        parentFolderId={folderId}
      />
      <CreateWorkflowDialog
        open={createWorkflowDialogOpen}
        onOpenChange={setCreateWorkflowDialogOpen}
        folderId={folderId}
        onWorkflowCreated={() => {
          setCreateWorkflowDialogOpen(false);
          router.push("/workflows");
        }}
      />
    </div>
  );
}
