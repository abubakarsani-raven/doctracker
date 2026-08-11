"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { FilePlus, FileUp, PenLine, Upload, X } from "lucide-react";
import { useFolders } from "@/lib/hooks/use-documents";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/** Mirrors the server-side upload allowlist. */
const ACCEPTED =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.html,.png,.jpg,.jpeg,.gif,.webp";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type Mode = "upload" | "write";

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
  const { canOn } = usePermissions();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Uploading a scan or a PDF is the common case, so it leads.
  const [mode, setMode] = useState<Mode>("upload");
  const [documentName, setDocumentName] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folderId ?? "");
  const [creating, setCreating] = useState(false);

  /**
   * Folders the document can go into: any depth, but only ones the user may
   * write to. Previously this listed root folders only, so a document could
   * never be filed into a subfolder.
   */
  const folderOptions = useMemo(() => {
    const byId = new Map<string, any>(allFolders.map((f: any) => [f.id, f]));
    const pathOf = (f: any): string => {
      const parts = [f.name];
      let cursor = f;
      const seen = new Set<string>([f.id]);
      while (cursor?.parentFolderId && !seen.has(cursor.parentFolderId)) {
        seen.add(cursor.parentFolderId);
        cursor = byId.get(cursor.parentFolderId);
        if (!cursor) break;
        parts.unshift(cursor.name);
      }
      return parts.join(" / ");
    };

    return allFolders
      .filter((f: any) => canOn(f, "write", "folder"))
      .map((f: any) => ({ id: f.id, label: pathOf(f), scopeLevel: f.scopeLevel }))
      .sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, [allFolders, canOn]);

  useEffect(() => {
    if (!open) return;
    setSelectedFolderId(folderId ?? folderOptions[0]?.id ?? "");
  }, [open, folderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setMode("upload");
    setDocumentName("");
    setContent("");
    setFile(null);
    setSelectedFolderId(folderId ?? "");
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_UPLOAD_BYTES) {
      toast.error("That file is over 25 MB", {
        description: "Split it up or compress it before uploading.",
      });
      return;
    }
    setFile(picked);
    // Offer the file's own name, minus the extension, as the document name.
    if (!documentName.trim()) {
      setDocumentName(picked.name.replace(/\.[^./\\]+$/, ""));
    }
  };

  /** The chosen folder decides the document's scope — it inherits its shelf. */
  const targetFolder = folderOptions.find((f: any) => f.id === selectedFolderId);
  const scopeLevel = targetFolder?.scopeLevel ?? "company";

  const handleCreate = async () => {
    if (!selectedFolderId) {
      toast.error("Choose a folder to file this in");
      return;
    }
    if (mode === "upload" && !file) {
      toast.error("Choose a file to upload");
      return;
    }
    if (mode === "write") {
      if (!documentName.trim()) {
        toast.error("Give the document a name");
        return;
      }
      if (!content.trim() || content === "<p></p>") {
        toast.error("Add some content");
        return;
      }
    }

    setCreating(true);
    try {
      const folder = allFolders.find((f: any) => f.id === selectedFolderId);
      const companyId = folder?.companyId as string | undefined;

      if (mode === "upload" && file) {
        await api.uploadFile(file, {
          scopeLevel,
          folderId: selectedFolderId,
          companyId,
          fileName: documentName.trim() || undefined,
        });
      } else {
        await api.createRichTextDocument({
          fileName: documentName.trim(),
          htmlContent: content,
          scopeLevel,
          folderId: selectedFolderId,
          companyId,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ["documents", folderId] });
      }

      toast.success(mode === "upload" ? "Document uploaded" : "Document created");
      handleClose();
      onDocumentCreated?.();
    } catch (error) {
      toast.error(
        mode === "upload" ? "Could not upload that file" : "Could not create the document",
        {
          description:
            error instanceof ApiError ? error.message : "Please try again.",
        },
      );
    } finally {
      setCreating(false);
    }
  };

  const canSubmit =
    !!selectedFolderId &&
    !creating &&
    (mode === "upload"
      ? !!file
      : !!documentName.trim() && !!content.trim() && content !== "<p></p>");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
          <DialogDescription>
            Upload a scan or a PDF, or write one here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode */}
          <div className="flex gap-1 rounded-md border p-1">
            {(
              [
                { value: "upload", label: "Upload a file", icon: FileUp },
                { value: "write", label: "Write one", icon: PenLine },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={creating}
                  onClick={() => setMode(option.value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors",
                    mode === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>

          {mode === "upload" ? (
            <div className="space-y-2">
              <Label>File</Label>
              {file ? (
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="stamp mt-1 text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove file"
                    onClick={() => setFile(null)}
                    disabled={creating}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files?.[0]);
                  }}
                  disabled={creating}
                  className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center transition-colors hover:bg-accent"
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Drop a file here, or click to choose
                  </span>
                  <span className="stamp text-muted-foreground">
                    PDF · Word · Excel · Images · up to 25 MB
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? undefined)}
              />

              {/* A scan arrives called SCAN_0042.pdf. Let people file it under a
                  name they will recognise; the extension is kept either way. */}
              {file && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="upload-name">Name</Label>
                  <Input
                    id="upload-name"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder={file.name}
                    disabled={creating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Saved as{" "}
                    <span className="font-medium">
                      {(documentName.trim() || file.name.replace(/\.[^./\\]+$/, "")) +
                        (file.name.match(/\.[^./\\]+$/)?.[0] ?? "")}
                    </span>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="document-name">Name</Label>
              <Input
                id="document-name"
                placeholder="Board Minutes — March"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                disabled={creating}
              />
            </div>
          )}

          {/* Destination */}
          <div className="space-y-2">
            <Label htmlFor="folder-select">Folder</Label>
            <Select
              value={selectedFolderId}
              onValueChange={setSelectedFolderId}
              disabled={!!folderId || creating}
            >
              <SelectTrigger id="folder-select">
                <SelectValue placeholder="Choose a folder" />
              </SelectTrigger>
              <SelectContent>
                {folderOptions.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    You cannot add to any folder yet
                  </div>
                ) : (
                  folderOptions.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The document takes on the folder&rsquo;s access — whoever can reach
              the folder can reach this.
            </p>
          </div>

          {mode === "write" && (
            <div className="space-y-2">
              <Label>Content</Label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Start typing…"
                editable={!creating}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            <FilePlus className="mr-2 h-4 w-4" />
            {creating
              ? mode === "upload"
                ? "Uploading…"
                : "Creating…"
              : mode === "upload"
                ? "Upload document"
                : "Create document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
