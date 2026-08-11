"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Building2, User, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { AddFileToWorkflowDialog } from "./AddFileToWorkflowDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/common";
import Link from "next/link";

interface WorkflowFile {
  id: string;
  attachmentId?: string | null;
  name: string;
  size: number;
  addedBy: string;
  addedByType: "user" | "department" | "division";
  addedAt: Date | string;
  actionTitle?: string | null;
  note?: string | null;
  isPrimary?: boolean;
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

function useWorkflowFiles(workflowId: string) {
  return useQuery({
    queryKey: ["workflows", workflowId, "files"],
    queryFn: async () => {
      return (await api.getWorkflowFiles(workflowId)) as WorkflowFile[];
    },
    enabled: !!workflowId,
  });
}

export function WorkflowFiles({ workflowId }: WorkflowFilesProps) {
  const queryClient = useQueryClient();
  const { data: files = [], isLoading } = useWorkflowFiles(workflowId);
  const [addFileDialogOpen, setAddFileDialogOpen] = useState(false);

  const handleFileAdded = () => {
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
              description="Attach any document under Files Added. Completing an action on a document workflow can only reference the primary document."
            />
          ) : (
            <div className="space-y-4">
              {files.map((file, index) => (
                <div key={file.attachmentId || file.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/documents/${file.id}`}
                          className="font-medium text-sm truncate block text-primary hover:underline"
                          title="Open document"
                        >
                          {file.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(file.size || 0)}
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
                              { addSuffix: true },
                            )}
                          </span>
                          {file.actionTitle && (
                            <span className="text-xs text-muted-foreground">
                              via {file.actionTitle}
                            </span>
                          )}
                          {file.isPrimary && (
                            <span className="text-xs text-muted-foreground">Primary</span>
                          )}
                        </div>
                        {file.note && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {file.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/documents/${file.id}`} title="Open document">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Download"
                        onClick={async () => {
                          try {
                            const { blob, fileName } = await api.getDocumentBlob(file.id);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = fileName || file.name;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error("Download failed:", error);
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
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
