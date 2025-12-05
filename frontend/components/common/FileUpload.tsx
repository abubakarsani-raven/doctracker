"use client";

import { useCallback, useState } from "react";
import { Upload, X, File, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

export interface FileWithMetadata {
  file: File;
  id: string;
  progress?: number;
  status?: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface FileUploadProps {
  onFilesSelected: (files: FileWithMetadata[]) => void;
  onFilesRemoved?: (fileIds: string[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  onFilesSelected,
  onFilesRemoved,
  accept,
  multiple = true,
  maxSize = 100 * 1024 * 1024, // 100MB default
  className,
  disabled,
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`;
    }
    return null;
  };

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;

      const newFiles: FileWithMetadata[] = [];
      const errors: string[] = [];

      Array.from(fileList).forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
          return;
        }

        newFiles.push({
          file,
          id: `${Date.now()}-${Math.random()}`,
          status: "pending",
          progress: 0,
        });
      });

      if (errors.length > 0) {
        // Show errors - you can integrate with toast here
        console.error(errors);
      }

      const updatedFiles = multiple ? [...files, ...newFiles] : newFiles;
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    },
    [files, multiple, maxSize, onFilesSelected]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter((f) => f.id !== fileId);
    setFiles(updatedFiles);
    onFilesRemoved?.([fileId]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragging && !disabled
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Upload
            className={cn(
              "h-12 w-12 mb-4",
              isDragging ? "text-primary" : "text-muted-foreground"
            )}
          />
          <p className="text-sm font-medium mb-1">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Maximum file size: {Math.round(maxSize / 1024 / 1024)}MB
          </p>
          <input
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById("file-upload")?.click()}
            disabled={disabled}
          >
            Select Files
          </Button>
        </div>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileWithMeta) => (
            <Card key={fileWithMeta.id} className="p-4">
              <div className="flex items-center gap-3">
                <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {fileWithMeta.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileWithMeta.file.size)}
                  </p>
                  {fileWithMeta.progress !== undefined &&
                    fileWithMeta.status === "uploading" && (
                      <Progress
                        value={fileWithMeta.progress}
                        className="mt-2 h-1"
                      />
                    )}
                  {fileWithMeta.status === "success" && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Uploaded
                    </div>
                  )}
                  {fileWithMeta.error && (
                    <p className="text-xs text-destructive mt-1">
                      {fileWithMeta.error}
                    </p>
                  )}
                </div>
                {fileWithMeta.status !== "uploading" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => removeFile(fileWithMeta.id)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove file</span>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
