"use client";

import { useState, useMemo, useEffect } from "react";
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
import {
  ScanPagesPanel,
  defaultScanName,
  type ScanPage,
} from "./ScanPagesPanel";
import { toast } from "sonner";
import { Upload, FileText, FilePlus, ScanLine, Building2 } from "lucide-react";
import { useFolders } from "@/lib/hooks/use-documents";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { api } from "@/lib/api";
import { imagesToPdf } from "@/lib/scan-to-pdf";
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
  const { data: companies = [] } = useCompanies();
  const { data: currentUser } = useCurrentUser();
  const { permissions, isMaster } = usePermissions();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"upload" | "scan" | "rich-text">(
    "upload",
  );
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [scope, setScope] = useState<"company" | "department" | "division">(
    "department",
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    folderId || "",
  );
  const [uploading, setUploading] = useState(false);
  const [companyId, setCompanyId] = useState<string>("");

  const [scanPages, setScanPages] = useState<ScanPage[]>([]);
  const [scanName, setScanName] = useState("");
  const [scanScope, setScanScope] = useState<
    "company" | "department" | "division"
  >("department");
  const [scanFolderId, setScanFolderId] = useState<string>(folderId || "");
  const [scanning, setScanning] = useState(false);

  const [richTextName, setRichTextName] = useState("");
  const [richTextContent, setRichTextContent] = useState("");
  const [richTextScope, setRichTextScope] = useState<
    "company" | "department" | "division"
  >("department");
  const [richTextFolderId, setRichTextFolderId] = useState<string>(
    folderId || "",
  );
  const [creatingRichText, setCreatingRichText] = useState(false);

  const needsCompanyPicker =
    isMaster ||
    permissions.dataScope === "all" ||
    !currentUser?.companyId;

  const accessibleFolders = useMemo(() => {
    return allFolders.filter((f: any) => !f.archivedAt && !f.deletedAt);
  }, [allFolders]);

  const folderCompanyId = (targetFolderId?: string) => {
    if (!targetFolderId) return undefined;
    const folder = allFolders.find((f: any) => f.id === targetFolderId);
    return folder?.companyId as string | undefined;
  };

  /** Folder wins, then Master picker, then the signed-in user's company. */
  const resolveCompanyId = (targetFolderId?: string) =>
    folderCompanyId(targetFolderId) ||
    companyId ||
    currentUser?.companyId ||
    undefined;

  const activeFolderIdForCompany =
    activeTab === "upload"
      ? selectedFolderId || folderId
      : activeTab === "scan"
        ? scanFolderId || folderId
        : richTextFolderId || folderId;

  const showCompanyPicker =
    needsCompanyPicker && !folderCompanyId(activeFolderIdForCompany);

  useEffect(() => {
    if (!open) return;
    setSelectedFolderId(folderId || "");
    setScanFolderId(folderId || "");
    setRichTextFolderId(folderId || "");
    const fromFolder = folderCompanyId(folderId);
    setCompanyId(
      fromFolder ||
        currentUser?.companyId ||
        (companies as any[])[0]?.id ||
        "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folderId, currentUser?.companyId, companies]);

  const handleFilesSelected = (selectedFiles: FileWithMetadata[]) => {
    setFiles(selectedFiles);
  };

  const handleFilesRemoved = (fileIds: string[]) => {
    setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));
  };

  const requireCompanyId = (targetFolderId?: string) => {
    const resolved = resolveCompanyId(targetFolderId);
    if (!resolved) {
      toast.error("Select a company before uploading");
      return null;
    }
    return resolved;
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    const targetFolderId = selectedFolderId || folderId || undefined;
    const resolvedCompanyId = requireCompanyId(targetFolderId);
    if (!resolvedCompanyId) return;

    setUploading(true);

    try {
      await Promise.all(
        files.map((fileWithMeta) =>
          api.uploadFile(fileWithMeta.file, {
            scopeLevel: scope,
            folderId: targetFolderId,
            companyId: resolvedCompanyId,
            fileName: fileWithMeta.file.name,
          }),
        ),
      );

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

  const clearScanPages = () => {
    scanPages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setScanPages([]);
  };

  const handleScanUpload = async () => {
    if (scanPages.length === 0) {
      toast.error("Add at least one page");
      return;
    }

    const name = scanName.trim() || defaultScanName();
    const targetFolderId = scanFolderId || folderId || undefined;
    const resolvedCompanyId = requireCompanyId(targetFolderId);
    if (!resolvedCompanyId) return;

    setScanning(true);
    try {
      const pdfFile = await imagesToPdf(
        scanPages.map((p) => p.file),
        name,
      );
      await api.uploadFile(pdfFile, {
        scopeLevel: scanScope,
        folderId: targetFolderId,
        companyId: resolvedCompanyId,
        fileName: pdfFile.name,
      });

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ["documents", folderId] });
      }

      toast.success(
        `Uploaded scan with ${scanPages.length} page${scanPages.length === 1 ? "" : "s"}`,
      );
      clearScanPages();
      setScanName("");
      onFilesUploaded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Scan upload failed:", error);
      toast.error(
        error?.message || "Failed to create scan PDF. Please try again.",
      );
    } finally {
      setScanning(false);
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

    const resolvedCompanyId = requireCompanyId(richTextFolderId);
    if (!resolvedCompanyId) return;

    setCreatingRichText(true);

    try {
      await api.createRichTextDocument({
        fileName: richTextName.trim(),
        htmlContent: richTextContent,
        scopeLevel: richTextScope,
        folderId: richTextFolderId,
        companyId: resolvedCompanyId,
      });

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
      toast.error(
        error?.message || "Failed to create document. Please try again.",
      );
    } finally {
      setCreatingRichText(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    clearScanPages();
    setScanName("");
    setRichTextName("");
    setRichTextContent("");
    setActiveTab("upload");
    setSelectedFolderId(folderId || "");
    setScanFolderId(folderId || "");
    setRichTextFolderId(folderId || "");
    setCompanyId("");
    onOpenChange(false);
  };

  const busy = uploading || scanning || creatingRichText;

  const canSubmitRichText =
    richTextName.trim() &&
    richTextContent.trim() &&
    richTextContent !== "<p></p>" &&
    richTextFolderId &&
    !creatingRichText;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Files or Create Document</DialogTitle>
          <DialogDescription>
            Upload files, combine scanned pages into one PDF, or create a rich
            text document
          </DialogDescription>
        </DialogHeader>

        {showCompanyPicker && (
          <div className="mt-2 space-y-2">
            <Label
              htmlFor="upload-company"
              className="flex items-center gap-1.5"
            >
              <Building2 className="h-3.5 w-3.5" />
              Company
            </Label>
            <Select
              value={companyId}
              onValueChange={setCompanyId}
              disabled={busy}
            >
              <SelectTrigger id="upload-company">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {(companies as any[]).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Required when uploading as Master (or without a company on your
              profile).
            </p>
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            setActiveTab(v as "upload" | "scan" | "rich-text")
          }
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="scan">
              <ScanLine className="mr-2 h-4 w-4" />
              Scan
            </TabsTrigger>
            <TabsTrigger value="rich-text">
              <FileText className="mr-2 h-4 w-4" />
              Rich text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4 space-y-4">
            <FileUpload
              onFilesSelected={handleFilesSelected}
              onFilesRemoved={handleFilesRemoved}
              multiple
              maxSize={100 * 1024 * 1024}
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
                        {folder.parentFolderId
                          ? `${allFolders.find((p: any) => p.id === folder.parentFolderId)?.name || "…"} / ${folder.name}`
                          : folder.name}
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
            </div>
          </TabsContent>

          <TabsContent value="scan" className="mt-4 space-y-4">
            <ScanPagesPanel
              pages={scanPages}
              onPagesChange={setScanPages}
              documentName={scanName}
              onDocumentNameChange={setScanName}
              disabled={scanning}
            />

            {!folderId && accessibleFolders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="scan-folder-select">Folder (Optional)</Label>
                <Select
                  value={scanFolderId}
                  onValueChange={setScanFolderId}
                  disabled={!!folderId || scanning}
                >
                  <SelectTrigger id="scan-folder-select">
                    <SelectValue placeholder="Select a folder (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessibleFolders.map((folder: any) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.parentFolderId
                          ? `${allFolders.find((p: any) => p.id === folder.parentFolderId)?.name || "…"} / ${folder.name}`
                          : folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Document Scope</Label>
              <Select
                value={scanScope}
                onValueChange={(value: "company" | "department" | "division") =>
                  setScanScope(value)
                }
                disabled={scanning}
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
          </TabsContent>

          <TabsContent value="rich-text" className="mt-4 space-y-4">
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
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          {activeTab === "upload" && (
            <Button
              onClick={handleUpload}
              disabled={
                uploading ||
                files.length === 0 ||
                (showCompanyPicker && !companyId)
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? `Uploading...` : `Upload ${files.length} file(s)`}
            </Button>
          )}
          {activeTab === "scan" && (
            <Button
              onClick={handleScanUpload}
              disabled={
                scanning ||
                scanPages.length === 0 ||
                (showCompanyPicker && !companyId)
              }
            >
              <ScanLine className="mr-2 h-4 w-4" />
              {scanning
                ? "Creating PDF…"
                : `Create PDF & upload (${scanPages.length})`}
            </Button>
          )}
          {activeTab === "rich-text" && (
            <Button
              onClick={handleCreateRichText}
              disabled={!canSubmitRichText || (showCompanyPicker && !companyId)}
            >
              <FilePlus className="mr-2 h-4 w-4" />
              {creatingRichText ? "Creating..." : "Create Document"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
