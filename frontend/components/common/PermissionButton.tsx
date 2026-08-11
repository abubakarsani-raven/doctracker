"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ButtonProps = React.ComponentProps<typeof Button>;

export interface PermissionButtonProps extends ButtonProps {
  /** Whether the current user may perform this action. */
  allowed: boolean;
  /**
   * Why the action is unavailable. Shown in a tooltip on the disabled control —
   * a greyed-out button with no explanation reads as a bug.
   */
  reason?: string | null;
  /** Show a padlock alongside the label when blocked. */
  showLockIcon?: boolean;
}

/**
 * A button that disables itself when the user lacks permission and says why.
 *
 * This is presentation only. The API re-checks the same permission on the
 * request, so hiding or disabling a control is a courtesy, never the boundary.
 */
export function PermissionButton({
  allowed,
  reason,
  showLockIcon = true,
  disabled,
  children,
  className,
  ...props
}: PermissionButtonProps) {
  const blocked = !allowed;
  const isDisabled = disabled || blocked;

  const button = (
    <Button
      {...props}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={cn(blocked && "cursor-not-allowed", className)}
    >
      {blocked && showLockIcon ? (
        <Lock className="mr-2 h-3.5 w-3.5 shrink-0 opacity-70" />
      ) : null}
      {children}
    </Button>
  );

  if (!blocked || !reason) return button;

  return (
    <Tooltip>
      {/* A disabled button emits no pointer events, so the trigger needs a
          wrapper element to catch hover for the tooltip. */}
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0}>
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

export interface PermissionGateProps {
  allowed: boolean;
  children: React.ReactNode;
  /** Rendered instead of the children when not allowed. Defaults to nothing. */
  fallback?: React.ReactNode;
}

/** Render children only when the user holds the permission. */
export function PermissionGate({
  allowed,
  children,
  fallback = null,
}: PermissionGateProps) {
  return <>{allowed ? children : fallback}</>;
}
