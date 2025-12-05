import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { VariantProps } from "class-variance-authority";

export type StatusType =
  | "pending"
  | "in_progress"
  | "completed"
  | "approved"
  | "rejected"
  | "draft"
  | "archived";

type BadgeProps = VariantProps<typeof badgeVariants>;

interface StatusBadgeProps extends Omit<React.ComponentProps<typeof Badge>, "variant"> {
  status: StatusType | string;
  className?: string;
}

const statusConfig: Record<
  StatusType | string,
  { label: string; variant: BadgeProps["variant"] }
> = {
  pending: { label: "Pending", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  document_uploaded: { label: "Document Uploaded", variant: "default" },
  response_received: { label: "Response Received", variant: "default" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  draft: { label: "Draft", variant: "outline" },
  archived: { label: "Archived", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  assigned: { label: "Assigned", variant: "default" },
  ready_for_review: { label: "Ready for Review", variant: "default" },
  filed: { label: "Filed", variant: "default" },
};

export function StatusBadge({
  status,
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "),
    variant: "secondary" as BadgeProps["variant"],
  };

  return (
    <Badge
      variant={config.variant}
      className={cn("capitalize", className)}
      {...props}
    >
      {config.label}
    </Badge>
  );
}
