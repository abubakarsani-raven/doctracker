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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Folder, FolderOpen, X } from "lucide-react";
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";

interface AddToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  currentFolderId?: string;
  onAdded?: () => void;
}

export function AddToFolderDialog({
  open,
  onOpenChange,
  documentId,
  currentFolderId,
  onAdded,
}: AddToFolderDialogProps) {
  const { currentUser, companies, folders: allFolders } = useMockData();
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      loadExistingFolders();
    } else {
      setSelectedFolderIds([]);
    }
  }, [open, documentId]);

  const loadExistingFolders = async () => {
    // TODO: Load existing folder links from API
    // For now, assume document is only in currentFolderId
    if (currentFolderId) {
      setSelectedFolderIds([currentFolderId]);
    }
  };

  // Get user's department and division IDs from companies data
  const userContext = useMemo(() => {
    if (!currentUser || !companies) {
      return { userDeptId: null, userDivId: null, userCompanyId: null };
    }

    const userDeptName = currentUser.department;
    const userDivName = currentUser.division;
    let userDeptId: string | null = null;
    let userDivId: string | null = null;
    let userCompanyId: string | null = null;

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

    return { userDeptId, userDivId, userCompanyId };
  }, [currentUser, companies]);

  // Get accessible folders based on permissions (similar to MoveDocumentDialog)
  const accessibleFolders = useMemo(() => {
    if (!currentUser || !companies || !allFolders) return [];

    const { userDeptId, userDivId, userCompanyId } = userContext;

    return allFolders.filter((folder: any) => {
      // Filter out current folder (document already in it)
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
          return folder.companyId === userCompanyId;
        }
        return folder.departmentId === userDeptId;
      }

      // Division Head can access division-wide folders in their division
      if (currentUser.role === "Division Head") {
        if (folder.scope === "company") {
          return folder.companyId === userCompanyId;
        }
        if (folder.scope === "department") {
          return folder.departmentId === userDeptId;
        }
        return folder.scope === "division" && folder.departmentId === userDeptId;
      }

      // Regular users: scope-based access
      if (folder.scope === "company") {
        return folder.companyId === userCompanyId;
      }

      if (folder.scope === "department") {
        return folder.departmentId === userDeptId;
      }

      if (folder.scope === "division") {
        return folder.departmentId === userDeptId && userDivId !== null;
      }

      return false;
    });
  }, [allFolders, currentUser, userContext, companies, currentFolderId]);

  const buildFolderPath = (folder: any, allFolders: any[]): string => {
    if (!folder.parentFolderId) {
      return folder.name;
    }

    const parent = allFolders.find((f: any) => f.id === folder.parentFolderId);
    if (!parent) {
      return folder.name;
    }

    return `${buildFolderPath(parent, allFolders)} / ${folder.name}`;
  };

  const handleToggleFolder = (folderId: string) => {
    setSelectedFolderIds((prev) => {
      if (prev.includes(folderId)) {
        return prev.filter((id) => id !== folderId);
      } else {
        return [...prev, folderId];
      }
    });
  };

  const handleAdd = async () => {
    if (selectedFolderIds.length === 0) {
      toast.error("Please select at least one folder");
      return;
    }

    setAdding(true);
    try {
      // TODO: Replace with actual API call
      // await api.addDocumentToFolders(documentId, selectedFolderIds);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(`Document added to ${selectedFolderIds.length} folder(s) successfully`);
      onAdded?.();
      onOpenChange(false);
      setSelectedFolderIds([]);
    } catch (error) {
      console.error("Failed to add document to folders:", error);
      toast.error("Failed to add document to folders");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Document to Folders</DialogTitle>
          <DialogDescription>
            Select additional folders where this document should appear. The document will be accessible from all selected folders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {accessibleFolders.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No additional folders available. You don't have permission to add documents to other folders.
            </div>
          ) : (
            <>
              {selectedFolderIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedFolderIds.map((folderId) => {
                    const folder = allFolders.find((f: any) => f.id === folderId);
                    return folder ? (
                      <Badge
                        key={folderId}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {folder.name}
                        <button
                          onClick={() => handleToggleFolder(folderId)}
                          className="ml-1 hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}

              <ScrollArea className="max-h-[400px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {accessibleFolders.map((folder: any) => {
                    const path = buildFolderPath(folder, allFolders);
                    const isSelected = selectedFolderIds.includes(folder.id);

                    return (
                      <div
                        key={folder.id}
                        className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                        onClick={() => handleToggleFolder(folder.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleFolder(folder.id)}
                        />
                        <FolderOpen className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{folder.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {path}
                          </div>
                        </div>
                        {folder.scope && (
                          <Badge variant="outline" className="text-xs">
                            {folder.scope}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={adding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={adding || selectedFolderIds.length === 0}
          >
            {adding
              ? `Adding to ${selectedFolderIds.length} folder(s)...`
              : `Add to ${selectedFolderIds.length || ""} Folder(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
