"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PdfPageCanvas } from "@/components/features/signatures/PdfPageCanvas";

interface DocumentPreviewProps {
  documentId: string;
  fileType?: string;
  fileName?: string;
  document?: any;
  /**
   * Bumps whenever the underlying file bytes change (e.g. after signing).
   * Without this the blob URL stays cached and the old PDF keeps showing.
   */
  revision?: string | number | null;
  /** Master / Group Secretary only — others preview in the app. */
  canDownload?: boolean;
}

const PREVIEW_FONT_STEPS = [90, 100, 115, 130, 150] as const;

function normalizeType(fileType?: string, fileName?: string): string {
  const raw = (fileType || "").toLowerCase().replace(/^\./, "");
  if (raw) {
    if (raw === "application/pdf" || raw.endsWith("/pdf")) return "pdf";
    if (raw.includes("wordprocessingml") || raw === "msword") return "docx";
    if (raw.includes("/")) return raw.split("/").pop() || raw;
    return raw;
  }
  const ext = fileName?.split(".").pop()?.toLowerCase();
  return ext || "";
}

async function sanitizeHtml(html: string): Promise<string> {
  // Load DOMPurify only in the browser. Top-level isomorphic-dompurify/jsdom
  // has crashed the /documents/[id] SSR document response on Vercel (HTTP 500).
  const { default: DOMPurify } = await import("isomorphic-dompurify");
  return DOMPurify.sanitize(html);
}

