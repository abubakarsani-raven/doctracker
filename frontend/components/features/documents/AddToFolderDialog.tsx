"use client";

import { useState, useEffect, useMemo } from "react";
import { usePermissions } from "@/lib/hooks/use-permissions";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FolderOpen, X } from "lucide-react";
import { useFolders } from "@/lib/hooks/use-documents";
import { useCurrentUser } from "@/lib/hooks/use-users";

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
  currentFolderId,
}: AddToFolderDialogProps) {
  const { data: currentUser } = useCurrentUser();
  const { canOn } = usePermissions();
  const { data: allFolders = [] } = useFolders();

  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);

  useEffect(() => {
    if (open && currentFolderId) {
      setSelectedFolderIds([currentFolderId]);
    } else if (!open) {
      setSelectedFolderIds([]);
    }
  }, [open, currentFolderId]);

  // Get user's department and division IDs from companies data

  // Get accessible folders based on permissions
  // Only folders the user may actually write into are offered as targets.
  // This used to be a copy of the role ladder from the documents page; it is
  // now the same decision the API will make when the move is submitted.
  const accessibleFolders = useMemo(() => {
    if (!currentUser || !allFolders.length) return [];

    return allFolders.filter((folder: any) => {
      if (folder.id === currentFolderId) return false;
      return canOn(folder, "write", "folder");
    });
  }, [allFolders, currentUser, currentFolderId, canOn]);

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

  const handleAdd = () => {
    if (selectedFolderIds.length === 0) {
      toast.error("Please select at least one folder");
      return;
    }

    // Add-to-folder endpoint is not wired yet — do not fake success.
    toast.error("This action is not available yet");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Document to Folders</DialogTitle>
          <DialogDescription>
            Select additional folders where this document should appear. The
            document will be accessible from all selected folders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {accessibleFolders.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No additional folders available. You don't have permission to add
              documents to other folders.
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
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedFolderIds.length === 0}
          >
            {`Add to ${selectedFolderIds.length || ""} Folder(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
