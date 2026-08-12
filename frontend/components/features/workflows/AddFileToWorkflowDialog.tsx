"use client";

import { useMemo, useState } from "react";
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
import { Upload, FileText, FilePlus, Link2 } from "lucide-react";
import { api } from "@/lib/api";
import { useDocuments } from "@/lib/hooks/use-documents";
import { useWorkflow } from "@/lib/hooks/use-workflows";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [activeTab, setActiveTab] = useState<"reference" | "upload" | "rich-text">(
    "reference",
  );
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [note, setNote] = useState("");

  const [richTextName, setRichTextName] = useState("");
  const [richTextContent, setRichTextContent] = useState("");
  const [creatingRichText, setCreatingRichText] = useState(false);

  const { data: workflow } = useWorkflow(workflowId);
  // Backend already applies filterReadable; pass workflow company so Masters
  // only browse that tenant’s library in this picker.
  const { data: documents = [], isLoading: docsLoading } = useDocuments(
    undefined,
    workflow?.companyId,
  );

  const companyDocs = useMemo(() => {
    return documents.filter((d: any) => {
      if (d.status && d.status !== "active") return false;
      if (workflow?.companyId && d.companyId && d.companyId !== workflow.companyId) {
        return false;
      }
      return true;
    });
  }, [documents, workflow?.companyId]);

  const reset = () => {
    setFiles([]);
    setSelectedDocId("");
    setNote("");
    setRichTextName("");
    setRichTextContent("");
    setActiveTab("reference");
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleReference = async () => {
    if (!selectedDocId) {
      toast.error("Select a document to reference");
      return;
    }
    setUploading(true);
    try {
      await api.attachFileToWorkflow(workflowId, {
        fileId: selectedDocId,
        note: note.trim() || undefined,
      });
      toast.success("Document referenced on this workflow");
      reset();
      onFileAdded?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to attach document");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setUploading(true);
    try {
      for (const fileWithMeta of files) {
        const created = await api.uploadFile(fileWithMeta.file, {
          scopeLevel: "company",
          folderId: workflow?.folderId || undefined,
          companyId: workflow?.companyId || undefined,
          fileName: fileWithMeta.file.name,
        });
        const fileId = created?.id || created?.file?.id;
        if (fileId) {
          await api.attachFileToWorkflow(workflowId, {
            fileId,
            note: note.trim() || undefined,
          });
        }
      }

      toast.success(`Added ${files.length} file(s) to workflow`);
      reset();
      onFileAdded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to add files:", error);
      toast.error(error.message || "Failed to add files. Please try again.");
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
      if (!workflow?.folderId) {
        toast.error("This workflow has no folder — upload or reference a file instead.");
        return;
      }
      const created = await api.createRichTextDocument({
        fileName: richTextName.trim(),
        htmlContent: richTextContent,
        scopeLevel: "company",
        folderId: workflow.folderId,
        companyId: workflow?.companyId,
      });
      const fileId = created?.id || created?.file?.id;
      if (fileId) {
        await api.attachFileToWorkflow(workflowId, {
          fileId,
          note: note.trim() || "Rich text document",
        });
      }
      toast.success("Rich text document added to workflow");
      reset();
      onFileAdded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to create rich text document:", error);
      toast.error(error.message || "Failed to create document. Please try again.");
    } finally {
      setCreatingRichText(false);
    }
  };

  const busy = uploading || creatingRichText;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to Workflow</DialogTitle>
          <DialogDescription>
            {workflow?.type === "document"
              ? "Document workflows can attach any company document here. Completing an action can only reference the primary document."
              : "Reference an existing document, upload a new file, or create rich text. Attached files show under Files Added."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reference">
              <Link2 className="mr-2 h-4 w-4" />
              Reference
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="rich-text">
              <FileText className="mr-2 h-4 w-4" />
              Rich Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reference" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Document</Label>
              <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                <SelectTrigger
                  className={cn(
                    "w-full h-auto min-h-9 items-start py-2 whitespace-normal",
                    "*:data-[slot=select-value]:line-clamp-none",
                    "*:data-[slot=select-value]:whitespace-normal",
                    "*:data-[slot=select-value]:break-words",
                  )}
                >
                  <SelectValue
                    placeholder={
                      docsLoading
                        ? "Loading documents…"
                        : "Select a document…"
                    }
                    className="text-left whitespace-normal break-words"
                  />
                </SelectTrigger>
                <SelectContent
                  className="w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,40rem)]"
                  searchPlaceholder="Search documents…"
                  emptyMessage={
                    docsLoading
                      ? "Loading…"
                      : "No accessible documents found."
                  }
                >
                  {companyDocs.map((doc: any) => (
                    <SelectItem
                      key={doc.id}
                      value={doc.id}
                      className="items-start whitespace-normal h-auto py-2"
                    >
                      <span className="block whitespace-normal break-words leading-snug pr-2">
                        {doc.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only documents you can open are listed.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attach-note">Note (optional)</Label>
              <Input
                id="attach-note"
                placeholder="Why this file matters…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <FileUpload
              onFilesSelected={setFiles}
              onFilesRemoved={(ids) =>
                setFiles((prev) => prev.filter((f) => !ids.includes(f.id)))
              }
              multiple={true}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
              maxSize={100 * 1024 * 1024}
            />
            <div className="space-y-2">
              <Label htmlFor="upload-note">Note (optional)</Label>
              <Input
                id="upload-note"
                placeholder="Why this file matters…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />
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
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          {activeTab === "reference" && (
            <Button onClick={handleReference} disabled={busy || !selectedDocId}>
              <Link2 className="mr-2 h-4 w-4" />
              {uploading ? "Attaching…" : "Attach reference"}
            </Button>
          )}
          {activeTab === "upload" && (
            <Button onClick={handleUpload} disabled={busy || files.length === 0}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading…" : `Upload ${files.length || ""} file(s)`}
            </Button>
          )}
          {activeTab === "rich-text" && (
            <Button
              onClick={handleCreateRichText}
              disabled={
                busy ||
                !richTextName.trim() ||
                !richTextContent.trim() ||
                richTextContent === "<p></p>"
              }
            >
              <FilePlus className="mr-2 h-4 w-4" />
              {creatingRichText ? "Creating…" : "Create & attach"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
