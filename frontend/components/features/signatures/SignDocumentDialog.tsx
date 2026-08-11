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
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { removeSignaturePaperBackground } from "@/lib/signature-image";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { SaveSignatureEditorDialog } from "./ManageSavedSignatures";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import Link from "next/link";

interface SignDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  participantId: string;
  fileId: string;
  documentName?: string;
  pageCount?: number;
  isRichText?: boolean;
  /** When true, this replaces an existing signature. */
  isEditing?: boolean;
  onSuccess?: () => void;
}

type SigMode = "saved" | "draw" | "upload";
type ConfirmStep = null | 1 | 2;

type SavedSignatureOption = {
  id: string;
  label: string;
  imageData: string;
  isDefault: boolean;
};

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
  isEditing = false,
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
  const [savedSignatures, setSavedSignatures] = useState<SavedSignatureOption[]>(
    [],
  );
  const [savedLoading, setSavedLoading] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [saveAfterSignOpen, setSaveAfterSignOpen] = useState(false);
  const [offerSaveOpen, setOfferSaveOpen] = useState(false);
  const [pendingSaveImage, setPendingSaveImage] = useState<string | null>(null);
  const [sigAspect, setSigAspect] = useState(0.35);
  const [page, setPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(pageCount || 1);
  const [xPercent, setXPercent] = useState(15);
  const [yPercent, setYPercent] = useState(70);
  const [widthPercent, setWidthPercent] = useState(28);
  const [confirmStep, setConfirmStep] = useState<ConfirmStep>(null);
  const touchStartX = useRef<number | null>(null);

  const maxPage = Math.max(1, pdfPageCount || pageCount || 1);
  const heightPercent = useMemo(
    () => clamp(widthPercent * sigAspect, 4, 45),
    [widthPercent, sigAspect],
  );

  const selectedSaved = useMemo(
    () => savedSignatures.find((s) => s.id === selectedSavedId) || null,
    [savedSignatures, selectedSavedId],
  );

  const liveSigUrl =
    mode === "upload"
      ? uploadedSigUrl
      : mode === "saved"
        ? selectedSaved?.imageData || null
        : drawnSigUrl;

  useEffect(() => {
    setXPercent((x) => clamp(x, 0, 100 - widthPercent));
    setYPercent((y) => clamp(y, 0, 100 - heightPercent));
  }, [widthPercent, heightPercent]);

  const hasSignature =
    mode === "upload"
      ? Boolean(uploadedSigUrl)
      : mode === "saved"
        ? Boolean(selectedSavedId)
        : hasDrawn;

  const loadSavedSignatures = useCallback(async () => {
    setSavedLoading(true);
    try {
      const rows = await api.listSavedSignatures();
      setSavedSignatures(rows || []);
      const def = (rows || []).find((r: SavedSignatureOption) => r.isDefault);
      if (def) {
        setSelectedSavedId(def.id);
        setMode("saved");
        const img = new Image();
        img.onload = () => {
          setSigAspect(
            clamp(img.naturalHeight / Math.max(1, img.naturalWidth), 0.15, 1.2),
          );
        };
        img.src = def.imageData;
      } else if ((rows || []).length > 0) {
        setMode("saved");
      } else {
        setMode("draw");
      }
    } catch {
      setSavedSignatures([]);
    } finally {
      setSavedLoading(false);
    }
  }, []);

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
    setSelectedSavedId(null);
    setMode("draw");
    setSigAspect(0.35);
    setConfirmStep(null);
    setPendingSaveImage(null);
    loadSavedSignatures();
  }, [open, pageCount, loadSavedSignatures]);

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
    setSelectedSavedId(null);
    setSigAspect(0.35);
    setConfirmStep(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectSaved = (sig: SavedSignatureOption) => {
    setSelectedSavedId(sig.id);
    setMode("saved");
    const img = new Image();
    img.onload = () => {
      setSigAspect(
        clamp(img.naturalHeight / Math.max(1, img.naturalWidth), 0.15, 1.2),
      );
    };
    img.src = sig.imageData;
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

  const resolveSignatureDataUrl = async (): Promise<{
    imageData: string | null;
    savedSignatureId?: string;
  }> => {
    if (mode === "saved" && selectedSaved) {
      return {
        imageData: selectedSaved.imageData,
        savedSignatureId: selectedSaved.id,
      };
    }
    if (mode === "upload" && uploadedSigUrl) {
      return { imageData: uploadedSigUrl };
    }
    if (drawnSigUrl) return { imageData: drawnSigUrl };
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return { imageData: null };
    return { imageData: canvas.toDataURL("image/png") };
  };

  const beginConfirm = () => {
    if (!hasSignature) {
      toast.error("Select, draw, or upload your signature first");
      return;
    }
    setConfirmStep(1);
  };

  const handleSign = async () => {
    const { imageData: signatureImageData, savedSignatureId } =
      await resolveSignatureDataUrl();
    if (!signatureImageData) {
      toast.error("Select, draw, or upload your signature first");
      return;
    }

    setLoading(true);
    try {
      await api.signDocument(
        requestId,
        participantId,
        signatureImageData,
        {
          page: isRichText ? 1 : page,
          xPercent,
          yPercent,
          widthPercent,
        },
        savedSignatureId,
      );
      toast.success(
        isEditing
          ? "Signature updated — a new version was saved"
          : "Document signed — a new version was saved",
      );
      setConfirmStep(null);
      onSuccess?.();

      const shouldOfferSave = mode !== "saved";
      if (shouldOfferSave) {
        setPendingSaveImage(signatureImageData);
        onOpenChange(false);
        clearSignature();
        setOfferSaveOpen(true);
      } else {
        onOpenChange(false);
        clearSignature();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to sign document");
      setConfirmStep(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
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
    <>
      <Dialog open={open && confirmStep === null} onOpenChange={handleClose}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[780px] flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 space-y-1.5 border-b px-4 py-4 sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <PenTool className="h-5 w-5 shrink-0" />
              {isEditing ? "Edit signature" : "Sign document"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Pick the page, place the stamp, then choose a saved signature,
              draw, or upload. Only the signature image is stamped — no name
              label. {isEditing ? "Updating" : "Signing"} “
              {documentName || "this document"}”. You can clear and change it
              before confirming.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-6">
            {!isRichText && (
              <div className="flex flex-wrap items-end gap-3 sm:gap-4">
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
                <p className="pb-2 text-xs text-muted-foreground">
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

                {!isRichText && maxPage > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute left-1 top-1/2 z-[5] h-9 w-9 -translate-y-1/2 rounded-full shadow-md disabled:opacity-40 sm:left-2 sm:h-10 sm:w-10"
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
                      className="absolute right-1 top-1/2 z-[5] h-9 w-9 -translate-y-1/2 rounded-full shadow-md disabled:opacity-40 sm:right-2 sm:h-10 sm:w-10"
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

                <span className="absolute right-2 top-2 z-[4] rounded bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-950 shadow-sm sm:right-3 sm:top-3 sm:text-xs">
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
                        Select, draw, or upload first
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="text-xs text-muted-foreground">
                  Page {page} · X {xPercent.toFixed(0)}% · Y {yPercent.toFixed(0)}%
                </span>
                <div className="flex flex-wrap items-center gap-2">
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
                  <input
                    type="range"
                    min={8}
                    max={55}
                    value={widthPercent}
                    onChange={(e) => setWidthPercent(Number(e.target.value))}
                    className="h-2 w-full max-w-[10rem] accent-amber-500 sm:w-40"
                    aria-label="Signature width"
                  />
                </div>
              </div>
            </div>

            <Card className="p-3 sm:p-4">
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as SigMode)}
                className="space-y-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto sm:grid-cols-none sm:flex">
                    <TabsTrigger value="saved" className="text-xs sm:text-sm">
                      Saved
                    </TabsTrigger>
                    <TabsTrigger value="draw" className="text-xs sm:text-sm">
                      <PenTool className="mr-1.5 h-3.5 w-3.5" />
                      Draw
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="text-xs sm:text-sm">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Upload
                    </TabsTrigger>
                  </TabsList>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSignature}
                    disabled={!hasSignature && !uploadedSigUrl}
                    className="w-full sm:w-auto"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>

                <TabsContent value="saved" className="mt-0 space-y-3">
                  {savedLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : savedSignatures.length === 0 ? (
                    <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                      <p>No saved signatures yet.</p>
                      <p className="mt-1">
                        Draw or upload below, or manage them in{" "}
                        <Link
                          href="/settings"
                          className="font-medium text-foreground underline underline-offset-2"
                          onClick={() => onOpenChange(false)}
                        >
                          Settings → Signatures
                        </Link>
                        .
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {savedSignatures.map((sig) => (
                        <button
                          key={sig.id}
                          type="button"
                          onClick={() => selectSaved(sig)}
                          className={cn(
                            "rounded-md border p-2 text-left transition-colors hover:bg-muted/50",
                            selectedSavedId === sig.id &&
                              "border-primary bg-primary/5 ring-1 ring-primary",
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {sig.label}
                            </span>
                            {sig.isDefault ? (
                              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <div className="flex h-14 items-center justify-center rounded bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sig.imageData}
                              alt={sig.label}
                              className="max-h-12 w-auto object-contain"
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

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
                  <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-4 sm:p-6">
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

          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:px-6">
            <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={beginConfirm}
              disabled={!hasSignature || loading}
              className="w-full sm:w-auto"
            >
              <Check className="mr-2 h-4 w-4" />
              {isEditing ? "Review & update" : "Review & apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation 1 — review accuracy */}
      <Dialog
        open={confirmStep === 1}
        onOpenChange={(next) => {
          if (!next && !loading) setConfirmStep(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm your signature
            </DialogTitle>
            <DialogDescription>
              Please check the placement and signature image carefully. If
              anything looks wrong, go back and edit it now.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Document: <span className="font-medium text-foreground">{documentName || "Untitled"}</span>
            <br />
            Page {isRichText ? 1 : page} · position {xPercent.toFixed(0)}%,{" "}
            {yPercent.toFixed(0)}% · size {Math.round(widthPercent)}%
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setConfirmStep(null)}
              className="w-full sm:w-auto"
            >
              Go back and edit
            </Button>
            <Button
              onClick={() => setConfirmStep(2)}
              className="w-full sm:w-auto"
            >
              Looks correct — continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation 2 — affirm final */}
      <Dialog
        open={confirmStep === 2}
        onOpenChange={(next) => {
          if (!next && !loading) setConfirmStep(1);
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Affirm as final
            </DialogTitle>
            <DialogDescription>
              This will stamp your signature onto the document
              {isEditing ? " (replacing your previous stamp)" : ""} and create a
              new version. Treat this as your final signature for this request.
              You can still correct it afterward only if no later signer has
              signed yet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setConfirmStep(1)}
              className="w-full sm:w-auto"
            >
              Back
            </Button>
            <Button
              disabled={loading}
              onClick={handleSign}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Confirm final update" : "Confirm final signature"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={offerSaveOpen}
        onOpenChange={(next) => {
          setOfferSaveOpen(next);
          if (!next) setPendingSaveImage(null);
        }}
        title="Save this signature?"
        description="Keep this drawing or photo in Settings so you can select it the next time you sign."
        confirmLabel="Save for next time"
        cancelLabel="Not now"
        onConfirm={() => {
          setOfferSaveOpen(false);
          setSaveAfterSignOpen(true);
        }}
      />

      <SaveSignatureEditorDialog
        open={saveAfterSignOpen}
        onOpenChange={(next) => {
          setSaveAfterSignOpen(next);
          if (!next) setPendingSaveImage(null);
        }}
        defaultLabel="My signature"
        initialImageData={pendingSaveImage}
        onSaved={() => {
          setSaveAfterSignOpen(false);
          setPendingSaveImage(null);
        }}
      />
    </>
  );
}
