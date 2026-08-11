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
  storagePath?: string;
}

interface DocumentVersionsProps {
  documentId: string;
  /** Current file storage path — used to mark which snapshot is live. */
  currentStoragePath?: string | null;
  onVersionRestored?: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export function DocumentVersions({
  documentId,
  currentStoragePath,
  onVersionRestored,
}: DocumentVersionsProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const versionsData = await api.getFileVersions(documentId);
      const transformedVersions: DocumentVersion[] = versionsData.map((v: any) => ({
        id: v.id,
        version: v.versionNumber,
        versionNumber: v.versionNumber,
        size: Number(v.sizeBytes ?? v.fileSize ?? 0),
        createdBy: v.createdBy || "Unknown",
        createdByName: v.createdByName || v.createdBy || "Unknown",
        createdAt: new Date(v.createdAt),
        // Historical rows — "current" lives on File.storagePath after each write.
        isCurrent: Boolean(
          currentStoragePath && v.storagePath && v.storagePath === currentStoragePath,
        ),
        isRichTextVersion: v.isRichTextVersion || false,
        richTextContent: v.richTextContent || undefined,
        storagePath: v.storagePath,
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
    if (restoring) return;

    setRestoring(versionId);
    try {
      await api.restoreFileVersion(documentId, versionId);
      toast.success("Rolled back to that version");
      await loadVersions();
      onVersionRestored?.();
    } catch (error: any) {
      console.error("Failed to restore version:", error);
      toast.error(error?.message || "Failed to restore version. Please try again.");
    } finally {
      setRestoring(null);
    }
  };

  const handleDownload = async (versionId: string) => {
    setDownloading(versionId);
    try {
      await api.downloadFileVersion(documentId, versionId);
      toast.success("Download started");
    } catch (error: any) {
      toast.error(error?.message || "Failed to download version");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version History ({versions.length})</CardTitle>
        <p className="text-sm text-muted-foreground">
          Signing and uploads save a snapshot first. Restore rolls the live file
          back to that snapshot (and keeps the current copy in history).
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No previous versions yet. Sign or upload a new version to create one.
          </p>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div key={version.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">
                            Version {version.versionNumber || version.version}
                          </span>
                          {version.isCurrent && (
                            <Badge variant="default">Matches live file</Badge>
                          )}
                          {version.isRichTextVersion && (
                            <Badge variant="secondary">Rich Text</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>
                              {version.createdByName ||
                                (version.createdBy &&
                                !/^[0-9a-f-]{36}$/i.test(String(version.createdBy))
                                  ? version.createdBy
                                  : "Someone")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(version.createdAt, {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          {formatFileSize(version.size) && (
                            <span>{formatFileSize(version.size)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!version.isRichTextVersion && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(version.id)}
                          disabled={downloading === version.id}
                        >
                          {downloading === version.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
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
                            Restoring…
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
