"use client";

import { ReactNode } from "react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Prefer for multiple CTAs (Retry + Go back). */
  footer?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  footer,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="text-center">
        {Icon && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {(action || footer) && (
        <CardFooter className="justify-center">
          {footer ??
            (action ? (
              <Button onClick={action.onClick}>{action.label}</Button>
            ) : null)}
        </CardFooter>
      )}
    </Card>
  );
}
