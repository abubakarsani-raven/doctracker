"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  Building2,
  User,
  ExternalLink,
  Lock,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { AddFileToWorkflowDialog } from "./AddFileToWorkflowDialog";
import { AccessRequestDialog } from "@/components/features/documents/AccessRequestDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/common";
import Link from "next/link";
import { toast } from "sonner";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";

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
  scopeLevel?: string | null;
  canGrant?: boolean;
  access?: { canRead?: boolean; reason?: string } | null;
}

interface WorkflowFilesProps {
  workflowId: string;
  workflowTitle?: string;
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

export function WorkflowFiles({
  workflowId,
  workflowTitle,
}: WorkflowFilesProps) {
  const queryClient = useQueryClient();
  const { data: files = [], isLoading } = useWorkflowFiles(workflowId);
  const [addFileDialogOpen, setAddFileDialogOpen] = useState(false);
  const [requestFile, setRequestFile] = useState<WorkflowFile | null>(null);
  const [grantFile, setGrantFile] = useState<WorkflowFile | null>(null);
  const { can } = usePermissions();
  const canDownload = can("documents.download");

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
              {files.map((file, index) => {
                const canRead = file.access?.canRead !== false;
                const revoked = file.access?.reason === "access_revoked";
                return (
                  <div key={file.attachmentId || file.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          {canRead ? (
                            <Link
                              href={`/documents/${file.id}`}
                              className="font-medium text-sm truncate block text-primary hover:underline"
                              title="Open document"
                            >
                              {file.name}
                            </Link>
                          ) : (
                            <p className="font-medium text-sm truncate flex items-center gap-1.5">
                              <span className="min-w-0 truncate">{file.name}</span>
                              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </p>
                          )}
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
                            {!canRead && !revoked && (
                              <span className="text-xs text-muted-foreground">
                                Restricted — request or ask to be granted access
                              </span>
                            )}
                            {revoked && (
                              <span className="text-xs text-muted-foreground">
                                Access revoked
                              </span>
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
                        {canRead ? (
                          <>
                            <Button variant="ghost" size="icon" asChild>
                              <Link
                                href={`/documents/${file.id}`}
                                title="Open document"
                                aria-label={`Open ${file.name}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                            {canDownload && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Download"
                                aria-label={`Download ${file.name}`}
                                onClick={async () => {
                                  try {
                                    await api.downloadDocument(file.id);
                                    toast.success("Download started");
                                  } catch (error: any) {
                                    toast.error(
                                      error?.message ||
                                        "Download failed — you may not have access to this file",
                                    );
                                  }
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {file.canGrant && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => setGrantFile(file)}
                              >
                                <UserPlus className="mr-1 h-3 w-3" />
                                Grant access
                              </Button>
                            )}
                          </>
                        ) : revoked ? null : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setRequestFile(file)}
                          >
                            <Lock className="mr-1 h-3 w-3" />
                            Request access
                          </Button>
                        )}
                      </div>
                    </div>
                    {index < files.length - 1 && <Separator className="mt-4" />}
                  </div>
                );
              })}
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

      {requestFile && (
        <AccessRequestDialog
          open={!!requestFile}
          onOpenChange={(open) => {
            if (!open) setRequestFile(null);
          }}
          resourceId={requestFile.id}
          resourceType="document"
          resourceName={requestFile.name}
          scope={
            requestFile.scopeLevel === "department" ||
            requestFile.scopeLevel === "division" ||
            requestFile.scopeLevel === "company"
              ? requestFile.scopeLevel
              : undefined
          }
          defaultReason={
            workflowTitle
              ? `I need to read this document to work on the workflow “${workflowTitle}”.`
              : "I need to read this document to work on this workflow."
          }
        />
      )}

      <GrantWorkflowFileDialog
        open={!!grantFile}
        onOpenChange={(open) => {
          if (!open) setGrantFile(null);
        }}
        workflowId={workflowId}
        file={grantFile}
        onGranted={() => {
          queryClient.invalidateQueries({
            queryKey: ["workflows", workflowId, "files"],
          });
          setGrantFile(null);
        }}
      />
    </>
  );
}

function GrantWorkflowFileDialog({
  open,
  onOpenChange,
  workflowId,
  file,
  onGranted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  file: WorkflowFile | null;
  onGranted: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["workflows", workflowId, "file-access-candidates"],
    queryFn: () => api.getWorkflowFileAccessCandidates(workflowId),
    enabled: open && !!workflowId,
  });

  const handleGrant = async () => {
    if (!file || !userId) {
      toast.error("Select a person first");
      return;
    }
    setSaving(true);
    try {
      await api.grantWorkflowFileAccess(workflowId, file.id, userId);
      toast.success("Access granted", {
        description: "They can open this file to work the workflow.",
      });
      setUserId("");
      onGranted();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not grant access. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Grant file access</DialogTitle>
          <DialogDescription>
            Give a named person on this workflow permission to open{" "}
            {file ? <span className="font-medium">{file.name}</span> : "this file"}
            . This does not open it to their whole department.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Person</Label>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading people…</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one else is currently assigned to this workflow. Assign the
              work to a person or department first.
            </p>
          ) : (
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select someone on this workflow" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name || candidate.email || candidate.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleGrant}
            disabled={saving || !userId || candidates.length === 0}
          >
            {saving ? "Granting…" : "Grant access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
