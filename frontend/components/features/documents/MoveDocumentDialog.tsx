"use client";

import { useState, useEffect, useMemo } from "react";
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
import { useFolders } from "@/lib/hooks/use-documents";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useQueryClient } from "@tanstack/react-query";

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
  const { data: currentUser } = useCurrentUser();
  const { data: companies = [] } = useCompanies();
  const { data: allFolders = [] } = useFolders();
  const queryClient = useQueryClient();

  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedFolderId(undefined);
    }
  }, [open]);

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

  // Get accessible folders based on permissions
  const accessibleFolders = useMemo(() => {
    if (!currentUser || !companies.length) return [];

    const { userDeptId, userDivId, userCompanyId } = userContext;

    return allFolders.filter((folder: any) => {
      // Filter out current folder
      if (folder.id === currentFolderId) {
        return false;
      }

      if (currentUser.role === "Master") {
        return true;
      }

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

      // Regular users: scope-based access
      if (folderScope === "company") {
        return folder.companyId === userCompanyId;
      }

      if (folderScope === "department") {
        return folder.departmentId === userDeptId;
      }

      if (folderScope === "division") {
        return folder.departmentId === userDeptId && userDivId !== null;
      }

      return false;
    });
  }, [allFolders, currentUser, userContext, companies, currentFolderId]);

  // Build folder options with paths
  const folderOptions = useMemo(() => {
    const buildPath = (folder: any, folders: any[]): string => {
      if (!folder.parentFolderId) {
        return folder.name;
      }

      const parent = folders.find((f: any) => f.id === folder.parentFolderId);
      if (!parent) {
        return folder.name;
      }

      return `${buildPath(parent, folders)} / ${folder.name}`;
    };

    return accessibleFolders.map((folder: any) => ({
      id: folder.id,
      name: folder.name,
      path: buildPath(folder, allFolders),
      level: 0, // Can calculate if needed
    }));
  }, [accessibleFolders, allFolders]);

  const handleMove = async () => {
    if (!selectedFolderId) {
      toast.error("Please select a folder");
      return;
    }

    setMoving(true);
    try {
      // TODO: Replace with actual API call when endpoint is available
      // await api.moveDocument(documentId, selectedFolderId);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
      if (currentFolderId) {
        queryClient.invalidateQueries({ queryKey: ["documents", currentFolderId] });
      }

      toast.success("Document moved successfully");
      onMoveComplete?.();
      onOpenChange(false);
      setSelectedFolderId(undefined);
    } catch (error: any) {
      console.error("Failed to move document:", error);
      toast.error(error.message || "Failed to move document");
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Move Document</DialogTitle>
          <DialogDescription>
            Select a new folder for this document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {folderOptions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No folders available. You don't have permission to move documents
              to other folders.
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Folder</Label>
              <Select
                value={selectedFolderId}
                onValueChange={setSelectedFolderId}
                disabled={moving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="max-h-[300px]">
                    {folderOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-yellow-500" />
                          <span>{option.path}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={moving}
          >
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={moving || !selectedFolderId}>
            {moving ? "Moving..." : "Move Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
