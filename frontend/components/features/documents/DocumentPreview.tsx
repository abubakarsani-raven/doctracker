"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
}

const PREVIEW_FONT_STEPS = [90, 100, 115, 130, 150] as const;

function normalizeType(fileType?: string, fileName?: string): string {
  const raw = (fileType || "").toLowerCase().replace(/^\./, "");
  if (raw) return raw;
  const ext = fileName?.split(".").pop()?.toLowerCase();
  return ext || "";
}

export function DocumentPreview({
  documentId,
  fileType,
  fileName,
  document,
  revision,
}: DocumentPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fontStep, setFontStep] = useState(1); // index into PREVIEW_FONT_STEPS (100%)

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
  const isRichText = Boolean(document?.richTextContent) || type === "html";
  const richTextContent = document?.richTextContent;
  const sanitizedRichText = richTextContent
    ? DOMPurify.sanitize(richTextContent)
    : undefined;
  const previewFontPercent = PREVIEW_FONT_STEPS[fontStep];

  // Load binary previews (PDF / images) via authenticated download → blob URL
  useEffect(() => {
    if (isRichText || (!isPdf && !isImage) || !documentId) {
      setPreviewUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { blob } = await api.getDocumentBlob(documentId);
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreviewUrl(objectUrl);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Could not load document preview");
        setPreviewUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, isPdf, isImage, isRichText, revision]);

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

    if (isRichText && sanitizedRichText) {
      return (
        <div
          className="prose w-full max-w-none p-8"
          style={{ fontSize: `${previewFontPercent}%` }}
          dangerouslySetInnerHTML={{ __html: sanitizedRichText }}
        />
      );
    }

    if (isRichText && !sanitizedRichText) {
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
      return (
        <div className="w-full p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={handleDownload}>
            Download instead
          </Button>
        </div>
      );
    }

    if (isPdf && previewUrl) {
      // Native PDF chrome already has zoom / download / print — no overlay.
      return (
        <iframe
          title={fileName || "PDF preview"}
          src={`${previewUrl}#toolbar=1&navpanes=0`}
          className="h-[min(80vh,900px)] min-h-[560px] w-full rounded-b-lg border-0 bg-muted"
        />
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
          Download the file to open it in another app
        </p>
        <Button variant="outline" className="mt-4" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
    );
  };

  return (
    <Card className="w-full overflow-hidden">
      {isRichText ? (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-xs text-muted-foreground">Preview text size</p>
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
        className={`${
          isRichText ? "min-h-[600px]" : "min-h-[560px]"
        } relative flex items-start justify-center overflow-auto rounded-lg border bg-background`}
      >
        {renderBody()}
      </div>
    </Card>
  );
}