/** True when native PDF-in-iframe scrolling is reliable (desktop mouse). */
function useNativePdfViewer(): boolean | null {
  const [native, setNative] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setNative(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return native;
}

/**
 * Touch/mobile-safe PDF preview: pages are canvases inside a normal scroll
 * container. Chrome's PDF plugin inside an iframe often ignores touch / device
 * emulation scrolls.
 */
function PdfTouchScrollPreview({
  src,
  fileName,
}: {
  src: string;
  fileName?: string;
}) {
  const [pageCount, setPageCount] = useState(1);

  return (
    <div
      className="h-[min(70dvh,900px)] min-h-[480px] w-full overflow-y-auto overscroll-y-contain touch-pan-y rounded-b-lg bg-muted"
      role="region"
      aria-label={fileName ? `${fileName} preview` : "PDF preview"}
    >
      {Array.from({ length: pageCount }, (_, i) => (
        <PdfPageCanvas
          key={i + 1}
          src={src}
          page={i + 1}
          onPageCount={i === 0 ? setPageCount : undefined}
          className="relative w-full border-b border-border/60 bg-white last:border-b-0"
        />
      ))}
    </div>
  );
}

export function DocumentPreview({
  documentId,
  fileType,
  fileName,
  document,
  revision,
  canDownload = false,
}: DocumentPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [fontStep, setFontStep] = useState(1); // index into PREVIEW_FONT_STEPS (100%)
  const [reloadKey, setReloadKey] = useState(0);
  const useNativePdf = useNativePdfViewer();

  const type = useMemo(
    () =>
      normalizeType(
        fileType || document?.type || document?.fileType,
        fileName || document?.name || document?.fileName,
      ),
    [fileType, fileName, document],
  );

  const isImage = /^(jpg|jpeg|png|gif|webp)$/i.test(type);
  const isPdf = type === "pdf";
  const isDocx = /^(docx|doc)$/i.test(type);
  const isRichText = Boolean(document?.richTextContent) || type === "html";
  const richTextContent = document?.richTextContent;
  const usesHtmlPreview = isRichText || isDocx;
  const previewFontPercent = PREVIEW_FONT_STEPS[fontStep];

  // Sanitize built-in rich-text HTML on the client only.
  useEffect(() => {
    if (!isRichText || !richTextContent) {
      if (isRichText) setHtmlPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const clean = await sanitizeHtml(richTextContent);
        if (!cancelled) setHtmlPreview(clean);
      } catch {
        if (!cancelled) setHtmlPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRichText, richTextContent, reloadKey]);

  // Load binary previews (PDF / images / DOCX) via authenticated download.
  useEffect(() => {
    const needsBlob = !isRichText && (isPdf || isImage || isDocx) && !!documentId;
    if (!needsBlob) {
      setPreviewUrl(null);
      if (!isRichText) {
        setError(null);
        setLoading(false);
        if (!isDocx) setHtmlPreview(null);
      }
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      if (isDocx) setHtmlPreview(null);
      else setPreviewUrl(null);
      try {
        const { blob, contentType } = await api.getDocumentBlob(documentId);
        if (cancelled) return;

        if (blob.size < 5) {
          throw Object.assign(new Error("Document file is empty"), {
            code: "NOT_FOUND",
          });
        }

        if (isDocx) {
          const mammoth = await import("mammoth");
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (cancelled) return;
          const clean = await sanitizeHtml(result.value || "");
          if (cancelled) return;
          if (!clean.trim()) {
            setError("This Word document has no previewable text content");
            setHtmlPreview(null);
          } else {
            setHtmlPreview(clean);
          }
          return;
        }

        let previewBlob = blob;
        if (isPdf) {
          const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
          const magic = String.fromCharCode(...head);
          if (!magic.startsWith("%PDF")) {
            throw Object.assign(
              new Error(
                "Downloaded file is not a valid PDF. Try Download, or re-upload the document.",
              ),
              { code: "NOT_FOUND" },
            );
          }
          // Chrome only paints PDFs in <iframe> when the blob MIME is application/pdf.
          if (blob.type !== "application/pdf") {
            previewBlob = new Blob([blob], { type: "application/pdf" });
          }
        } else if (
          isImage &&
          contentType?.startsWith("image/") &&
          contentType !== blob.type
        ) {
          previewBlob = new Blob([blob], { type: contentType });
        }

        objectUrl = URL.createObjectURL(previewBlob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreviewUrl(objectUrl);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Could not load document preview");
        setErrorCode(err?.code || null);
        setPreviewUrl(null);
        setHtmlPreview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, isPdf, isImage, isDocx, isRichText, revision, reloadKey]);

  const handleDownload = async () => {
    try {
      await api.downloadDocument(documentId);
      toast.success("Download started");
    } catch (err: any) {
      toast.error(
        "Failed to download document: " + (err.message || "Unknown error"),
      );
    }
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <Skeleton className="h-full min-h-[480px] w-full" />
        </div>
      );
    }

    if (usesHtmlPreview && htmlPreview) {
      return (
        <div
          className="prose w-full max-w-none p-8 dark:prose-invert"
          style={{ fontSize: `${previewFontPercent}%` }}
          dangerouslySetInnerHTML={{ __html: htmlPreview }}
        />
      );
    }

    if (isRichText && !htmlPreview) {
      return (
        <div className="w-full p-8 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">
            No content available for this rich text document
          </p>
        </div>
      );
    }

    if (error) {
      const samePathAsDownload =
        errorCode === "STORAGE_UNAVAILABLE" ||
        errorCode === "NOT_FOUND" ||
        errorCode === "CONTENT_PENDING";
      return (
        <div className="w-full p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <p className="font-medium text-foreground">Couldn’t load preview</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Retry
            </Button>
            {!samePathAsDownload && canDownload && (
              <Button variant="outline" onClick={handleDownload}>
                Download instead
              </Button>
            )}
            {samePathAsDownload && (
              <p className="w-full text-xs text-muted-foreground">
                Download uses the same storage path — retry when storage is back.
              </p>
            )}
          </div>
        </div>
      );
    }

    if (isPdf && previewUrl) {
      if (useNativePdf === null) {
        return (
          <div className="relative h-[min(70dvh,900px)] min-h-[480px] w-full">
            <Skeleton className="h-full w-full rounded-b-lg" />
          </div>
        );
      }
      if (!useNativePdf) {
        return <PdfTouchScrollPreview src={previewUrl} fileName={fileName} />;
      }
      // Desktop: native PDF chrome (zoom / download / print). Keep the iframe
      // as the only scroller — a parent overflow-auto steals wheel/touch.
      return (
        <div className="h-[min(70dvh,900px)] min-h-[560px] w-full overflow-hidden overscroll-contain rounded-b-lg bg-muted">
          <iframe
            title={fileName || "PDF preview"}
            src={`${previewUrl}#toolbar=${canDownload ? 1 : 0}&navpanes=0`}
            className="h-full w-full border-0 bg-muted"
          />
        </div>
      );
    }

    if (isImage && previewUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={fileName || "Document preview"}
          className="max-h-[min(80vh,900px)] max-w-full object-contain"
        />
      );
    }

    return (
      <div className="w-full p-8 text-center">
        <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">
          Preview is not available for this file type
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {canDownload
            ? "Download the file to open it in another app"
            : "This file type cannot be previewed here. Ask Master or Group Secretary if you need a copy."}
        </p>
        {canDownload && (
        <Button variant="outline" className="mt-4" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full overflow-hidden">
      {usesHtmlPreview ? (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {isDocx ? "Word preview text size" : "Preview text size"}
          </p>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Preview text size"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={fontStep === 0}
              onClick={() => setFontStep((s) => Math.max(0, s - 1))}
              aria-label="Decrease preview text size"
            >
              A−
            </Button>
            <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
              {previewFontPercent}%
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={fontStep === PREVIEW_FONT_STEPS.length - 1}
              onClick={() =>
                setFontStep((s) =>
                  Math.min(PREVIEW_FONT_STEPS.length - 1, s + 1),
                )
              }
              aria-label="Increase preview text size"
            >
              A+
            </Button>
          </div>
        </div>
      ) : null}
      <div
        className={
          isPdf && previewUrl
            ? "relative w-full overflow-hidden rounded-lg border bg-background"
            : `${
                usesHtmlPreview ? "min-h-[600px]" : "min-h-[560px]"
              } relative flex max-h-[min(70dvh,900px)] items-start justify-center overflow-y-auto overscroll-y-contain touch-pan-y rounded-lg border bg-background`
        }
      >
        {renderBody()}
      </div>
    </Card>
  );
}
