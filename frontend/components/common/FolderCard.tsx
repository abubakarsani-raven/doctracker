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
import {
  ScopeMark,
  RestrictedMark,
  scopeIconClass,
} from "@/components/common/ScopeMark";

export interface FolderData {
  id: string;
  name: string;
  description?: string;
  scope?: "company" | "department" | "division";
  scopeLevel?: string;
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
  /** Whether the current user may open this folder. */
  hasAccess?: boolean;
  /** Optional sentence explaining why access is refused. */
  accessReason?: string | null;
}

export function FolderCard({
  folder,
  onView,
  onEdit,
  onDelete,
  className,
  hasAccess = true,
  accessReason,
}: FolderCardProps) {
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const scope = folder.scopeLevel ?? folder.scope;

  const guard = (action?: (id: string) => void) => () => {
    if (!hasAccess) {
      setRequestAccessOpen(true);
      return;
    }
    action?.(folder.id);
  };

  const title = (
    <div className="flex items-start gap-2">
      <h3
        className={cn(
          "min-w-0 flex-1 break-words font-semibold text-sm leading-snug",
          hasAccess && "group-hover:text-primary",
        )}
      >
        {folder.name}
      </h3>
      {hasAccess ? (
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      ) : (
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-scope-restricted" aria-hidden />
      )}
    </div>
  );

  const heading = (
    <>
      <div className="shrink-0">
        <Folder
          className={cn("h-8 w-8", scopeIconClass(scope, !hasAccess))}
        />
      </div>
      <div className="min-w-0 flex-1">
        {title}
        {folder.description && (
          <p className="mt-1 break-words text-xs text-muted-foreground line-clamp-3">
            {folder.description}
          </p>
        )}
      </div>
    </>
  );

  return (
    <Card
      className={cn(
        "flex h-full flex-col transition-shadow",
        hasAccess ? "hover:shadow-md" : "bg-muted/20",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          {/* A folder the viewer cannot open is not a link. Rendering one that
              leads to a locked page is a dead end dressed up as an affordance. */}
          {hasAccess ? (
            <Link
              href={`/documents/folder/${folder.id}`}
              className="group flex min-w-0 flex-1 items-center gap-3"
            >
              {heading}
            </Link>
          ) : (
            <div
              className="flex min-w-0 flex-1 items-center gap-3"
              title={accessReason ?? undefined}
            >
              {heading}
            </div>
          )}

          {(onEdit || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`More options for ${folder.name}`}>
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options for {folder.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={guard(onView)}>Open</DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={guard(onEdit)}>Rename</DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={guard(onDelete)}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {hasAccess ? (
              <ScopeMark scope={scope} />
            ) : (
              <RestrictedMark />
            )}
            {folder.documentCount !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {folder.documentCount}{" "}
                {folder.documentCount === 1 ? "file" : "files"}
              </Badge>
            )}
          </div>
          <p className="stamp text-muted-foreground">
            {formatDistanceToNow(folder.modifiedAt, { addSuffix: true })}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex min-h-[52px] items-center border-t pt-3">
        {!hasAccess ? (
          <div className="w-full space-y-2">
            {accessReason && (
              <p className="text-xs leading-snug text-muted-foreground">
                {accessReason}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestAccessOpen(true)}
              className="w-full text-xs"
            >
              <Lock className="mr-1 h-3 w-3" />
              Request access
            </Button>
          </div>
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
