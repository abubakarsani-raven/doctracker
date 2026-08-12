"use client";

import { useState, useMemo } from "react";
import { FolderCard, DocumentCard, EmptyState, LoadingState, QueryErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileUploadDialog } from "@/components/features/documents/FileUploadDialog";
import { CreateFolderDialog } from "@/components/features/documents/CreateFolderDialog";
import { EditFolderDialog } from "@/components/features/documents/EditFolderDialog";
import { CreateRichTextDocumentDialog } from "@/components/features/documents/CreateRichTextDocumentDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { 
  Plus, 
  Upload, 
  FolderPlus, 
  Grid3x3, 
  List, 
  Search, 
  Filter,
  FileText,
  X,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { hasAccessToResource } from "@/lib/access-request-utils";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { PermissionButton } from "@/components/common/PermissionButton";
import {
  DocumentFilters,
  ActiveFilterChips,
  EMPTY_FILTERS,
  countActiveFilters,
  matchesFilters,
  fileKind,
  fileKindLabel,
  type DocumentFilterState,
  type DocumentFacets,
} from "@/components/features/documents/DocumentFilters";

import { useCompanies } from "@/lib/hooks/use-companies";
import { useFolders } from "@/lib/hooks/use-documents";
import { useDocuments } from "@/lib/hooks/use-documents";
import { countDocumentsInFolderTree } from "@/lib/folder-utils";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function DocumentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { can, canOn, whyNot, isMaster, permissions, scopeDescription } =
    usePermissions();
  const { data: companies = [] } = useCompanies();
  const {
    data: allFolders = [],
    isLoading: foldersLoading,
    isFetching: foldersFetching,
    isError: foldersError,
    error: foldersErr,
    refetch: refetchFolders,
  } = useFolders();
  const {
    data: allDocuments = [],
    isLoading: documentsLoading,
    isFetching: documentsFetching,
    isError: documentsError,
    error: documentsErr,
    refetch: refetchDocuments,
  } = useDocuments();
  
  const loading = foldersLoading || documentsLoading;
  const isError = foldersError || documentsError;
  const error = foldersErr || documentsErr;
  const refreshingFolders = foldersFetching && !foldersLoading;
  const refreshingDocuments = documentsFetching && !documentsLoading;

  const refreshFolders = async () => {
    await Promise.all([
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
  const [editFolderDialogOpen, setEditFolderDialogOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | undefined>(undefined);
  const [createRichTextDialogOpen, setCreateRichTextDialogOpen] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | undefined>(undefined);
  const [deletingFolder, setDeletingFolder] = useState(false);
  
  const [filters, setFilters] = useState<DocumentFilterState>(EMPTY_FILTERS);

  // Access checks come from lib/permissions, which reads the capability list
  // the API resolved for this session. Previously each of these was a bespoke
  // ladder of role-name comparisons that had to be kept in sync by hand — and
  // was not: the folder page, this page and the API all disagreed.
  const hasFolderPermission = (folder: any): boolean =>
    canOn(folder, "read", "folder");

  const hasDocumentPermission = (doc: any): boolean => {
    // A document inherits the scope of the folder holding it when its own
    // scope fields are not populated.
    const folder = allFolders.find((f: any) => f.id === doc.folderId);
    return canOn(
      {
        ...doc,
        companyId: doc.companyId ?? folder?.companyId,
        departmentId: doc.departmentId ?? folder?.departmentId,
        divisionId: doc.divisionId ?? folder?.divisionId,
        scopeLevel: doc.scopeLevel ?? doc.scope ?? folder?.scopeLevel,
      },
      "read",
      "document"
    );
  };

  // Show folders from user's company (but restrict access)
  // IMPORTANT: Show ALL folders from user's company, regardless of permission
  // Access control is handled by hasAccess prop on FolderCard
  const folders = useMemo(() => {
    // If no user/companies, show all folders (will be filtered by company later)
    if (!currentUser || !companies.length) {
      return allFolders;
    }

    // Folders outside the user's own access are still listed so they can see
    // what exists and request access; only other companies are filtered out.
    return allFolders.filter((folder: any) =>
      isMaster ? true : folder.companyId === permissions.companyId
    );
  }, [allFolders, currentUser, isMaster, permissions.companyId]);

  // Show documents from user's company (but restrict access)
  // IMPORTANT: Show ALL documents from user's company, regardless of permission
  // Access control is handled by hasAccess prop on DocumentCard
  const documents = useMemo(() => {
    // If no user/companies, show all documents (will be filtered by company later)
    if (!currentUser || !companies.length) {
      return allDocuments;
    }

    return allDocuments.filter((doc: any) => {
      if (isMaster) return true;

      const companyId =
        doc.companyId ??
        allFolders.find((f: any) => f.id === doc.folderId)?.companyId;

      // A document with no company attribution at all is left visible rather
      // than hidden on a metadata gap; the access check still gates opening it.
      return companyId ? companyId === permissions.companyId : true;
    });
  }, [allDocuments, allFolders, currentUser, isMaster, permissions.companyId]);

  // Only show root folders (no parent) in the folders list
  const rootFolders = folders.filter((f: any) => !f.parentFolderId);
  
  // Apply filters and search
  const filteredFolders = useMemo(() => {
    return rootFolders
      .map((folder: any) => ({
        // Spread the record rather than picking fields: the access check needs
        // companyId, scopeLevel, departmentId, divisionId and permissionsJson,
        // and a hand-written pick silently dropped them — which made every
        // folder look like it belonged to another company.
        ...folder,
        // Include nested documents so registry parents are not stuck at "0 files".
        documentCount: countDocumentsInFolderTree(folder.id, folders, documents),
        modifiedAt: new Date(folder.modifiedAt),
        type: "folder" as const,
      }))
      .filter((folder: any) => {
        // Search filter
        if (searchQuery && !folder.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !folder.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        // Scope filter
        if (!matchesFilters({ ...folder, hasAccess: hasFolderPermission(folder) }, filters)) {
          return false;
        }
        
        return true;
      });
  }, [rootFolders, folders, documents, searchQuery, filters, canOn]);

  const filteredDocuments = useMemo(() => {
    return documents
      .map((doc: any) => {
        // Calculate folderCount - for now, check if document appears in multiple places
        // TODO: Replace with actual file_folder_links lookup when available
        const folderIds = doc.folderIds || (doc.folderId ? [doc.folderId] : []);
        const folderCount = folderIds.length;
        const folderNames = folderIds.map((fid: string) => 
          folders.find((f: any) => f.id === fid)?.name || `Folder ${fid}`
        );
        
        return {
          // Spread rather than pick, so companyId / scopeLevel / departmentId /
          // divisionId / permissionsJson survive for the access check.
          ...doc,
          folder: folders.find((f: any) => f.id === doc.folderId)?.name || "",
          folderCount,
          folderIds,
          folderNames,
          modifiedAt: new Date(doc.modifiedAt),
          tags: doc.tags || [],
          fileType: doc.type,
        };
      })
      .filter((doc: any) => {
        // Search filter
        if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !doc.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        // Scope filter
        if (!matchesFilters({ ...doc, hasAccess: hasDocumentPermission(doc) }, filters)) {
          return false;
        }
        
        return true;
      });
  }, [documents, folders, searchQuery, filters, canOn]);

  // Apply sorting
  const sortedFolders = useMemo(() => {
    const sorted = [...filteredFolders];
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "modified":
        return sorted.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
      case "created":
        return sorted; // Would need createdAt field
      default:
        return sorted;
    }
  }, [filteredFolders, sortBy]);

  const sortedDocuments = useMemo(() => {
    const sorted = [...filteredDocuments];
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "size":
        return sorted.sort((a, b) => b.size - a.size);
      case "modified":
        return sorted.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
      case "created":
        return sorted; // Would need createdAt field
      default:
        return sorted;
    }
  }, [filteredDocuments, sortBy]);

  const activeFiltersCount = countActiveFilters(filters);

  /**
   * Option lists with counts, derived from what is actually on the page. A
   * facet with no matches is dropped rather than shown as a dead end.
   */
  const facets: DocumentFacets = useMemo(() => {
    const tally = (
      items: any[],
      key: (item: any) => string | null | undefined,
    ) => {
      const counts = new Map<string, number>();
      for (const item of items) {
        const value = key(item);
        if (!value) continue;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return counts;
    };

    const everything = [...folders, ...documents];

    const departmentNames = new Map<string, string>();
    const companyNames = new Map<string, string>();
    for (const company of companies as any[]) {
      companyNames.set(company.id, company.name);
      for (const department of company.departments ?? []) {
        departmentNames.set(department.id, department.name);
      }
    }

    const peopleNames = new Map<string, string>();
    for (const item of everything) {
      if (item.createdBy && item.createdByName) {
        peopleNames.set(item.createdBy, item.createdByName);
      }
    }

    const toOptions = (
      counts: Map<string, number>,
      label: (value: string) => string,
    ) =>
      [...counts.entries()]
        .map(([value, count]) => ({ value, label: label(value), count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const scopeLabels: Record<string, string> = {
      company: "Company-wide",
      department: "Department",
      division: "Division",
    };

    const openCount = everything.filter((item: any) =>
      item.folderId !== undefined
        ? hasDocumentPermission(item)
        : hasFolderPermission(item),
    ).length;

    return {
      scopes: toOptions(
        tally(everything, (i) => i.scopeLevel ?? i.scope),
        (v) => scopeLabels[v] ?? v,
      ),
      fileTypes: toOptions(
        tally(documents, (i) => fileKind(i.fileType ?? i.type).value),
        (v) => fileKindLabel(v),
      ),
      departments: toOptions(
        tally(everything, (i) => i.departmentId),
        (v) => departmentNames.get(v) ?? "Unknown department",
      ),
      companies: toOptions(
        tally(everything, (i) => i.companyId),
        (v) => companyNames.get(v) ?? "Unknown company",
      ),
      people: toOptions(
        tally(everything, (i) => i.createdBy),
        (v) => peopleNames.get(v) ?? "Unknown",
      ),
      access: {
        open: openCount,
        restricted: everything.length - openCount,
      },
    };
  }, [folders, documents, companies, canOn]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="register-label">Registry</p>
          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">
            Documents
          </h1>
          <p className="text-muted-foreground">
            {scopeDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PermissionButton
            variant="outline"
            allowed={can("documents.create")}
            reason={`The ${permissions.role} role cannot create documents.`}
            onClick={() => setCreateRichTextDialogOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <FileText className="mr-2 h-4 w-4" />
            New Document
          </PermissionButton>
          <PermissionButton
            variant="outline"
            allowed={can("folders.create")}
            reason={`The ${permissions.role} role cannot create folders.`}
            onClick={() => setCreateFolderDialogOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </PermissionButton>
          <PermissionButton
            allowed={can("documents.create")}
            reason={`The ${permissions.role} role cannot upload documents.`}
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
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/documents">Documents</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap sm:gap-4">
        <div className="relative w-full min-w-0 flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
          <DocumentFilters
            value={filters}
            onChange={setFilters}
            facets={facets}
            showCompanies={isMaster}
          />

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
          
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
            <TabsList>
              <TabsTrigger value="grid">
                <Grid3x3 className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* What is currently filtered, so it is never hidden behind the popover */}
      <ActiveFilterChips value={filters} onChange={setFilters} facets={facets} />

      {/* Content */}
      {loading ? (
        <LoadingState type="card" count={6} />
      ) : isError ? (
        <QueryErrorState
          title="Failed to load documents"
          error={error}
          onRetry={() => {
            refetchFolders();
            refetchDocuments();
          }}
        />
      ) : (
        <div className="space-y-8">
          {/* Folders Section */}
          {sortedFolders.length > 0 && (
            <div>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Folders</h2>
                <div className="flex flex-wrap items-center gap-1">
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
              </div>
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    : "space-y-4"
                }
              >
                {sortedFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    hasAccess={hasAccessToResource(
                      folder.id,
                      "folder",
                      currentUser,
                      hasFolderPermission(folder)
                    )}
                    accessReason={whyNot(folder, "read", "folder")}
                    onView={(id) => router.push(`/documents/folder/${id}`)}
                    onEdit={
                      canOn(folder, "write", "folder")
                        ? (id) => {
                            setEditingFolderId(id);
                            setEditFolderDialogOpen(true);
                          }
                        : undefined
                    }
                    onDelete={
                      canOn(folder, "delete", "folder")
                        ? (id) => setDeleteFolderId(id)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Documents Section */}
          {sortedDocuments.length > 0 && (
            <div>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Documents</h2>
                <div className="flex flex-wrap items-center gap-1">
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
              </div>
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    : "space-y-4"
                }
              >
                {sortedDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    hasAccess={hasAccessToResource(
                      doc.id,
                      "document",
                      currentUser,
                      hasDocumentPermission(doc)
                    )}
                    accessReason={whyNot(doc, "read", "document")}
                    onView={(id) => router.push(`/documents/${id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {sortedFolders.length === 0 && sortedDocuments.length === 0 && (
            <EmptyState
              icon={FolderPlus}
              title={searchQuery || activeFiltersCount > 0 ? "No results found" : "No documents yet"}
              description={
                searchQuery || activeFiltersCount > 0
                  ? "Try adjusting your search query or filters"
                  : "Get started by uploading your first document or creating a folder"
              }
              action={
                !searchQuery && activeFiltersCount === 0
                  ? {
                      label: "Upload Document",
                      onClick: () => setUploadDialogOpen(true),
                    }
                  : undefined
              }
            />
          )}
        </div>
      )}

      {/* Dialogs */}
      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onFilesUploaded={() => {
          // Refresh would happen here
        }}
      />
      <CreateFolderDialog
        open={createFolderDialogOpen}
        onOpenChange={setCreateFolderDialogOpen}
      />
      <EditFolderDialog
        open={editFolderDialogOpen}
        onOpenChange={(open) => {
          setEditFolderDialogOpen(open);
          if (!open) setEditingFolderId(undefined);
        }}
        folderId={editingFolderId}
        onFolderUpdated={() => {
          // Refresh would happen here
        }}
      />
      <CreateRichTextDocumentDialog
        open={createRichTextDialogOpen}
        onOpenChange={setCreateRichTextDialogOpen}
        onDocumentCreated={() => {
          // Refresh would happen here
        }}
      />
      <ConfirmDialog
        open={!!deleteFolderId}
        onOpenChange={(open) => {
          if (!open) setDeleteFolderId(undefined);
        }}
        title="Delete folder?"
        description="This soft-deletes the folder. Documents inside may become harder to find until an admin restores it."
        confirmLabel="Delete folder"
        variant="destructive"
        loading={deletingFolder}
        onConfirm={async () => {
          if (!deleteFolderId) return;
          setDeletingFolder(true);
          try {
            await api.deleteFolder(deleteFolderId);
            toast.success("Folder deleted");
            setDeleteFolderId(undefined);
            await refreshFolders();
          } catch (error: any) {
            toast.error(error?.message || "Failed to delete folder");
          } finally {
            setDeletingFolder(false);
          }
        }}
      />
    </div>
  );
}
