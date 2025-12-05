"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Folder, FolderOpen } from "lucide-react";
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";

interface MoveDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  currentFolderId?: string;
  onMoveComplete?: () => void;
}

interface FolderOption {
  id: string;
  name: string;
  path: string;
  level: number;
}

export function MoveDocumentDialog({
  open,
  onOpenChange,
  documentId,
  currentFolderId,
  onMoveComplete,
}: MoveDocumentDialogProps) {
  const { currentUser } = useMockData();
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (open) {
      loadFolders();
      setSelectedFolderId(undefined);
    }
  }, [open]);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const [foldersData, companiesData] = await Promise.all([
        api.getFolders(),
        api.getCompanies(),
      ]);
      
      setAllFolders(foldersData);
      setCompanies(companiesData);
    } catch (error) {
      console.error("Failed to load folders:", error);
      toast.error("Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  // Get accessible folders based on permissions
  const getAccessibleFolders = (): any[] => {
    if (!currentUser) return [];

    // Find user's department and division IDs from companies data
    const userDeptName = currentUser.department;
    const userDivName = currentUser.division;
    
    let userDeptId: string | null = null;
    let userDivId: string | null = null;
    let userCompanyId: string | null = null;

    // Match user's department and division by name
    companies.forEach((company: any) => {
      if (company.departments) {
        company.departments.forEach((dept: any) => {
          if (dept.name === userDeptName) {
            userDeptId = dept.id;
            userCompanyId = company.id;
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

    return allFolders.filter((folder: any) => {
      // Filter out current folder
      if (folder.id === currentFolderId) {
        return false;
      }

      // Master role can access everything
      if (currentUser.role === "Master") {
        return true;
      }

      // Company Admin can access all folders in their company
      if (currentUser.role === "Company Admin") {
        return folder.companyId === userCompanyId;
      }

      // Department Head can access department-wide and division-wide folders in their department
      if (currentUser.role === "Department Head") {
        if (folder.scope === "company") {
          return false; // Need permission for company-wide
        }
        // Can access folders in their department
        return folder.departmentId === userDeptId;
      }

      // Division Head can access division-wide folders in their division
      if (currentUser.role === "Division Head") {
        if (folder.scope === "company" || folder.scope === "department") {
          return false; // Need permission for higher scopes
        }
        // Can access folders in their division
        return folder.scope === "division" && folder.departmentId === userDeptId;
      }

      // Regular users (Staff, Manager, etc.): scope-based access
      // Company-wide folders: can access if in same company
      if (folder.scope === "company") {
        return folder.companyId === userCompanyId; // Same company
      }

      // Department-wide: must be in same department
      if (folder.scope === "department") {
        return folder.departmentId === userDeptId; // Same department ID
      }

      // Division-wide: must be in same division and department
      if (folder.scope === "division") {
        // Check if folder belongs to user's department and division
        return folder.departmentId === userDeptId && userDivId !== null;
      }

      return false;
    });
  };

  const buildFolderPath = (folder: any, allFolders: any[]): string => {
    if (!folder.parentFolderId) {
      return folder.name;
    }
    
    const parent = allFolders.find((f) => f.id === folder.parentFolderId);
    if (!parent) {
      return folder.name;
    }
    
    return `${buildFolderPath(parent, allFolders)} / ${folder.name}`;
  };

  const buildFolderOptions = (): FolderOption[] => {
    // Add root option (no folder) - only if user has permission to create root documents
    const options: FolderOption[] = [];
    
    // Check if user can move to root (simplified: most roles can)
    if (currentUser && (currentUser.role === "Master" || currentUser.role === "Company Admin" || currentUser.role === "Department Head")) {
      options.push({
        id: "__root__",
        name: "Root (No folder)",
        path: "Root",
        level: 0,
      });
    }

    // Get accessible folders based on permissions
    const accessibleFolders = getAccessibleFolders();

    // Build folder tree
    accessibleFolders.forEach((folder) => {
      const path = buildFolderPath(folder, allFolders);
      options.push({
        id: folder.id,
        name: folder.name,
        path: path,
        level: (path.match(/\//g) || []).length,
      });
    });

    // Sort by path for better organization
    // Filter out any options with invalid IDs (safety check)
    return options
      .filter((option) => option.id && option.id.trim() !== "")
      .sort((a, b) => a.path.localeCompare(b.path));
  };

  const handleMove = async () => {
    if (selectedFolderId === undefined) {
      toast.error("Please select a destination folder");
      return;
    }

    setMoving(true);
    try {
      // Convert __root__ to null for API call (no folder)
      const destinationFolderId = selectedFolderId === "__root__" ? null : selectedFolderId;
      
      // TODO: Replace with actual API call
      // await api.moveDocument(documentId, destinationFolderId);
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      toast.success("Document moved successfully");
      onMoveComplete?.();
      onOpenChange(false);
      setSelectedFolderId(undefined);
    } catch (error) {
      console.error("Failed to move document:", error);
      toast.error("Failed to move document");
    } finally {
      setMoving(false);
    }
  };

  const folderOptions = buildFolderOptions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Move Document</DialogTitle>
          <DialogDescription>
            Select a destination folder you have permission to work on. Only accessible folders are shown.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="destination-folder">Destination Folder</Label>
            {loading ? (
              <div className="h-10 border rounded-md flex items-center justify-center text-sm text-muted-foreground">
                Loading folders...
              </div>
            ) : (
              <Select
                value={selectedFolderId ?? ""}
                onValueChange={(value) => setSelectedFolderId(value || undefined)}
              >
                <SelectTrigger id="destination-folder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="max-h-[300px]">
                    {folderOptions.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No folders available. You don't have permission to move documents to any folders.
                      </div>
                    ) : (
                      folderOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          <div className="flex items-center gap-2">
                            {option.id === "__root__" ? (
                              <Folder className="h-4 w-4" />
                            ) : (
                              <FolderOpen className="h-4 w-4" />
                            )}
                            <span className="truncate">{option.path}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </ScrollArea>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedFolderId(undefined);
            }}
            disabled={moving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={moving || loading || selectedFolderId === undefined}
          >
            {moving ? "Moving..." : "Move Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
