"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Building2, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { AddFileToWorkflowDialog } from "./AddFileToWorkflowDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/common";

interface WorkflowFile {
  id: string;
  name: string;
  size: number;
  addedBy: string;
  addedByType: "user" | "department" | "division";
  addedAt: Date | string;
}

interface WorkflowFilesProps {
  workflowId: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

// Hook to fetch workflow files
function useWorkflowFiles(workflowId: string) {
  return useQuery({
    queryKey: ["workflows", workflowId, "files"],
    queryFn: async () => {
      // TODO: Replace with actual API endpoint when backend is ready
      // For now, return empty array until endpoint is implemented
      // return await api.getWorkflowFiles(workflowId);
      return [] as WorkflowFile[];
    },
    enabled: !!workflowId,
  });
}

export function WorkflowFiles({ workflowId }: WorkflowFilesProps) {
  const queryClient = useQueryClient();
  const { data: files = [], isLoading } = useWorkflowFiles(workflowId);
  const [addFileDialogOpen, setAddFileDialogOpen] = useState(false);

  const handleFileAdded = () => {
    // Invalidate and refetch workflow files when a new file is added
    queryClient.invalidateQueries({ queryKey: ["workflows", workflowId, "files"] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Files Added</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddFileDialogOpen(true)}>
            Add File
          </Button>
        </CardHeader>
        <CardContent>
          <LoadingState type="card" />
        </CardContent>
      </Card>
    );
  }

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
            <EmptyState
              icon={FileText}
              title="No files added yet"
              description="Files added to this workflow will appear here"
            />
          ) : (
            <div className="space-y-4">
              {files.map((file, index) => (
                <div key={file.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
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
                            {formatDistanceToNow(
                              typeof file.addedAt === "string" 
                                ? new Date(file.addedAt) 
                                : file.addedAt,
                              { addSuffix: true }
                            )}
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
