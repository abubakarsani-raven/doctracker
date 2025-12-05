"use client";

import { useState } from "react";
import Link from "next/link";
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
  status?: string;
  modifiedAt: Date;
  createdBy?: string;
}

interface DocumentCardProps {
  document: Document;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  onAddToFolder?: (id: string) => void;
  className?: string;
  hasAccess?: boolean; // Whether the current user has access to this document
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

const scopeLabels: Record<string, string> = {
  company: "Company-wide",
  department: "Dept-wide",
  division: "Division-wide",
};

export function DocumentCard({
  document,
  onView,
  onDownload,
  onAddToFolder,
  className,
  hasAccess = true, // Default to true for backward compatibility
}: DocumentCardProps) {
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);

  const handleView = () => {
    if (!hasAccess) {
      setRequestAccessOpen(true);
      return;
    }
    onView?.(document.id);
  };

  const handleDownload = () => {
    if (!hasAccess) {
      setRequestAccessOpen(true);
      return;
    }
    onDownload?.(document.id);
  };

  const handleAddToFolder = () => {
    if (!hasAccess) {
      setRequestAccessOpen(true);
      return;
    }
    onAddToFolder?.(document.id);
  };

  return (
    <Card className={cn("hover:shadow-md transition-shadow flex flex-col h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/documents/${document.id}`}
                className="block"
              >
                <h3 className="font-semibold text-sm truncate hover:text-primary">
                  {document.name}
                </h3>
              </Link>
              <p className="text-xs text-muted-foreground mt-1">
                {formatFileSize(document.size)} • {document.type.toUpperCase()}
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
              <DropdownMenuItem onClick={handleAddToFolder}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Add to Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {document.scope && (
            <Badge variant="outline" className="text-xs">
              {scopeLabels[document.scope]}
            </Badge>
          )}
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
      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-muted-foreground">
            Modified {formatDistanceToNow(document.modifiedAt, { addSuffix: true })}
          </span>
          {!hasAccess && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestAccessOpen(true)}
              className="text-xs"
            >
              <Lock className="h-3 w-3 mr-1" />
              Request Access
            </Button>
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
