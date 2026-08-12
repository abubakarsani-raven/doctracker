"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  ImagePlus,
  Trash2,
  X,
} from "lucide-react";
import { MAX_PAGES } from "@/lib/scan-to-pdf";

export interface ScanPage {
  id: string;
  file: File;
  previewUrl: string;
}

interface ScanPagesPanelProps {
  pages: ScanPage[];
  onPagesChange: (pages: ScanPage[]) => void;
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  disabled?: boolean;
}

function defaultScanName() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `Scan ${y}-${m}-${day}`;
}

function makePage(file: File): ScanPage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export function ScanPagesPanel({
  pages,
  onPagesChange,
  documentName,
  onDocumentNameChange,
  disabled,
}: ScanPagesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // Only revoke on unmount of the panel lifecycle managed by parent resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const images = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (images.length === 0) {
      toast.error("Please choose image files (JPEG, PNG, …)");
      return;
    }
    if (pages.length + images.length > MAX_PAGES) {
      toast.error(`A scan can have at most ${MAX_PAGES} pages`);
      return;
    }
    const next = [...pages, ...images.map(makePage)];
    onPagesChange(next);
    if (!documentName.trim()) {
      onDocumentNameChange(defaultScanName());
    }
  };

  const removePage = (id: string) => {
    const page = pages.find((p) => p.id === id);
    if (page) URL.revokeObjectURL(page.previewUrl);
    onPagesChange(pages.filter((p) => p.id !== id));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onPagesChange(next);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      // Fall back to capture input (works well on phones).
      cameraInputRef.current?.click();
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera is not ready yet");
      return;
    }
    if (pages.length >= MAX_PAGES) {
      toast.error(`A scan can have at most ${MAX_PAGES} pages`);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Could not capture page");
          return;
        }
        const file = new File(
          [blob],
          `page-${pages.length + 1}.jpg`,
          { type: "image/jpeg" },
        );
        const next = [...pages, makePage(file)];
        onPagesChange(next);
        if (!documentName.trim()) {
          onDocumentNameChange(defaultScanName());
        }
        toast.success("Page added");
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add scanned pages, then we&apos;ll combine them into one PDF. Works with
        images from a desktop scanner or your camera.
      </p>

      <div className="space-y-2">
        <Label htmlFor="scan-document-name">Document name</Label>
        <Input
          id="scan-document-name"
          value={documentName}
          onChange={(e) => onDocumentNameChange(e.target.value)}
          placeholder={defaultScanName()}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || pages.length >= MAX_PAGES}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Add images
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || pages.length >= MAX_PAGES}
          onClick={startCamera}
        >
          <Camera className="mr-2 h-4 w-4" />
          Add from camera
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {cameraOpen && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Camera</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={stopCamera}
              aria-label="Close camera"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-56 w-full rounded-md bg-black object-contain"
          />
          <Button
            type="button"
            size="sm"
            onClick={captureFromVideo}
            disabled={disabled || pages.length >= MAX_PAGES}
          >
            <Camera className="mr-2 h-4 w-4" />
            Capture page
          </Button>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No pages yet — add images or capture from camera.
        </div>
      ) : (
        <ul className="space-y-2">
          {pages.map((page, index) => (
            <li
              key={page.id}
              className="flex items-center gap-3 rounded-lg border p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.previewUrl}
                alt={`Page ${index + 1}`}
                className="h-16 w-12 shrink-0 rounded object-cover bg-muted"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Page {index + 1}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {page.file.name}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled || index === 0}
                  onClick={() => movePage(index, -1)}
                  aria-label="Move page up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled || index === pages.length - 1}
                  onClick={() => movePage(index, 1)}
                  aria-label="Move page down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={disabled}
                  onClick={() => removePage(page.id)}
                  aria-label="Remove page"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {pages.length} / {MAX_PAGES} pages
      </p>
    </div>
  );
}

export { defaultScanName };
