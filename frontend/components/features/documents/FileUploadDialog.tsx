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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload, FileWithMetadata } from "@/components/common";
import { RichTextEditor } from "./RichTextEditor";
import { toast } from "sonner";
import { Upload, FileText, FilePlus } from "lucide-react";
import { useFolders } from "@/lib/hooks/use-documents";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  onFilesUploaded?: () => void;
}

export function FileUploadDialog({
  open,
  onOpenChange,
  folderId,
  onFilesUploaded,
}: FileUploadDialogProps) {
  const { data: allFolders = [] } = useFolders();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"upload" | "rich-text">("upload");
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [scope, setScope] = useState<"company" | "department" | "division">("department");
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folderId || "");
  const [uploading, setUploading] = useState(false);

  // Rich text document state
  const [richTextName, setRichTextName] = useState("");
  const [richTextContent, setRichTextContent] = useState("");
  const [richTextScope, setRichTextScope] = useState<"company" | "department" | "division">("department");
  const [richTextFolderId, setRichTextFolderId] = useState<string>(folderId || "");
  const [creatingRichText, setCreatingRichText] = useState(false);

  const accessibleFolders = useMemo(() => {
    return allFolders.filter((f: any) => !f.parentFolderId); // Root folders for now
  }, [allFolders]);

  const handleFilesSelected = (selectedFiles: FileWithMetadata[]) => {
    setFiles(selectedFiles);
  };

  const handleFilesRemoved = (fileIds: string[]) => {
    setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setUploading(true);

    try {
      // Upload files to backend
      const uploadPromises = files.map(async (fileWithMeta) => {
        const fileExtension = fileWithMeta.file.name.split(".").pop() || "";
        const fileType = fileExtension.toLowerCase();

        return api.createFile({
          fileName: fileWithMeta.file.name,
          fileType: fileType,
          scopeLevel: scope,
          folderId: selectedFolderId || undefined,
        });
      });

      await Promise.all(uploadPromises);

      // Invalidate documents queries to refetch
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ["documents", folderId] });
      }

      toast.success(`Successfully uploaded ${files.length} file(s)`);
      setFiles([]);
      onFilesUploaded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast.error(error?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateRichText = async () => {
    if (!richTextName.trim()) {
      toast.error("Please enter a document name");
      return;
    }

    if (!richTextContent.trim() || richTextContent === "<p></p>") {
      toast.error("Please add some content to the document");
      return;
    }

    if (!richTextFolderId) {
      toast.error("Please select a folder");
      return;
    }

    setCreatingRichText(true);

    try {
      await api.createRichTextDocument({
        fileName: richTextName.trim(),
        htmlContent: richTextContent,
        scopeLevel: richTextScope,
        folderId: richTextFolderId,
      });

      // Invalidate documents queries to refetch
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ["documents", folderId] });
      }

      toast.success("Rich text document created successfully");
      setRichTextName("");
      setRichTextContent("");
      onFilesUploaded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to create rich text document:", error);
      toast.error(error?.message || "Failed to create document. Please try again.");
    } finally {
      setCreatingRichText(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setRichTextName("");
    setRichTextContent("");
    setActiveTab("upload");
    setSelectedFolderId(folderId || "");
    setRichTextFolderId(folderId || "");
    onOpenChange(false);
  };

  const canSubmitRichText =
    richTextName.trim() &&
    richTextContent.trim() &&
    richTextContent !== "<p></p>" &&
    richTextFolderId &&
    !creatingRichText;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Files or Create Document</DialogTitle>
          <DialogDescription>
            Upload existing files or create a new rich text document
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "upload" | "rich-text")}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="rich-text">
              <FileText className="mr-2 h-4 w-4" />
              Create Rich Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <FileUpload
              onFilesSelected={handleFilesSelected}
              onFilesRemoved={handleFilesRemoved}
              multiple
              maxSize={100 * 1024 * 1024} // 100MB
            />

            {!folderId && accessibleFolders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="upload-folder-select">Folder (Optional)</Label>
                <Select
                  value={selectedFolderId}
                  onValueChange={setSelectedFolderId}
                  disabled={!!folderId || uploading}
                >
                  <SelectTrigger id="upload-folder-select">
                    <SelectValue placeholder="Select a folder (optional)" />
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
                disabled={uploading}
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
              <p className="text-xs text-muted-foreground">
                Choose who can access these documents by default
              </p>
            </div>
          </TabsContent>

          <TabsContent value="rich-text" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="document-name">Document Name *</Label>
              <Input
                id="document-name"
                placeholder="e.g., Meeting Notes, Review Summary..."
                value={richTextName}
                onChange={(e) => setRichTextName(e.target.value)}
                disabled={creatingRichText}
              />
            </div>

            {!folderId && accessibleFolders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="rich-text-folder-select">Folder *</Label>
                <Select
                  value={richTextFolderId}
                  onValueChange={setRichTextFolderId}
                  disabled={!!folderId || creatingRichText}
                >
                  <SelectTrigger id="rich-text-folder-select">
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
                value={richTextScope}
                onValueChange={(value: "company" | "department" | "division") =>
                  setRichTextScope(value)
                }
                disabled={creatingRichText}
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
                content={richTextContent}
                onChange={setRichTextContent}
                placeholder="Start typing your document content..."
                editable={!creatingRichText}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading || creatingRichText}
          >
            Cancel
          </Button>
          {activeTab === "upload" ? (
            <Button onClick={handleUpload} disabled={uploading || files.length === 0}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? `Uploading...` : `Upload ${files.length} file(s)`}
            </Button>
          ) : (
            <Button onClick={handleCreateRichText} disabled={!canSubmitRichText}>
              <FilePlus className="mr-2 h-4 w-4" />
              {creatingRichText ? "Creating..." : "Create Document"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
