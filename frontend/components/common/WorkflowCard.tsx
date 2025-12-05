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

export function WorkflowCard({
  workflow,
  onView,
  onAssign,
  onComplete,
  className,
}: WorkflowCardProps) {
  const isOverdue = workflow.dueDate && new Date(workflow.dueDate) < new Date();

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link
            href={`/workflows/${workflow.id}`}
            className="flex items-center gap-3 flex-1 min-w-0 group"
          >
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate group-hover:text-primary">
                {workflow.documentName}
              </h3>
              {workflow.assignedTo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Assigned to: {typeof workflow.assignedTo === "string" ? workflow.assignedTo : ((workflow.assignedTo as any).name?.trim() || "Unassigned")}
                </p>
              )}
              {/* Cross-company indicators */}
              {(workflow.isCrossCompany || workflow.sourceCompanyName || workflow.targetCompanyName) && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
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
              {/* Approval status */}
              {workflow.approvalStatus === "pending" && (
                <Badge variant="outline" className="text-xs mt-1 text-yellow-600 border-yellow-600">
                  Pending Approval
                </Badge>
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
                  Complete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center justify-between">
          <StatusBadge
            status={
              workflow.status === "ready_for_review"
                ? "pending"
                : workflow.status === "completed"
                ? "completed"
                : workflow.status === "in_progress"
                ? "in_progress"
                : "pending"
            }
          />
          {workflow.dueDate && (
            <div className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={cn(isOverdue && "text-destructive")}>
                {isOverdue ? "Overdue" : formatDistanceToNow(workflow.dueDate, { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
        {workflow.progress !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{workflow.progress}%</span>
            </div>
            <Progress value={workflow.progress} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Started {formatDistanceToNow(workflow.startedAt, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
