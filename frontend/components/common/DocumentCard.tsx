"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, MoreVertical, Download, Eye, Folder, FolderOpen, FolderPlus, Lock } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AccessRequestDialog } from "@/components/features/documents/AccessRequestDialog";
import {
  ScopeMark,
  RestrictedMark,
  scopeIconClass,
} from "@/components/common/ScopeMark";

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  folder?: string;
  folderId?: string;
  folderCount?: number;
  folderIds?: string[];
  folderNames?: string[];
  scope?: "company" | "department" | "division";
  scopeLevel?: string;
  status?: string;
  modifiedAt: Date;
  createdBy?: string;
  access?: { canRead?: boolean; reason?: string } | null;
}

interface DocumentCardProps {
  document: Document;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  onAddToFolder?: (id: string) => void;
  className?: string;
  /** Whether the current user may open this document. Omit to use `document.access`. */
  hasAccess?: boolean;
  /** Optional sentence explaining why access is refused. */
  accessReason?: string | null;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

export function DocumentCard({
  document,
  onView,
  onDownload,
  onAddToFolder,
  className,
  hasAccess,
  accessReason,
}: DocumentCardProps) {
  const router = useRouter();
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const scope = document.scopeLevel ?? document.scope;
  const allowed =
    typeof hasAccess === "boolean"
      ? hasAccess
      : typeof document.access?.canRead === "boolean"
        ? document.access.canRead
        : true;
  const accessRevoked =
    document.access?.reason === "access_revoked" ||
    accessReason?.toLowerCase().includes("group administrator");

  const handleView = () => {
    if (!allowed) {
      if (!accessRevoked) setRequestAccessOpen(true);
      return;
    }
    if (onView) {
      onView(document.id);
      return;
    }
    // Fallback when parent didn't pass onView — navigate to the detail page.
    router.push(`/documents/${document.id}`);
  };

  const handleDownload = () => {
    if (!allowed) {
      if (!accessRevoked) setRequestAccessOpen(true);
      return;
    }
    onDownload?.(document.id);
  };

  const handleAddToFolder = () => {
    if (!allowed) {
      if (!accessRevoked) setRequestAccessOpen(true);
      return;
    }
    onAddToFolder?.(document.id);
  };

  return (
    <Card
      className={cn(
        "flex h-full flex-col transition-shadow",
        allowed ? "hover:shadow-md" : "bg-muted/20",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <FileText
                className={cn("h-8 w-8", scopeIconClass(scope, !allowed))}
              />
            </div>
            <div className="flex-1 min-w-0">
              {/* Not a link when the viewer cannot open it — a link to a locked
                  page is a dead end dressed up as an affordance. */}
              {allowed ? (
                <Link href={`/documents/${document.id}`} className="block">
                  <h3 className="break-words text-sm font-semibold leading-snug hover:text-primary">
                    {document.name}
                  </h3>
                </Link>
              ) : (
                <h3
                  className="flex items-start gap-1.5 break-words text-sm font-semibold leading-snug"
                  title={accessReason ?? undefined}
                >
                  <span className="min-w-0 flex-1">{document.name}</span>
                  <Lock
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-scope-restricted"
                    aria-hidden
                  />
                </h3>
              )}
              <p className="stamp mt-1.5 text-muted-foreground">
                {formatFileSize(document.size)} · {document.type.toUpperCase()}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleView}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              {onAddToFolder && (
                <DropdownMenuItem onClick={handleAddToFolder}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Add to Folder
                </DropdownMenuItem>
              )}
              {onDownload && (
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {allowed ? <ScopeMark scope={scope} /> : <RestrictedMark />}
          {document.status && (
            <StatusBadge status={document.status as any} className="text-xs" />
          )}
          {document.folderCount !== undefined && document.folderCount > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  In {document.folderCount} folders
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-semibold">This document appears in {document.folderCount} folders:</p>
                  {document.folderIds && document.folderIds.length > 0 && (
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      {document.folderIds.map((folderId, idx) => (
                        <li key={idx}>{document.folderNames?.[idx] || `Folder ${folderId}`}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="mt-2">
          {document.folder && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Folder className="h-3 w-3" />
              {document.folder}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="stamp text-muted-foreground">
            {formatDistanceToNow(document.modifiedAt, { addSuffix: true })}
          </span>
          {!allowed && (
            accessRevoked ? (
              <span className="text-xs text-muted-foreground">
                Access revoked
              </span>
            ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestAccessOpen(true)}
              className="text-xs"
              title={accessReason ?? undefined}
            >
              <Lock className="mr-1 h-3 w-3" />
              Request access
            </Button>
            )
          )}
        </div>
      </CardFooter>

      <AccessRequestDialog
        open={requestAccessOpen}
        onOpenChange={setRequestAccessOpen}
        resourceId={document.id}
        resourceType="document"
        resourceName={document.name}
        scope={document.scope}
      />
    </Card>
  );
}
