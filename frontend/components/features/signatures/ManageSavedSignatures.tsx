"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  PenTool,
  Upload,
  ImageIcon,
  Star,
  Trash2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { removeSignaturePaperBackground } from "@/lib/signature-image";
import { cn } from "@/lib/utils";

export type SavedSignature = {
  id: string;
  label: string;
  imageData: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type CaptureMode = "draw" | "upload";

/**
 * Manage reusable signature images for the current user.
 * Used from Settings → Signatures.
 */
export function ManageSavedSignatures() {
  const [items, setItems] = useState<SavedSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedSignature | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.listSavedSignatures();
      setItems(rows || []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load saved signatures");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetDefault = async (sig: SavedSignature) => {
    if (sig.isDefault) return;
    setBusyId(sig.id);
    try {
      await api.updateSavedSignature(sig.id, { isDefault: true });
      toast.success(`“${sig.label}” is now your default`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not update default");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSavedSignature(deleteTarget.id);
      toast.success("Signature deleted");
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not delete signature");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Save drawings or photos of your signature here, then pick one when you
          sign a document. Up to 8 per account.
        </p>
        <Button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="w-full shrink-0 sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add signature
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center">
          <PenTool className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No saved signatures yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one so you can reuse it the next time you sign.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((sig) => (
            <li
              key={sig.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-3",
                sig.isDefault && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{sig.label}</p>
                  {sig.isDefault ? (
                    <Badge variant="secondary" className="mt-1">
                      Default
                    </Badge>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!sig.isDefault ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Set as default"
                      disabled={busyId === sig.id}
                      onClick={() => handleSetDefault(sig)}
                    >
                      {busyId === sig.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Delete"
                    onClick={() => setDeleteTarget(sig)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex min-h-20 items-center justify-center rounded-md border bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sig.imageData}
                  alt={sig.label}
                  className="max-h-16 w-auto object-contain"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <SaveSignatureEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={async () => {
          setEditorOpen(false);
          await load();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title="Delete saved signature?"
        description={
          deleteTarget
            ? `“${deleteTarget.label}” will be removed from your account. Documents already signed with it are unchanged.`
            : "This signature will be removed from your account."
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

interface SaveSignatureEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  /** Prefill label when saving from the sign flow. */
  defaultLabel?: string;
  /** Prefill image (e.g. just drawn while signing). */
  initialImageData?: string | null;
}

export function SaveSignatureEditorDialog({
  open,
  onOpenChange,
  onSaved,
  defaultLabel = "My signature",
  initialImageData = null,
}: SaveSignatureEditorDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<CaptureMode>(
    initialImageData ? "upload" : "draw",
  );
  const [label, setLabel] = useState(defaultLabel);
  const [isDefault, setIsDefault] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [drawnUrl, setDrawnUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(
    initialImageData,
  );
  const [processingUpload, setProcessingUpload] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(defaultLabel);
    setIsDefault(false);
    setHasDrawn(false);
    setDrawnUrl(null);
    setUploadedUrl(initialImageData);
    setMode(initialImageData ? "upload" : "draw");
    setIsDrawing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [open, defaultLabel, initialImageData]);

  const imageData =
    mode === "upload" ? uploadedUrl : drawnUrl || (hasDrawn ? drawnUrl : null);

  const canvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const syncDrawn = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      setDrawnUrl(null);
      return;
    }
    setDrawnUrl(canvas.toDataURL("image/png"));
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = canvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = canvasPoint(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    requestAnimationFrame(syncDrawn);
  };

  const clearCapture = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    setDrawnUrl(null);
    setUploadedUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image (PNG, JPG, WEBP…)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Signature image must be under 8 MB");
      return;
    }
    setProcessingUpload(true);
    try {
      const cleaned = await removeSignaturePaperBackground(file);
      setUploadedUrl(cleaned);
      setMode("upload");
      toast.success("White paper removed");
    } catch (err: any) {
      toast.error(err?.message || "Could not process signature image");
    } finally {
      setProcessingUpload(false);
    }
  };

  const handleSave = async () => {
    let data = imageData;
    if (mode === "draw" && !data && hasDrawn && canvasRef.current) {
      data = canvasRef.current.toDataURL("image/png");
    }
    if (!data) {
      toast.error("Draw or upload a signature first");
      return;
    }
    if (!label.trim()) {
      toast.error("Give this signature a name");
      return;
    }

    setSaving(true);
    try {
      await api.createSavedSignature({
        label: label.trim(),
        imageData: data,
        isDefault,
      });
      toast.success("Signature saved");
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not save signature");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add signature</DialogTitle>
          <DialogDescription>
            Draw with your mouse or upload a photo. You’ll be able to reuse this
            when signing documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sig-label">Name</Label>
            <Input
              id="sig-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Primary, Initials"
              maxLength={80}
              disabled={saving}
            />
          </div>

          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as CaptureMode)}
            className="space-y-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="draw" className="flex-1 sm:flex-none">
                  <PenTool className="mr-1.5 h-3.5 w-3.5" />
                  Draw
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 sm:flex-none">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload
                </TabsTrigger>
              </TabsList>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearCapture}
                disabled={!hasDrawn && !uploadedUrl}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>

            <TabsContent value="draw" className="mt-0">
              <canvas
                ref={canvasRef}
                width={480}
                height={140}
                className="w-full cursor-crosshair rounded-md border bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                style={{ touchAction: "none" }}
              />
            </TabsContent>

            <TabsContent value="upload" className="mt-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-6">
                {uploadedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uploadedUrl}
                    alt="Signature preview"
                    className="max-h-28 w-auto object-contain"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={processingUpload}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {processingUpload ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {uploadedUrl ? "Replace image" : "Upload signature"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            Set as my default signature
          </label>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || (!imageData && !hasDrawn)}
            onClick={handleSave}
            className="w-full sm:w-auto"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
