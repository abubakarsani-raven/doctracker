import Link from "next/link";
import { FileText, MoreVertical, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompanyBadge } from "@/components/features/workflows/CompanyBadge";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export interface WorkflowData {
  id: string;
  documentName: string;
  documentId: string;
  status: "assigned" | "in_progress" | "ready_for_review" | "completed" | "pending";
  assignedTo?: string;
  assignedToType?: "user" | "department" | "division";
  progress?: number;
  startedAt: Date;
  dueDate?: Date;
  // Cross-company fields
  isCrossCompany?: boolean;
  sourceCompanyName?: string;
  targetCompanyName?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
}

interface WorkflowCardProps {
  workflow: WorkflowData;
  onView?: (id: string) => void;
  onAssign?: (id: string) => void;
  onComplete?: (id: string) => void;
  className?: string;
}

function assignedToLabel(assignedTo?: string | { name?: string }) {
  if (!assignedTo) return null;
  if (typeof assignedTo === "string") return assignedTo;
  return assignedTo.name?.trim() || "Unassigned";
}

export function WorkflowCard({
  workflow,
  onView,
  onAssign,
  onComplete,
  className,
}: WorkflowCardProps) {
  const isOverdue = workflow.dueDate && new Date(workflow.dueDate) < new Date();
  const assignee = assignedToLabel(workflow.assignedTo);
  const showCompanyPath =
    workflow.isCrossCompany ||
    (workflow.sourceCompanyName &&
      workflow.targetCompanyName &&
      workflow.sourceCompanyName !== workflow.targetCompanyName);
  const progress = workflow.progress ?? 0;

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <Link
            href={`/workflows/${workflow.id}`}
            className="flex min-w-0 flex-1 items-start gap-3 group"
          >
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3 className="text-sm font-semibold leading-snug group-hover:text-primary">
                {workflow.documentName}
              </h3>
              {assignee && (
                <p className="text-xs text-muted-foreground">
                  Assigned to {assignee}
                </p>
              )}
              {showCompanyPath && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {workflow.sourceCompanyName && (
                    <CompanyBadge companyName={workflow.sourceCompanyName} size="sm" />
                  )}
                  {workflow.targetCompanyName && workflow.sourceCompanyName && (
                    <span className="text-xs text-muted-foreground">→</span>
                  )}
                  {workflow.targetCompanyName && (
                    <CompanyBadge companyName={workflow.targetCompanyName} size="sm" />
                  )}
                  {workflow.isCrossCompany && (
                    <Badge variant="outline" className="text-xs">
                      Cross-Company
                    </Badge>
                  )}
                </div>
              )}
              {workflow.approvalStatus === "pending" && (
                <Badge
                  variant="outline"
                  className="text-xs text-yellow-600 border-yellow-600"
                >
                  Pending Approval
                </Badge>
              )}
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(workflow.id)}>
                View
              </DropdownMenuItem>
              {onAssign && (
                <DropdownMenuItem onClick={() => onAssign(workflow.id)}>
                  Assign
                </DropdownMenuItem>
              )}
              {onComplete && (
                <DropdownMenuItem onClick={() => onComplete(workflow.id)}>
                  Close
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <StatusBadge status={workflow.status} />
          {workflow.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                isOverdue && "text-destructive",
              )}
            >
              <Clock className="h-3 w-3" />
              {isOverdue
                ? "Past end point"
                : `Ends ${formatDistanceToNow(workflow.dueDate, { addSuffix: true })}`}
            </span>
          )}
          <span>
            Started {formatDistanceToNow(workflow.startedAt, { addSuffix: true })}
          </span>
        </div>
        {workflow.progress !== undefined && (
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1.5 min-w-0 flex-1" />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
