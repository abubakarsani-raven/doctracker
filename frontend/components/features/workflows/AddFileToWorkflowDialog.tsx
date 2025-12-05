"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload, FileWithMetadata } from "@/components/common";
import { RichTextEditor } from "@/components/features/documents/RichTextEditor";
import { toast } from "sonner";
import { Upload, FileText, FilePlus } from "lucide-react";

interface AddFileToWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  onFileAdded?: () => void;
}

export function AddFileToWorkflowDialog({
  open,
  onOpenChange,
  workflowId,
  onFileAdded,
}: AddFileToWorkflowDialogProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "rich-text">("upload");
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Rich text document state
  const [richTextName, setRichTextName] = useState("");
  const [richTextContent, setRichTextContent] = useState("");
  const [creatingRichText, setCreatingRichText] = useState(false);

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
      // TODO: Replace with actual API call
      // Simulate upload
      for (const fileWithMeta of files) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      toast.success(`Successfully added ${files.length} file(s) to workflow`);
      setFiles([]);
      onFileAdded?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add files:", error);
      toast.error("Failed to add files. Please try again.");
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

    setCreatingRichText(true);

    try {
      // TODO: Replace with actual API call
      // Create rich text document
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Rich text document created successfully");
      setRichTextName("");
      setRichTextContent("");
      onFileAdded?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create rich text document:", error);
      toast.error("Failed to create document. Please try again.");
    } finally {
      setCreatingRichText(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setRichTextName("");
    setRichTextContent("");
    setActiveTab("upload");
    onOpenChange(false);
  };

  const canSubmit =
    activeTab === "upload"
      ? files.length > 0 && !uploading
      : richTextName.trim() && richTextContent.trim() && richTextContent !== "<p></p>" && !creatingRichText;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to Workflow</DialogTitle>
          <DialogDescription>
            Upload files or create a rich text document to attach to this workflow
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "rich-text")} className="mt-4">
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
              multiple={true}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
              maxSize={100 * 1024 * 1024} // 100MB
            />
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
          <Button variant="outline" onClick={handleClose} disabled={uploading || creatingRichText}>
            Cancel
          </Button>
          {activeTab === "upload" ? (
            <Button onClick={handleUpload} disabled={uploading || files.length === 0}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? `Uploading...` : `Upload ${files.length} file(s)`}
            </Button>
          ) : (
            <Button onClick={handleCreateRichText} disabled={!canSubmit}>
              <FilePlus className="mr-2 h-4 w-4" />
              {creatingRichText ? "Creating..." : "Create Document"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
