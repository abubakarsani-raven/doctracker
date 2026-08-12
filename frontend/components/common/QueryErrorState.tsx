"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

function messageFromError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  const anyErr = error as { message?: string };
  return anyErr?.message;
}

/**
 * Distinct from EmptyState: use when a query failed, not when there is simply no data.
 */
export function QueryErrorState({
  title = "Something went wrong",
  description,
  error,
  onRetry,
  onBack,
  backLabel = "Go back",
  className,
}: QueryErrorStateProps) {
  const detail =
    description ||
    messageFromError(error) ||
    "We couldn’t load this. Check your connection and try again.";

  return (
    <EmptyState
      className={className}
      icon={AlertTriangle}
      title={title}
      description={detail}
      footer={
        onRetry || onBack ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onRetry ? (
              <Button type="button" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            {onBack ? (
              <Button type="button" variant="outline" onClick={onBack}>
                {backLabel}
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    />
  );
}
