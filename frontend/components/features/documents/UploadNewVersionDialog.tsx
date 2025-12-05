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
import { Label } from "@/components/ui/label";
import { FileUpload, FileWithMetadata } from "@/components/common";
import { toast } from "sonner";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UploadNewVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  currentFileName?: string;
  onUploaded?: () => void;
}

export function UploadNewVersionDialog({
  open,
  onOpenChange,
  documentId,
  currentFileName = "document",
  onUploaded,
}: UploadNewVersionDialogProps) {
  const [file, setFile] = useState<FileWithMetadata | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelected = (files: FileWithMetadata[]) => {
    if (files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleFileRemoved = (fileIds: string[]) => {
    if (file && fileIds.includes(file.id)) {
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);
    try {
      const fileExtension = file.file.name.split('.').pop() || '';
      const fileType = fileExtension.toLowerCase();
      
      // For now, we'll create a storage path (in production, this would be handled by file upload service)
      const storagePath = `/storage/${documentId}/v${Date.now()}/${file.file.name}`;

      await api.uploadFileVersion(documentId, {
        storagePath,
        fileName: file.file.name,
        fileType: fileType,
      });

      toast.success("New version uploaded successfully");
      setFile(null);
      onUploaded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast.error(error?.message || "Failed to upload new version. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload New Version</DialogTitle>
          <DialogDescription>
            Upload a new version of this document. The previous version will be saved in version history (maximum 10 versions).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Only the 10 most recent versions are kept. Older versions will be automatically deleted to save space.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Select File</Label>
            <FileUpload
              onFilesSelected={handleFileSelected}
              onFilesRemoved={handleFileRemoved}
              multiple={false}
              maxSize={100 * 1024 * 1024} // 100MB
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
          </div>

          {file && (
            <div className="text-sm text-muted-foreground">
              Selected: <span className="font-medium">{file.file.name}</span> ({(file.file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload New Version
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
