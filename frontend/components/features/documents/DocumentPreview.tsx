"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, ZoomIn, ZoomOut, RotateCw, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface DocumentPreviewProps {
  documentId: string;
  fileType?: string;
  fileName?: string;
  document?: any; // Full document object with richTextContent
}

export function DocumentPreview({ documentId, fileType, fileName, document }: DocumentPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // Determine preview type based on file extension
  const isImage = fileType?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = fileType?.match(/\.pdf$/i);
  const isRichText = document?.richTextContent || fileType?.toLowerCase() === 'html';
  const richTextContent = document?.richTextContent;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // Enhanced preview with controls
  const previewContent = (
    <div className="w-full relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2">
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
        <Button variant="ghost" size="icon" onClick={handleRotate}>
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setFullscreen(true)}>
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview Area */}
      <div
        className={`${isRichText ? 'min-h-[600px]' : 'aspect-[8.5/11]'} bg-background flex items-start justify-center relative overflow-auto border rounded-lg`}
        style={{
          transform: `rotate(${rotation}deg) scale(${zoom / 100})`,
          transition: "transform 0.3s ease",
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        )}
        {isRichText && richTextContent ? (
          <div 
            className="w-full p-8 prose max-w-none"
            dangerouslySetInnerHTML={{ __html: richTextContent }}
            style={{ transform: 'none' }} // Reset transform for rich text
          />
        ) : isRichText && !richTextContent ? (
          <div className="text-center p-8 w-full">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No content available for this rich text document
            </p>
          </div>
        ) : (
          <div className="text-center p-8 w-full">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Document preview will be displayed here
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {isPdf
                ? "PDF viewer will be integrated with react-pdf"
                : isImage
                ? "Image viewer with zoom and rotate"
                : "PDF, images, and Office documents supported"}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                // Download action
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card className="w-full">
        {previewContent}
      </Card>

      {/* Fullscreen Modal */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <div className="relative w-full h-[90vh]">{previewContent}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
