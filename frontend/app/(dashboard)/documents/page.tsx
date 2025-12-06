"use client";

import { useState, useMemo } from "react";
import { FolderCard, DocumentCard, EmptyState, LoadingState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AddToFolderDialog } from "@/components/features/documents/AddToFolderDialog";
import { BulkOperations } from "@/components/features/documents/BulkOperations";
import { ExportDialog } from "@/components/features/documents/ExportDialog";
import { ArchiveDialog } from "@/components/features/documents/ArchiveDialog";
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
  CheckSquare,
  Square
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { hasAccessToResource } from "@/lib/access-request-utils";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useFolders } from "@/lib/hooks/use-documents";
import { useDocuments } from "@/lib/hooks/use-documents";

export default function DocumentsPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: companies = [] } = useCompanies();
  const { data: allFolders = [], isLoading: foldersLoading } = useFolders();
  const { data: allDocuments = [], isLoading: documentsLoading } = useDocuments();
  
  const loading = foldersLoading || documentsLoading;
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("modified");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [editFolderDialogOpen, setEditFolderDialogOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | undefined>(undefined);
  const [createRichTextDialogOpen, setCreateRichTextDialogOpen] = useState(false);
  const [addToFolderDialogOpen, setAddToFolderDialogOpen] = useState(false);
  const [addingDocumentId, setAddingDocumentId] = useState<string | undefined>(undefined);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Filter states
  const [filterScope, setFilterScope] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // Get user's department and division IDs from companies data
  const userContext = useMemo(() => {
    if (!currentUser || !companies.length) {
      return { userDeptId: null, userDivId: null, userCompanyId: null };
    }

    // First, try to get companyId directly from currentUser
    let userCompanyId: string | null = currentUser.companyId || null;
    
    const userDeptName = currentUser.department;
    const userDivName = currentUser.division;
    let userDeptId: string | null = null;
    let userDivId: string | null = null;

    // If no companyId on user, try to find it via department
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
      // If we have companyId, find department/division IDs
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
    // Check permissionsJson for explicit denials (if permissions system is implemented)
    // For now, this can be extended when explicit revocation is added
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
    if (!currentUser || !companies.length) return false;
    const { userDeptId, userDivId, userCompanyId } = userContext;

    // Check if access is explicitly revoked (by higher roles)
    if (isAccessRevoked(folder)) {
      return false;
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

  // Helper function to check if document access is explicitly revoked/denied
  const isDocumentAccessRevoked = (doc: any): boolean => {
    // Check permissionsJson for explicit denials (if permissions system is implemented)
    if (doc.permissionsJson) {
      try {
        const perms = typeof doc.permissionsJson === 'string' 
          ? JSON.parse(doc.permissionsJson) 
          : doc.permissionsJson;
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

  // Helper function to check if user has permission to a document
  const hasDocumentPermission = (doc: any): boolean => {
    if (!currentUser || !companies.length) return false;
    const { userDeptId, userDivId, userCompanyId } = userContext;

    // Check if access is explicitly revoked (by higher roles)
    if (isDocumentAccessRevoked(doc)) {
      return false;
    }

    // Find the folder this document belongs to
    const documentFolder = allFolders.find((f: any) => f.id === doc.folderId);
    if (!documentFolder) {
      return false;
    }

    // Master role can access everything (cannot be overridden)
    if (currentUser.role === "Master") return true;

    // Company Admin can access all documents in their company
    if (currentUser.role === "Company Admin") {
      return documentFolder.companyId === userCompanyId;
    }

    // Use scopeLevel if available, fallback to scope
    const docScope = doc.scopeLevel || doc.scope;

    // Department Head can access department-wide and division-wide documents in their department
    if (currentUser.role === "Department Head") {
      if (docScope === "company") {
        return documentFolder.companyId === userCompanyId;
      }
      return documentFolder.departmentId === userDeptId;
    }

    // Division Head can access division-wide documents in their division
    if (currentUser.role === "Division Head") {
      if (docScope === "company") {
        return documentFolder.companyId === userCompanyId;
      }
      if (docScope === "department") {
        return documentFolder.departmentId === userDeptId;
      }
      return docScope === "division" && documentFolder.departmentId === userDeptId;
    }

    // Regular users (Staff, Manager, etc.): scope-based access
    let hasScopeAccess = false;
    if (docScope === "company") {
      hasScopeAccess = documentFolder.companyId === userCompanyId;
    } else if (docScope === "department") {
      hasScopeAccess = documentFolder.departmentId === userDeptId;
    } else if (docScope === "division") {
      hasScopeAccess = documentFolder.departmentId === userDeptId && userDivId !== null;
    }

    // If user has scope-based access, grant it
    if (hasScopeAccess) {
      return true;
    }

    // Creator has default access UNLESS explicitly revoked (checked above)
    // This allows higher roles to revoke creator access
    if (doc.createdBy === currentUser.id) {
      return true;
    }

    return false;
  };

  // Show folders from user's company (but restrict access)
  // IMPORTANT: Show ALL folders from user's company, regardless of permission
  // Access control is handled by hasAccess prop on FolderCard
  const folders = useMemo(() => {
    // If no user/companies, show all folders (will be filtered by company later)
    if (!currentUser || !companies.length) {
      return allFolders;
    }

    const { userCompanyId } = userContext;

    // Filter by company - users can only see folders from their company
    // But show ALL folders from their company, even if they don't have access
    const filtered = allFolders.filter((folder: any) => {
      // Master can see all companies
      if (currentUser.role === "Master") return true;
      
      // Others can only see folders from their company
      // Show them even if they don't have permission - they can request access
      return folder.companyId === userCompanyId;
    });
    
    return filtered;
  }, [allFolders, currentUser, userContext, companies]);

  // Show documents from user's company (but restrict access)
  // IMPORTANT: Show ALL documents from user's company, regardless of permission
  // Access control is handled by hasAccess prop on DocumentCard
  const documents = useMemo(() => {
    // If no user/companies, show all documents (will be filtered by company later)
    if (!currentUser || !companies.length) {
      return allDocuments;
    }

    const { userCompanyId } = userContext;

    // Filter by company - users can only see documents from their company
    // But show ALL documents from their company, even if they don't have access
    const filtered = allDocuments.filter((doc: any) => {
      // Master can see all companies
      if (currentUser.role === "Master") return true;
      
      // Check document's companyId first (if available)
      if (doc.companyId) {
        return doc.companyId === userCompanyId;
      }
      
      // If no companyId on document, check via folder
      const documentFolder = allFolders.find((f: any) => f.id === doc.folderId);
      if (documentFolder) {
        return documentFolder.companyId === userCompanyId;
      }
      
      // If no folder and no companyId, include it (let access control handle it)
      // This ensures documents aren't hidden just because they lack metadata
      return true;
    });
    
    return filtered;
  }, [allDocuments, allFolders, currentUser, userContext, companies]);

  // Only show root folders (no parent) in the folders list
  const rootFolders = folders.filter((f: any) => !f.parentFolderId);
  
  // Apply filters and search
  const filteredFolders = useMemo(() => {
    return rootFolders
      .map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        scope: folder.scope,
        documentCount: folder.documentCount || documents.filter((d: any) => d.folderId === folder.id).length,
        modifiedAt: new Date(folder.modifiedAt),
        createdBy: folder.createdBy,
        type: "folder" as const,
      }))
      .filter((folder: any) => {
        // Search filter
        if (searchQuery && !folder.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !folder.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        // Scope filter
        if (filterScope !== "all" && folder.scope !== filterScope) {
          return false;
        }
        
        return true;
      });
  }, [rootFolders, documents, searchQuery, filterScope]);

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
          id: doc.id,
          name: doc.name,
          type: doc.type,
          size: doc.size,
          folder: folders.find((f: any) => f.id === doc.folderId)?.name || "",
          folderId: doc.folderId,
          folderCount: folderCount,
          folderIds: folderIds,
          folderNames: folderNames,
          description: doc.description,
          scope: doc.scope,
          status: doc.status,
          modifiedAt: new Date(doc.modifiedAt),
          createdBy: doc.createdBy,
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
        if (filterScope !== "all" && doc.scope !== filterScope) {
          return false;
        }
        
        // File type filter
        if (filterType !== "all" && doc.fileType !== filterType) {
          return false;
        }
        
        // Tags filter
        if (filterTags.length > 0 && !filterTags.some((tag: string) => doc.tags?.includes(tag))) {
          return false;
        }
        
        return true;
      });
  }, [documents, folders, searchQuery, filterScope, filterType, filterTags]);

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

  // Combine items for bulk operations
  const allItems = useMemo(() => {
    return [
      ...sortedFolders.map((f: any) => ({ id: f.id, name: f.name, type: "folder" as const })),
      ...sortedDocuments.map((d: any) => ({ id: d.id, name: d.name, type: "file" as const })),
    ];
  }, [sortedFolders, sortedDocuments]);

  const handleSelectAll = () => {
    if (selectedItems.length === allItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(allItems.map((item) => item.id));
    }
  };

  const handleToggleItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter((id) => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const handleBulkExport = () => {
    if (selectedItems.length === 0) {
      toast.error("Please select items to export");
      return;
    }
    setExportDialogOpen(true);
  };

  const handleBulkArchive = () => {
    if (selectedItems.length === 0) {
      toast.error("Please select items to archive");
      return;
    }
    setArchiveDialogOpen(true);
  };

  // Get unique file types for filter
  const uniqueFileTypes = useMemo(() => {
    const types = new Set(documents.map((d: any) => d.type));
    return Array.from(types);
  }, [documents]);

  // Get unique tags for filter
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    documents.forEach((d: any) => {
      if (d.tags && Array.isArray(d.tags)) {
        d.tags.forEach((tag: string) => tags.add(tag));
      }
    });
    return Array.from(tags);
  }, [documents]);

  const activeFiltersCount = (filterScope !== "all" ? 1 : 0) + 
                            (filterType !== "all" ? 1 : 0) + 
                            filterTags.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Manage your documents and folders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCreateRichTextDialogOpen(true)}
          >
            <FileText className="mr-2 h-4 w-4" />
            New Document
          </Button>
          <Button
            variant="outline"
            onClick={() => setCreateFolderDialogOpen(true)}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
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
        
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={filterScope} onValueChange={setFilterScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scopes</SelectItem>
                    <SelectItem value="company">Company-wide</SelectItem>
                    <SelectItem value="department">Department-wide</SelectItem>
                    <SelectItem value="division">Division-wide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>File Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueFileTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {uniqueTags.length > 0 && (
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {uniqueTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={filterTags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          if (filterTags.includes(tag)) {
                            setFilterTags(filterTags.filter((t) => t !== tag));
                          } else {
                            setFilterTags([...filterTags, tag]);
                          }
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {(filterScope !== "all" || filterType !== "all" || filterTags.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setFilterScope("all");
                    setFilterType("all");
                    setFilterTags([]);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        
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

      {/* Bulk Operations */}
      {allItems.length > 0 && (
        <BulkOperations
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          items={allItems}
        />
      )}

      {/* Content */}
      {loading ? (
        <LoadingState type="card" count={6} />
      ) : (
        <div className="space-y-8">
          {/* Folders Section */}
          {sortedFolders.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Folders</h2>
                {sortedFolders.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedItems.filter((id) => sortedFolders.some((f: any) => f.id === id)).length === sortedFolders.length ? (
                      <CheckSquare className="h-4 w-4 mr-2" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    Select All Folders
                  </Button>
                )}
              </div>
              <div
                className={
                  viewMode === "grid"
                    ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                    : "space-y-4"
                }
              >
                {sortedFolders.map((folder) => (
                  <div key={folder.id} className="relative">
                    <Checkbox
                      checked={selectedItems.includes(folder.id)}
                      onCheckedChange={() => handleToggleItem(folder.id)}
                      className="absolute top-4 left-4 z-10 bg-background rounded"
                    />
                    <FolderCard
                      folder={folder}
                      hasAccess={hasAccessToResource(
                        folder.id,
                        "folder",
                        currentUser,
                        hasFolderPermission(folder)
                      )}
                      onView={(id) => router.push(`/documents/folder/${id}`)}
                      onEdit={(id) => {
                        setEditingFolderId(id);
                        setEditFolderDialogOpen(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents Section */}
          {sortedDocuments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Documents</h2>
                {sortedDocuments.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedItems.filter((id) => sortedDocuments.some((d: any) => d.id === id)).length === sortedDocuments.length ? (
                      <CheckSquare className="h-4 w-4 mr-2" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    Select All Documents
                  </Button>
                )}
              </div>
              <div
                className={
                  viewMode === "grid"
                    ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                    : "space-y-4"
                }
              >
                {sortedDocuments.map((doc) => (
                  <div key={doc.id} className="relative">
                    <Checkbox
                      checked={selectedItems.includes(doc.id)}
                      onCheckedChange={() => handleToggleItem(doc.id)}
                      className="absolute top-4 left-4 z-10 bg-background rounded"
                    />
                    <DocumentCard
                      document={doc}
                      hasAccess={hasAccessToResource(
                        doc.id,
                        "document",
                        currentUser,
                        hasDocumentPermission(doc)
                      )}
                      onView={(id) => router.push(`/documents/${id}`)}
                      onAddToFolder={(id) => {
                        setAddingDocumentId(id);
                        setAddToFolderDialogOpen(true);
                      }}
                    />
                  </div>
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
          setSelectedItems([]);
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
          setSelectedItems([]);
        }}
      />
      <CreateRichTextDocumentDialog
        open={createRichTextDialogOpen}
        onOpenChange={setCreateRichTextDialogOpen}
        onDocumentCreated={() => {
          // Refresh would happen here
          setSelectedItems([]);
        }}
      />
      <AddToFolderDialog
        open={addToFolderDialogOpen}
        onOpenChange={(open) => {
          setAddToFolderDialogOpen(open);
          if (!open) setAddingDocumentId(undefined);
        }}
        documentId={addingDocumentId || ""}
        currentFolderId={sortedDocuments.find((d: any) => d.id === addingDocumentId)?.folderId}
        onAdded={() => {
          // Refresh would happen here
          setSelectedItems([]);
        }}
      />
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        documentIds={selectedItems.filter((id) => sortedDocuments.some((d: any) => d.id === id))}
      />
      {archiveDialogOpen && selectedItems.length === 1 && (
        <ArchiveDialog
          open={archiveDialogOpen}
          onOpenChange={(open) => {
            setArchiveDialogOpen(open);
            if (!open) setSelectedItems([]);
          }}
          documentId={selectedItems.filter((id) => sortedDocuments.some((d: any) => d.id === id))[0]}
        />
      )}
    </div>
  );
}
