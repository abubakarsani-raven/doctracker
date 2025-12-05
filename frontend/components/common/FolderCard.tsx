"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder, MoreVertical, ChevronRight, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { AccessRequestDialog } from "@/components/features/documents/AccessRequestDialog";

export interface FolderData {
  id: string;
  name: string;
  description?: string;
  scope?: "company" | "department" | "division";
  documentCount?: number;
  modifiedAt: Date;
  createdBy?: string;
  parentId?: string;
}

interface FolderCardProps {
  folder: FolderData;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
  hasAccess?: boolean; // Whether the current user has access to this folder
}

const scopeLabels: Record<string, string> = {
  company: "Company-wide",
  department: "Dept-wide",
  division: "Division-wide",
};

export function FolderCard({
  folder,
  onView,
  onEdit,
  onDelete,
  className,
  hasAccess = true, // Default to true for backward compatibility
}: FolderCardProps) {
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);

  const handleView = () => {
    if (!hasAccess) {
      setRequestAccessOpen(true);
      return;
    }
    onView?.(folder.id);
  };

  const handleEdit = () => {
    if (!hasAccess) {
      setRequestAccessOpen(true);
      return;
    }
    onEdit?.(folder.id);
  };

  const handleDelete = () => {
    if (!hasAccess) {
      setRequestAccessOpen(true);
      return;
    }
    onDelete?.(folder.id);
  };

  return (
    <Card className={cn("hover:shadow-md transition-shadow flex flex-col h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link
            href={`/documents/folder/${folder.id}`}
            className="flex items-center gap-3 flex-1 min-w-0 group"
          >
            <div className="flex-shrink-0">
              <Folder className="h-8 w-8 text-yellow-500 fill-yellow-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate group-hover:text-primary">
                  {folder.name}
                </h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {folder.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {folder.description}
                </p>
              )}
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleView}>View</DropdownMenuItem>
              <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {folder.scope && (
              <Badge variant="outline" className="text-xs">
                {scopeLabels[folder.scope]}
              </Badge>
            )}
            {folder.documentCount !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {folder.documentCount} {folder.documentCount === 1 ? "file" : "files"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Modified {formatDistanceToNow(folder.modifiedAt, { addSuffix: true })}
          </p>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t min-h-[52px] flex items-center">
        {!hasAccess ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRequestAccessOpen(true)}
            className="text-xs w-full"
          >
            <Lock className="h-3 w-3 mr-1" />
            Request Access
          </Button>
        ) : (
          <div className="w-full" />
        )}
      </CardFooter>

      <AccessRequestDialog
        open={requestAccessOpen}
        onOpenChange={setRequestAccessOpen}
        resourceId={folder.id}
        resourceType="folder"
        resourceName={folder.name}
        scope={folder.scope}
      />
    </Card>
  );
}
