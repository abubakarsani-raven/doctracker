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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Folder } from "lucide-react";
import { useFolders } from "@/lib/hooks/use-documents";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { api } from "@/lib/api";

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
  const { canOn } = usePermissions();
  const { data: allFolders = [] } = useFolders();

  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setSelectedFolderId(undefined);
    }
  }, [open]);

  // Get user context for permissions

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

    try {
      await api.moveDocument(documentId, selectedFolderId);
      toast.success("Document moved successfully");
      onMoveComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error moving document:", error);
      toast.error("Failed to move document");
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
          >
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!selectedFolderId}>
            Move Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
