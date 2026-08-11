"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  PenTool,
  RotateCcw,
  Check,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Upload,
  ImageIcon,
  Minus,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { removeSignaturePaperBackground } from "@/lib/signature-image";
import { PdfPageCanvas } from "./PdfPageCanvas";

interface SignDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  participantId: string;
  fileId: string;
  documentName?: string;
  pageCount?: number;
  isRichText?: boolean;
  onSuccess?: () => void;
}

type SigMode = "draw" | "upload";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function SignDocumentDialog({
  open,
  onOpenChange,
  requestId,
  participantId,
  fileId,
  documentName,
  pageCount = 1,
  isRichText = false,
  onSuccess,
}: SignDocumentDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<SigMode>("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedSigUrl, setUploadedSigUrl] = useState<string | null>(null);
  const [drawnSigUrl, setDrawnSigUrl] = useState<string | null>(null);
  const [sigAspect, setSigAspect] = useState(0.35);
  const [page, setPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(pageCount || 1);
  const [xPercent, setXPercent] = useState(15);
  const [yPercent, setYPercent] = useState(70);
  const [widthPercent, setWidthPercent] = useState(28);
  const touchStartX = useRef<number | null>(null);

  const maxPage = Math.max(1, pdfPageCount || pageCount || 1);
  const heightPercent = useMemo(
    () => clamp(widthPercent * sigAspect, 4, 45),
    [widthPercent, sigAspect],
  );

  const liveSigUrl =
    mode === "upload" ? uploadedSigUrl : drawnSigUrl;

  useEffect(() => {
    setXPercent((x) => clamp(x, 0, 100 - widthPercent));
    setYPercent((y) => clamp(y, 0, 100 - heightPercent));
  }, [widthPercent, heightPercent]);

  const hasSignature = mode === "upload" ? Boolean(uploadedSigUrl) : hasDrawn;

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setPdfPageCount(pageCount || 1);
    setXPercent(15);
    setYPercent(70);
    setWidthPercent(28);
    setHasDrawn(false);
    setUploadedSigUrl(null);
    setDrawnSigUrl(null);
    setMode("draw");
    setSigAspect(0.35);
  }, [open, pageCount]);

  useEffect(() => {
    if (!open || !fileId || isRichText) {
      setPreviewUrl(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const { blob } = await api.getDocumentBlob(fileId);
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreviewUrl(objectUrl);
      } catch (err: any) {
        if (cancelled) return;
        setPreviewError(err?.message || "Could not load document preview");
        setPreviewUrl(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, fileId, isRichText]);

  const syncDrawnPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      setDrawnSigUrl(null);
      return;
    }
    setDrawnSigUrl(canvas.toDataURL("image/png"));
    setSigAspect(canvas.height / Math.max(1, canvas.width));
  }, [hasDrawn]);

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

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = canvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { x, y } = canvasPoint(e);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    // Defer so the last stroke is committed before we snapshot.
    requestAnimationFrame(() => syncDrawnPreview());
  }, [syncDrawnPreview]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    setUploadedSigUrl(null);
    setDrawnSigUrl(null);
    setSigAspect(0.35);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Place stamp on the currently selected page only (WYSIWYG). */
  const placeFromClient = (
    clientX: number,
    clientY: number,
    w = widthPercent,
    h = heightPercent,
  ) => {
    const el = pageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xRatio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const yRatio = clamp((clientY - rect.top) / rect.height, 0, 1);

    setXPercent(clamp(xRatio * 100 - w / 2, 0, 100 - w));
    setYPercent(clamp(yRatio * 100 - h / 2, 0, 100 - h));
  };

  const placeOnPage = (e: React.MouseEvent<HTMLDivElement>) => {
    placeFromClient(e.clientX, e.clientY);
  };

  const startDragStamp = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const w = widthPercent;
    const h = heightPercent;
    placeFromClient(e.clientX, e.clientY, w, h);

    const onMove = (ev: MouseEvent) => {
      placeFromClient(ev.clientX, ev.clientY, w, h);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
      setUploadedSigUrl(cleaned);
      setMode("upload");

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("bad image"));
        img.src = cleaned;
      });
      setSigAspect(clamp(img.naturalHeight / Math.max(1, img.naturalWidth), 0.15, 1.2));
      toast.success("White paper removed — preview it on the page");
    } catch (err: any) {
      toast.error(err?.message || "Could not process signature image");
    } finally {
      setProcessingUpload(false);
    }
  };

  const resolveSignatureDataUrl = async (): Promise<string | null> => {
    if (mode === "upload" && uploadedSigUrl) return uploadedSigUrl;
    if (drawnSigUrl) return drawnSigUrl;
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return null;
    return canvas.toDataURL("image/png");
  };

  const handleSign = async () => {
    const signatureImageData = await resolveSignatureDataUrl();
    if (!signatureImageData) {
      toast.error("Draw or upload your signature first");
      return;
    }

    setLoading(true);
    try {
      await api.signDocument(requestId, participantId, signatureImageData, {
        page: isRichText ? 1 : page,
        xPercent,
        yPercent,
        widthPercent,
      });
      toast.success("Document signed — a new version was saved");
      onSuccess?.();
      onOpenChange(false);
      clearSignature();
    } catch (error: any) {
      toast.error(error.message || "Failed to sign document");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    clearSignature();
  };

  const goToPage = useCallback(
    (next: number) => {
      setPage(clamp(next, 1, maxPage));
    },
    [maxPage],
  );

  const nudgeWidth = (delta: number) => {
    setWidthPercent((w) => clamp(w + delta, 8, 55));
  };

  const onPreviewTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onPreviewTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const dx = end - start;
    if (Math.abs(dx) < 56) return; // tap / small move — ignore
    if (dx < 0) goToPage(page + 1); // swipe left → next
    else goToPage(page - 1); // swipe right → prev
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            Sign document
          </DialogTitle>
          <DialogDescription>
            Pick the page, place the stamp, then draw or upload your signature.
            Only the signature image is stamped — no name label. Signing “
            {documentName || "this document"}”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isRichText && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sign-page">Page to sign</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Input
                    id="sign-page"
                    type="number"
                    min={1}
                    max={maxPage}
                    value={page}
                    onChange={(e) => goToPage(Number(e.target.value) || 1)}
                    className="w-16 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={page >= maxPage}
                    onClick={() => goToPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pb-2">
                of {maxPage} — one page at a time · swipe or use arrows
              </p>
            </div>
          )}

          <div>
            <Label className="mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Placement preview
            </Label>
            <div
              ref={pageRef}
              role="button"
              tabIndex={0}
              onClick={placeOnPage}
              onTouchStart={onPreviewTouchStart}
              onTouchEnd={onPreviewTouchEnd}
              className="relative mx-auto w-full max-w-lg cursor-crosshair overflow-hidden rounded-md border bg-muted"
              title="Click to place signature · swipe or arrows to change page"
            >
              {previewLoading && (
                <div className="absolute inset-0 z-[1] flex items-center justify-center bg-background/60">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 z-[1] flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {previewError}
                </div>
              )}
              {previewUrl && !isRichText && (
                <PdfPageCanvas
                  src={previewUrl}
                  page={page}
                  className="relative w-full"
                  onPageCount={(n) => {
                    setPdfPageCount(n);
                    setPage((p) => clamp(p, 1, n));
                  }}
                  onError={(msg) => setPreviewError(msg)}
                />
              )}

              {/* Page nav arrows overlaid on the preview */}
              {!isRichText && maxPage > 1 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 z-[5] h-10 w-10 -translate-y-1/2 rounded-full shadow-md disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPage(page - 1);
                    }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 z-[5] h-10 w-10 -translate-y-1/2 rounded-full shadow-md disabled:opacity-40"
                    disabled={page >= maxPage}
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPage(page + 1);
                    }}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}

              <span className="absolute right-3 top-3 z-[4] rounded bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950 shadow-sm">
                Page {page} / {maxPage}
              </span>

              <div
                role="presentation"
                onMouseDown={startDragStamp}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className={cn(
                  "absolute z-[3] cursor-grab active:cursor-grabbing",
                  "rounded-md border-[3px] border-amber-400 bg-white/40",
                  "shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]",
                  "ring-2 ring-amber-200",
                )}
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: `${widthPercent}%`,
                  height: `${heightPercent}%`,
                }}
                title="Drag to move · resize with the controls below"
              >
                <span className="absolute -top-6 left-0 z-[1] rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 shadow">
                  Preview
                </span>
                {liveSigUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={liveSigUrl}
                    alt="Signature preview"
                    className="h-full w-full object-contain p-0.5 drop-shadow-sm"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-amber-400/25">
                    <span className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-950 shadow-sm">
                      Draw or upload first
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Page {page} · X {xPercent.toFixed(0)}% · Y {yPercent.toFixed(0)}%
              </span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Size</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => nudgeWidth(-3)}
                  disabled={widthPercent <= 8}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  type="number"
                  min={8}
                  max={55}
                  value={Math.round(widthPercent)}
                  onChange={(e) =>
                    setWidthPercent(
                      clamp(Number(e.target.value) || 28, 8, 55),
                    )
                  }
                  className="h-8 w-16 text-center"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => nudgeWidth(3)}
                  disabled={widthPercent >= 55}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <input
                type="range"
                min={8}
                max={55}
                value={widthPercent}
                onChange={(e) => setWidthPercent(Number(e.target.value))}
                className="h-2 w-40 accent-amber-500"
                aria-label="Signature width"
              />
            </div>
          </div>

          <Card className="p-4">
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as SigMode)}
              className="space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="draw">
                    <PenTool className="mr-1.5 h-3.5 w-3.5" />
                    Draw
                  </TabsTrigger>
                  <TabsTrigger value="upload">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Upload photo
                  </TabsTrigger>
                </TabsList>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                  disabled={!hasSignature && !uploadedSigUrl}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>

              <TabsContent value="draw" className="mt-0 space-y-2">
                <canvas
                  ref={canvasRef}
                  width={480}
                  height={140}
                  className="w-full cursor-crosshair rounded-md border border-border bg-white"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  style={{ touchAction: "none" }}
                />
                <p className="text-center text-xs text-muted-foreground">
                  Draw here — it appears live in the placement preview above
                </p>
              </TabsContent>

              <TabsContent value="upload" className="mt-0 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-6">
                  {uploadedSigUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uploadedSigUrl}
                      alt="Processed signature"
                      className="max-h-28 w-auto object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  )}
                  <div className="text-center text-sm text-muted-foreground">
                    {uploadedSigUrl
                      ? "Paper cleared. Adjust size on the preview above."
                      : "Photo on white paper — we’ll remove the background."}
                  </div>
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
                    {uploadedSigUrl ? "Replace image" : "Upload signature"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSign} disabled={!hasSignature || loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Apply signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
