"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type PdfjsLib = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsLib> | null = null;

async function getPdfjs(): Promise<PdfjsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      // CDN worker matches the installed package version (Next-friendly).
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

interface PdfPageCanvasProps {
  src: string | null;
  /** 1-based page index. */
  page: number;
  className?: string;
  onPageCount?: (count: number) => void;
  onError?: (message: string) => void;
}

/**
 * Renders exactly one PDF page to a canvas (no iframe — Safari-safe).
 */
export function PdfPageCanvas({
  src,
  page,
  className,
  onPageCount,
  onError,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onPageCountRef = useRef(onPageCount);
  const onErrorRef = useRef(onError);
  onPageCountRef.current = onPageCount;
  onErrorRef.current = onError;

  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    let destroyDoc: (() => void) | null = null;

    (async () => {
      setRendering(true);
      try {
        const pdfjs = await getPdfjs();
        const data = await fetch(src).then((r) => {
          if (!r.ok) throw new Error("Failed to load PDF");
          return r.arrayBuffer();
        });
        if (cancelled) return;

        const loadingTask = pdfjs.getDocument({ data });
        destroyDoc = () => {
          try {
            loadingTask.destroy();
          } catch {
            // ignore
          }
        };

        const pdf = await loadingTask.promise;
        if (cancelled) return;

        onPageCountRef.current?.(pdf.numPages);

        const pageIndex = Math.min(Math.max(1, page), pdf.numPages);
        const pdfPage = await pdf.getPage(pageIndex);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const base = pdfPage.getViewport({ scale: 1 });
        const parentWidth = canvas.parentElement?.clientWidth || 512;
        const scale = (parentWidth / base.width) * 2; // retina
        const viewport = pdfPage.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        await pdfPage.render({
          canvasContext: ctx,
          viewport,
          canvas,
        } as any).promise;
      } catch (err: any) {
        if (!cancelled) {
          onErrorRef.current?.(err?.message || "Could not render PDF page");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      destroyDoc?.();
    };
  }, [src, page]);

  return (
    <div className={className}>
      {rendering && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-background/50">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <canvas ref={canvasRef} className="block w-full bg-white" />
    </div>
  );
}
