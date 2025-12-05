"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Building2, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { AddFileToWorkflowDialog } from "./AddFileToWorkflowDialog";

interface WorkflowFile {
  id: string;
  name: string;
  size: number;
  addedBy: string;
  addedByType: "user" | "department" | "division";
  addedAt: Date;
}

interface WorkflowFilesProps {
  workflowId: string;
}

// Mock files - replace with API call
const mockFiles: WorkflowFile[] = [
  {
    id: "1",
    name: "review_notes.pdf",
    size: 512000,
    addedBy: "Legal Department",
    addedByType: "department",
    addedAt: new Date("2024-01-12"),
  },
  {
    id: "2",
    name: "response_draft.docx",
    size: 256000,
    addedBy: "John Doe",
    addedByType: "user",
    addedAt: new Date("2024-01-13"),
  },
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export function WorkflowFiles({ workflowId }: WorkflowFilesProps) {
  const [files, setFiles] = useState(mockFiles);
  const [addFileDialogOpen, setAddFileDialogOpen] = useState(false);

  const handleFileAdded = () => {
    // Reload files - in real app, fetch from API
    // setFiles(await api.getWorkflowFiles(workflowId));
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Files Added ({files.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddFileDialogOpen(true)}>
            Add File
          </Button>
        </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No files added yet
          </p>
        ) : (
          <div className="space-y-4">
            {files.map((file, index) => (
              <div key={file.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {file.addedByType === "user" ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Building2 className="h-3 w-3" />
                          )}
                          <span>{file.addedBy}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(file.addedAt, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                {index < files.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    
    <AddFileToWorkflowDialog
      open={addFileDialogOpen}
      onOpenChange={setAddFileDialogOpen}
      workflowId={workflowId}
      onFileAdded={handleFileAdded}
    />
    </>
  );
}
