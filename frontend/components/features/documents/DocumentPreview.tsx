"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ZoomIn, ZoomOut, RotateCw, Maximize, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const type = useMemo(
    () => normalizeType(fileType || document?.type || document?.fileType, fileName || document?.name || document?.fileName),
    [fileType, fileName, document],
  );

  const isImage = /^(jpg|jpeg|png|gif|webp)$/i.test(type);
  const isPdf = type === "pdf";
  const isRichText =
    Boolean(document?.richTextContent) || type === "html";
  const richTextContent = document?.richTextContent;
  const sanitizedRichText = richTextContent
    ? DOMPurify.sanitize(richTextContent)
    : undefined;

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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = async () => {
    try {
      await api.downloadDocument(documentId);
      toast.success("Download started");
    } catch (err: any) {
      toast.error("Failed to download document: " + (err.message || "Unknown error"));
    }
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <Skeleton className="w-full h-full min-h-[480px]" />
        </div>
      );
    }

    if (isRichText && sanitizedRichText) {
      return (
        <div
          className="w-full p-8 prose max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedRichText }}
        />
      );
    }

    if (isRichText && !sanitizedRichText) {
      return (
        <div className="text-center p-8 w-full">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No content available for this rich text document
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-8 w-full">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={handleDownload}>
            Download instead
          </Button>
        </div>
      );
    }

    if (isPdf && previewUrl) {
      return (
        <iframe
          title={fileName || "PDF preview"}
          src={`${previewUrl}#toolbar=1&navpanes=0`}
          className="w-full h-[min(80vh,900px)] min-h-[560px] border-0 rounded-b-lg bg-muted"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
          }}
        />
      );
    }

    if (isImage && previewUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={fileName || "Document preview"}
          className="max-w-full max-h-[min(80vh,900px)] object-contain"
          style={{
            transform: `rotate(${rotation}deg) scale(${zoom / 100})`,
            transition: "transform 0.3s ease",
          }}
        />
      );
    }

    return (
      <div className="text-center p-8 w-full">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          Preview is not available for this file type
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Download the file to open it in another app
        </p>
        <Button variant="outline" className="mt-4" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
    );
  };

  const previewContent = (
    <div className="w-full relative">
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          title="Download document"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          disabled={zoom <= 50}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="px-2 py-1 text-sm">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          disabled={zoom >= 200}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        {isImage && (
          <Button variant="ghost" size="icon" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => setFullscreen(true)}>
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={`${
          isRichText ? "min-h-[600px]" : "min-h-[560px]"
        } bg-background flex items-start justify-center relative overflow-auto border rounded-lg`}
      >
        {renderBody()}
      </div>
    </div>
  );

  return (
    <>
      <Card className="w-full overflow-hidden">{previewContent}</Card>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <div className="relative w-full h-[90vh] overflow-auto p-2">
            {isPdf && previewUrl ? (
              <iframe
                title={fileName || "PDF preview"}
                src={`${previewUrl}#toolbar=1`}
                className="w-full h-full border-0"
              />
            ) : isImage && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={fileName || "Document preview"}
                className="max-w-full max-h-full mx-auto object-contain"
                style={{ transform: `rotate(${rotation}deg) scale(${zoom / 100})` }}
              />
            ) : (
              previewContent
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
