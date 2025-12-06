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
import { Upload, FolderPlus, Grid3x3, List, Search, ArrowLeft, Workflow, Lock } from "lucide-react";
import { hasAccessToResource } from "@/lib/access-request-utils";
import { AccessRequestDialog } from "@/components/features/documents/AccessRequestDialog";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useFolder, useFolders } from "@/lib/hooks/use-documents";
import { useDocuments } from "@/lib/hooks/use-documents";
import { useWorkflowsByFolder } from "@/lib/hooks/use-workflows";
import { WorkflowList } from "@/components/features/workflows/WorkflowList";

export default function FolderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.id as string;
  
  const { data: currentUser } = useCurrentUser();
  const { data: companies = [] } = useCompanies();
  const { data: folder, isLoading: folderLoading } = useFolder(folderId);
  const { data: allFolders = [] } = useFolders();
  const { data: allDocuments = [] } = useDocuments();
  const { data: workflows = [], isLoading: workflowsLoading } = useWorkflowsByFolder(folderId);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("modified");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [createWorkflowDialogOpen, setCreateWorkflowDialogOpen] = useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);

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

  // Get user context for permissions
  const userContext = useMemo(() => {
    if (!currentUser || !companies.length) {
      return { userDeptId: null, userDivId: null, userCompanyId: null };
    }

    let userCompanyId: string | null = currentUser.companyId || null;
    const userDeptName = currentUser.department;
    const userDivName = currentUser.division;
    let userDeptId: string | null = null;
    let userDivId: string | null = null;

    if (!userCompanyId) {
      companies.forEach((company: any) => {
        if (company.departments) {
          company.departments.forEach((dept: any) => {
            if (dept.name === userDeptName) {
              userDeptId = dept.id;
              if (!userCompanyId) {
                userCompanyId = company.id;
              }
              if (dept.divisions && userDivName) {
                dept.divisions.forEach((div: any) => {
                  if (div.name === userDivName) {
                    userDivId = div.id;
                  }
                });
              }
            }
          });
        }
      });
    } else {
      const userCompany = companies.find((c: any) => c.id === userCompanyId);
      if (userCompany?.departments) {
        userCompany.departments.forEach((dept: any) => {
          if (dept.name === userDeptName) {
            userDeptId = dept.id;
            if (dept.divisions && userDivName) {
              dept.divisions.forEach((div: any) => {
                if (div.name === userDivName) {
                  userDivId = div.id;
                }
              });
            }
          }
        });
      }
    }

    return { userDeptId, userDivId, userCompanyId };
  }, [currentUser, companies]);

  // Helper function to check if access is explicitly revoked/denied
  const isAccessRevoked = (folder: any): boolean => {
    if (folder.permissionsJson) {
      try {
        const perms =
          typeof folder.permissionsJson === "string"
            ? JSON.parse(folder.permissionsJson)
            : folder.permissionsJson;
        if (perms.denied && Array.isArray(perms.denied)) {
          return perms.denied.includes(currentUser?.id);
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
    return false;
  };

  // Helper function to check if user has permission to a folder
  const hasFolderPermission = (folder: any): boolean => {
    if (!currentUser || !companies.length) return false;
    const { userDeptId, userDivId, userCompanyId } = userContext;

    if (isAccessRevoked(folder)) {
      return false;
    }

    if (currentUser.role === "Master") return true;

    if (currentUser.role === "Company Admin") {
      return folder.companyId === userCompanyId;
    }

    const folderScope = folder.scopeLevel || folder.scope;

    if (currentUser.role === "Department Head") {
      if (folderScope === "company") {
        return folder.companyId === userCompanyId;
      }
      return folder.departmentId === userDeptId;
    }

    if (currentUser.role === "Division Head") {
      if (folderScope === "company") {
        return folder.companyId === userCompanyId;
      }
      if (folderScope === "department") {
        return folder.departmentId === userDeptId;
      }
      return folderScope === "division" && folder.departmentId === userDeptId;
    }

    let hasScopeAccess = false;
    if (folderScope === "company") {
      hasScopeAccess = folder.companyId === userCompanyId;
    } else if (folderScope === "department") {
      hasScopeAccess = folder.departmentId === userDeptId;
    } else if (folderScope === "division") {
      hasScopeAccess = folder.departmentId === userDeptId && userDivId !== null;
    }

    if (hasScopeAccess) {
      return true;
    }

    if (folder.createdBy === currentUser.id) {
      return true;
    }

    return false;
  };

  // Check access for current folder
  const hasAccess = useMemo(() => {
    if (!folder || !currentUser || !companies.length) return null;

    const hasPermission = hasFolderPermission(folder);
    return hasAccessToResource(folderId, "folder", currentUser, hasPermission);
  }, [folder, currentUser, companies, folderId, userContext]);

  // Filter subfolders and documents for this folder
  const subfolders = useMemo(() => {
    if (!folderId) return [];
    return allFolders.filter((f: any) => f.parentFolderId === folderId);
  }, [allFolders, folderId]);

  const documents = useMemo(() => {
    if (!folderId) return [];
    return allDocuments.filter((d: any) => d.folderId === folderId);
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
        documentCount:
          folder.documentCount ||
          documents.filter((d: any) => d.folderId === folder.id).length,
        modifiedAt: new Date(folder.modifiedAt),
        createdBy: folder.createdBy,
      }))
      .filter((folder: any) =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [subfolders, documents, searchQuery]);

  const filteredDocuments = useMemo(() => {
    return documents
      .map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        size: doc.size,
        folder: folder?.name || "",
        scope: doc.scope,
        status: doc.status,
        modifiedAt: new Date(doc.modifiedAt),
        createdBy: doc.createdBy,
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

  if (!folder) {
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

  // Check access - if no access, show access denied message
  if (hasAccess === false) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/documents")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{folder.name}</h1>
            {folder.description && (
              <p className="text-muted-foreground">{folder.description}</p>
            )}
          </div>
        </div>
        <EmptyState
          icon={Lock}
          title="Access Denied"
          description="You don't have permission to access this folder. Request access to view its contents."
          action={{
            label: "Request Access",
            onClick: () => setRequestAccessOpen(true),
          }}
        />
        <AccessRequestDialog
          open={requestAccessOpen}
          onOpenChange={setRequestAccessOpen}
          resourceId={folder.id}
          resourceType="folder"
          resourceName={folder.name}
          scope={folder.scope || folder.scopeLevel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{folder.name}</h1>
            {folder.description && (
              <p className="text-muted-foreground">{folder.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCreateFolderDialogOpen(true)}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
          <Button
            variant="outline"
            onClick={() => setCreateWorkflowDialogOpen(true)}
          >
            <Workflow className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
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
          {folderPath.map((folderInPath, index) => (
            <React.Fragment key={folderInPath.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {index === folderPath.length - 1 ? (
                  <BreadcrumbPage>{folderInPath.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={`/documents/folder/${folderInPath.id}`}>
                    {folderInPath.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
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
            <h2 className="text-xl font-semibold mb-4">Folders</h2>
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  : "space-y-4"
              }
            >
              {sortedSubfolders.map((subfolder) => {
                const subfolderPermission = hasFolderPermission(subfolder);
                const subfolderAccess = hasAccessToResource(
                  subfolder.id,
                  "folder",
                  currentUser,
                  subfolderPermission
                );
                return (
                  <FolderCard
                    key={subfolder.id}
                    folder={subfolder}
                    hasAccess={subfolderAccess}
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
            <h2 className="text-xl font-semibold mb-4">Documents</h2>
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  : "space-y-4"
              }
            >
              {sortedDocuments.map((doc) => {
                // For documents, check permission via folder
                const docFolder = allFolders.find((f: any) => f.id === (doc as any).folderId);
                let hasDocPermission = false;

                if (currentUser && companies.length && docFolder) {
                  const { userDeptId, userDivId, userCompanyId } = userContext;

                  if (currentUser.role === "Master") {
                    hasDocPermission = true;
                  } else {
                    const docScope = doc.scope || docFolder.scope;
                    if (docScope === "company") {
                      hasDocPermission = docFolder.companyId === userCompanyId;
                    } else if (docScope === "department") {
                      hasDocPermission = docFolder.departmentId === userDeptId;
                    } else if (docScope === "division") {
                      hasDocPermission =
                        docFolder.departmentId === userDeptId && userDivId !== null;
                    }
                  }
                }

                const docAccess = hasAccessToResource(
                  doc.id,
                  "document",
                  currentUser,
                  hasDocPermission
                );

                return (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    hasAccess={docAccess}
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
