"use client";

import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyBadgeProps {
  companyName: string;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default";
  className?: string;
}

export function CompanyBadge({
  companyName,
  variant = "outline",
  size = "default",
  className,
}: CompanyBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn(
        "flex items-center gap-1",
        size === "sm" && "text-xs px-1.5 py-0.5",
        className
      )}
    >
      <Building2 className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />
      <span>{companyName}</span>
    </Badge>
  );
}
