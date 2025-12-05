"use client";

import React, { useState, useEffect } from "react";
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
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";
import { hasAccessToResource } from "@/lib/access-request-utils";
import { AccessRequestDialog } from "@/components/features/documents/AccessRequestDialog";

export default function FolderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.id as string;
  const { currentUser, companies, folders: contextFolders } = useMockData();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("modified");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [createWorkflowDialogOpen, setCreateWorkflowDialogOpen] = useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<any>(null);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [subfolders, setSubfolders] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [folderPath, setFolderPath] = useState<any[]>([]);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Build folder path hierarchy (all parent folders)
  const buildFolderPath = (folderId: string, folders: any[]): any[] => {
    const currentFolder = folders.find((f: any) => f.id === folderId);
    if (!currentFolder) return [];

    const path: any[] = [currentFolder];

    // If this folder has a parent, recursively build the path
    if (currentFolder.parentFolderId) {
      const parentPath = buildFolderPath(currentFolder.parentFolderId, folders);
      return [...parentPath, ...path];
    }

    return path;
  };

  // Helper function to check if access is explicitly revoked/denied
  const isAccessRevoked = (folder: any): boolean => {
    // Check permissionsJson for explicit denials (if permissions system is implemented)
    if (folder.permissionsJson) {
      try {
        const perms = typeof folder.permissionsJson === 'string' 
          ? JSON.parse(folder.permissionsJson) 
          : folder.permissionsJson;
        // Check if there's a denied entry for this user
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
    if (!currentUser || !companies) return false;

    // Check if access is explicitly revoked (by higher roles)
    if (isAccessRevoked(folder)) {
      return false;
    }

    // Get user's company and department IDs
    const userCompanyId = currentUser.companyId;
    let userDeptId: string | null = null;
    let userDivId: string | null = null;

    const userCompany = companies.find((c: any) => c.id === userCompanyId);
    if (userCompany?.departments) {
      const userDept = userCompany.departments.find((d: any) => d.name === currentUser.department);
      if (userDept) {
        userDeptId = userDept.id;
        if (userDept.divisions) {
          const userDiv = userDept.divisions.find((d: any) => d.name === currentUser.division);
          if (userDiv) {
            userDivId = userDiv.id;
          }
        }
      }
    }

    // Master role can access everything (cannot be overridden)
    if (currentUser.role === "Master") return true;

    // Company Admin can access all folders in their company
    if (currentUser.role === "Company Admin") {
      return folder.companyId === userCompanyId;
    }

    // Use scopeLevel if available, fallback to scope
    const folderScope = folder.scopeLevel || folder.scope;

    // Department Head can access department-wide and division-wide folders in their department
    if (currentUser.role === "Department Head") {
      if (folderScope === "company") {
        return folder.companyId === userCompanyId;
      }
      return folder.departmentId === userDeptId;
    }

    // Division Head can access division-wide folders in their division
    if (currentUser.role === "Division Head") {
      if (folderScope === "company") {
        return folder.companyId === userCompanyId;
      }
      if (folderScope === "department") {
        return folder.departmentId === userDeptId;
      }
      return folderScope === "division" && folder.departmentId === userDeptId;
    }

    // Regular users (Staff, Manager, etc.): scope-based access
    let hasScopeAccess = false;
    if (folderScope === "company") {
      hasScopeAccess = folder.companyId === userCompanyId;
    } else if (folderScope === "department") {
      hasScopeAccess = folder.departmentId === userDeptId;
    } else if (folderScope === "division") {
      hasScopeAccess = folder.departmentId === userDeptId && userDivId !== null;
    }

    // If user has scope-based access, grant it
    if (hasScopeAccess) {
      return true;
    }

    // Creator has default access UNLESS explicitly revoked (checked above)
    // This allows higher roles to revoke creator access
    if (folder.createdBy === currentUser.id) {
      return true;
    }

    return false;
  };

  useEffect(() => {
    const loadData = async () => {
      if (!folderId) return;
      
      setLoading(true);
      try {
        // Use context data if available, otherwise fetch
        const foldersData = contextFolders && contextFolders.length > 0 
          ? contextFolders 
          : await api.getFolders();
        const documentsData = await api.getDocuments();

        setAllFolders(foldersData);

        // Find the current folder
        const currentFolder = foldersData.find((f: any) => f.id === folderId);
        
        if (!currentFolder) {
          setFolder(null);
          setHasAccess(false);
          setLoading(false);
          return;
        }

        setFolder(currentFolder);

        // Check access permission - must have currentUser and companies
        if (!currentUser || !companies) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        const hasPermission = hasFolderPermission(currentFolder);
        const access = hasAccessToResource(
          folderId,
          "folder",
          currentUser,
          hasPermission
        );
        setHasAccess(access);

        console.log('[Folder Detail] Access check:', {
          folderId,
          folderName: currentFolder.name,
          hasPermission,
          access,
          userRole: currentUser.role,
          userCompanyId: currentUser.companyId,
          folderCompanyId: currentFolder.companyId,
        });

        // If no access, don't load content
        if (!access) {
          setLoading(false);
          return;
        }

        // Build folder path hierarchy
        const path = buildFolderPath(folderId, foldersData);
        setFolderPath(path);

        // Filter subfolders and documents for this folder
        const folderSubfolders = foldersData.filter(
          (f: any) => f.parentFolderId === folderId
        );
        setSubfolders(folderSubfolders);

        const folderDocuments = documentsData.filter(
          (d: any) => d.folderId === folderId
        );
        setDocuments(folderDocuments);
      } catch (error) {
        console.error("Failed to load folder data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (folderId) {
      loadData();
    }
  }, [folderId, currentUser, companies, contextFolders]);

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

  const filteredSubfolders = subfolders
    .map((folder: any) => ({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      scope: folder.scope,
      documentCount: folder.documentCount || documents.filter((d: any) => d.folderId === folder.id).length,
      modifiedAt: new Date(folder.modifiedAt),
      createdBy: folder.createdBy,
    }))
    .filter((folder: any) =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredDocuments = documents
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
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
        {/* Subfolders Section */}
        {filteredSubfolders.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Folders</h2>
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  : "space-y-4"
              }
            >
              {filteredSubfolders.map((subfolder) => {
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
        {filteredDocuments.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Documents</h2>
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  : "space-y-4"
              }
            >
              {filteredDocuments.map((doc) => {
                // Check document permission
                const docFolder = allFolders.find((f: any) => f.id === doc.folder);
                let hasDocPermission = false;
                
                if (currentUser && companies && docFolder) {
                  const userCompanyId = currentUser.companyId;
                  let userDeptId: string | null = null;
                  let userDivId: string | null = null;

                  const userCompany = companies.find((c: any) => c.id === userCompanyId);
                  if (userCompany?.departments) {
                    const userDept = userCompany.departments.find((d: any) => d.name === currentUser.department);
                    if (userDept) {
                      userDeptId = userDept.id;
                      if (userDept.divisions) {
                        const userDiv = userDept.divisions.find((d: any) => d.name === currentUser.division);
                        if (userDiv) {
                          userDivId = userDiv.id;
                        }
                      }
                    }
                  }

                  if (currentUser.role === "Master") {
                    hasDocPermission = true;
                  } else {
                    const docScope = doc.scope;
                    if (docScope === "company") {
                      hasDocPermission = docFolder.companyId === userCompanyId;
                    } else if (docScope === "department") {
                      hasDocPermission = docFolder.departmentId === userDeptId;
                    } else if (docScope === "division") {
                      hasDocPermission = docFolder.departmentId === userDeptId && userDivId !== null;
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
        {filteredSubfolders.length === 0 && filteredDocuments.length === 0 && (
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
        onOpenChange={(open) => {
          setCreateFolderDialogOpen(open);
          if (!open) {
            // Reload data when dialog closes (folder might have been created)
            if (folderId) {
              const loadData = async () => {
                try {
                  const [foldersData, documentsData] = await Promise.all([
                    api.getFolders(),
                    api.getDocuments(),
                  ]);
                  setAllFolders(foldersData);
                  const currentFolder = foldersData.find((f: any) => f.id === folderId);
                  if (currentFolder) {
                    setFolder(currentFolder);
                    const folderSubfolders = foldersData.filter(
                      (f: any) => f.parentFolderId === folderId
                    );
                    setSubfolders(folderSubfolders);
                    const folderDocuments = documentsData.filter(
                      (d: any) => d.folderId === folderId
                    );
                    setDocuments(folderDocuments);
                  }
                } catch (error) {
                  console.error("Failed to reload folder data:", error);
                }
              };
              loadData();
            }
          }
        }}
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
