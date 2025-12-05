"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Clock, User, RotateCcw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface DocumentVersion {
  id: string;
  version: number;
  versionNumber: number;
  size: number;
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  isCurrent: boolean;
  isRichTextVersion?: boolean;
  richTextContent?: string;
}

interface DocumentVersionsProps {
  documentId: string;
  onVersionRestored?: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export function DocumentVersions({ documentId, onVersionRestored }: DocumentVersionsProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Load versions when component mounts
  useEffect(() => {
    loadVersions();
  }, [documentId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const versionsData = await api.getFileVersions(documentId);
      
      // Transform backend data to component format
      // Note: Current content is not in versions table - it's in the document itself
      // Versions are historical snapshots, so we don't mark any as "current"
      const transformedVersions: DocumentVersion[] = versionsData.map((v: any) => ({
        id: v.id,
        version: v.versionNumber,
        versionNumber: v.versionNumber,
        size: 0, // Size not stored in version table
        createdBy: v.createdBy || "Unknown",
        createdByName: v.createdByName || v.createdBy || "Unknown",
        createdAt: new Date(v.createdAt),
        isCurrent: false, // Current content is in the document, not in versions
        isRichTextVersion: v.isRichTextVersion || false,
        richTextContent: v.richTextContent || undefined,
      }));
      
      setVersions(transformedVersions);
    } catch (error) {
      console.error("Failed to load versions:", error);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (restoring) return; // Prevent multiple simultaneous restores

    setRestoring(versionId);
    try {
      await api.restoreFileVersion(documentId, versionId);
      toast.success("Version restored successfully");
      // Reload versions to show the updated state
      await loadVersions();
      // Notify parent to refresh document data
      onVersionRestored?.();
    } catch (error: any) {
      console.error("Failed to restore version:", error);
      toast.error(error?.message || "Failed to restore version. Please try again.");
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version History ({versions.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No previous versions available.
          </p>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div key={version.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">Version {version.versionNumber || version.version}</span>
                          {version.isCurrent && (
                            <Badge variant="default">Current</Badge>
                          )}
                          {version.isRichTextVersion && (
                            <Badge variant="secondary">Rich Text</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{version.createdByName || version.createdBy}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(version.createdAt, { addSuffix: true })}
                            </span>
                          </div>
                          {version.size > 0 && (
                            <span>{formatFileSize(version.size)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!version.isRichTextVersion && (
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(version.id)}
                        disabled={restoring === version.id}
                      >
                        {restoring === version.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {index < versions.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
