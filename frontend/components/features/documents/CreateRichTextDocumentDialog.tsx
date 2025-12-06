"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "./RichTextEditor";
import { toast } from "sonner";
import { FileText, FilePlus } from "lucide-react";
import { useFolders } from "@/lib/hooks/use-documents";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface CreateRichTextDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  onDocumentCreated?: () => void;
}

export function CreateRichTextDocumentDialog({
  open,
  onOpenChange,
  folderId,
  onDocumentCreated,
}: CreateRichTextDocumentDialogProps) {
  const { data: allFolders = [] } = useFolders();
  const queryClient = useQueryClient();

  const [documentName, setDocumentName] = useState("");
  const [content, setContent] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folderId || "");
  const [scope, setScope] = useState<"company" | "department" | "division">("department");
  const [creating, setCreating] = useState(false);

  const accessibleFolders = useMemo(() => {
    return allFolders.filter((f: any) => !f.parentFolderId); // Root folders
  }, [allFolders]);

  const handleClose = () => {
    setDocumentName("");
    setContent("");
    setSelectedFolderId(folderId || "");
    setScope("department");
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!documentName.trim()) {
      toast.error("Please enter a document name");
      return;
    }

    if (!content.trim() || content === "<p></p>") {
      toast.error("Please add some content to the document");
      return;
    }

    if (!selectedFolderId) {
      toast.error("Please select a folder");
      return;
    }

    setCreating(true);

    try {
      await api.createRichTextDocument({
        fileName: documentName.trim(),
        htmlContent: content,
        scopeLevel: scope,
        folderId: selectedFolderId,
      });

      // Invalidate queries to refetch documents
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ["documents", folderId] });
      }

      toast.success("Rich text document created successfully");
      handleClose();
      onDocumentCreated?.();
    } catch (error: any) {
      console.error("Failed to create rich text document:", error);
      toast.error(error?.message || "Failed to create document. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit =
    documentName.trim() &&
    content.trim() &&
    content !== "<p></p>" &&
    selectedFolderId &&
    !creating;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Rich Text Document</DialogTitle>
          <DialogDescription>
            Create a new rich text document with formatted content
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="document-name">Document Name *</Label>
            <Input
              id="document-name"
              placeholder="e.g., Meeting Notes, Review Summary..."
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              disabled={creating}
            />
          </div>

          {!folderId && accessibleFolders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="folder-select">Folder *</Label>
              <Select
                value={selectedFolderId}
                onValueChange={setSelectedFolderId}
                disabled={!!folderId || creating}
              >
                <SelectTrigger id="folder-select">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleFolders.map((folder: any) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Document Scope</Label>
            <Select
              value={scope}
              onValueChange={(value: "company" | "department" | "division") =>
                setScope(value)
              }
              disabled={creating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company-wide</SelectItem>
                <SelectItem value="department">Department-wide</SelectItem>
                <SelectItem value="division">Division-wide</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Document Content *</Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Start typing your document content..."
              editable={!creating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            <FilePlus className="mr-2 h-4 w-4" />
            {creating ? "Creating..." : "Create Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
