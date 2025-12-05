import Link from "next/link";
import { CheckSquare, MoreVertical, Clock, User, Building2, Upload, MessageSquare, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompanyBadge } from "@/components/features/workflows/CompanyBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export interface ActionData {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "document_uploaded" | "response_received";
  type?: "regular" | "document_upload" | "request_response";
  assignedTo?: string | { type: string; id: string; name: string };
  assignedToType?: "user" | "department" | "division";
  documentId?: string;
  documentName?: string;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  workflowId?: string;
  // Cross-company fields
  isCrossCompany?: boolean;
  sourceCompanyName?: string;
  targetCompanyName?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
}

interface ActionCardProps {
  action: ActionData;
  onView?: (id: string) => void;
  onComplete?: (id: string) => void;
  className?: string;
}

export function ActionCard({
  action,
  onView,
  onComplete,
  className,
}: ActionCardProps) {
  const isCompleted = action.status === "completed";
  const isOverdue = action.dueDate && !isCompleted && new Date(action.dueDate) < new Date();
  
  // Get assigned to name
  const assignedToName = typeof action.assignedTo === "object" 
    ? action.assignedTo.name 
    : action.assignedTo;
  
  // Get assigned to type
  const assignedToType = typeof action.assignedTo === "object"
    ? action.assignedTo.type
    : action.assignedToType;

  const getActionTypeIcon = () => {
    switch (action.type) {
      case "document_upload":
        return <Upload className="h-4 w-4" />;
      case "request_response":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <CheckSquare className="h-5 w-5 text-green-500 shrink-0" />;
    }
  };

  const getActionTypeLabel = () => {
    switch (action.type) {
      case "document_upload":
        return "Upload Document";
      case "request_response":
        return "Request/Response";
      default:
        return "Regular";
    }
  };

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link
            href={`/actions/${action.id}`}
            className="flex-1 min-w-0 group"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-green-500 shrink-0" />
              <h3 className="font-semibold text-sm group-hover:text-primary">
                {action.title}
              </h3>
            </div>
            {action.description && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {action.description}
              </p>
            )}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(action.id)}>
                View
              </DropdownMenuItem>
              {!isCompleted && onComplete && (
                <DropdownMenuItem onClick={() => onComplete(action.id)}>
                  Mark Complete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center justify-between">
          <StatusBadge status={action.status as any} />
          {action.dueDate && (
            <div className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={cn(isOverdue && "text-destructive font-medium")}>
                {isOverdue
                  ? "Overdue"
                  : isCompleted
                  ? "Completed"
                  : `Due ${formatDistanceToNow(action.dueDate, { addSuffix: true })}`}
              </span>
            </div>
          )}
        </div>
        {assignedToName && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {assignedToType === "user" ? (
              <User className="h-3 w-3" />
            ) : (
              <Building2 className="h-3 w-3" />
            )}
            <span>Assigned to: {assignedToName}</span>
          </div>
        )}
        {/* Cross-company indicators */}
        {(action.isCrossCompany || action.sourceCompanyName || action.targetCompanyName) && (
          <div className="flex items-center gap-2 flex-wrap">
            {action.sourceCompanyName && (
              <CompanyBadge companyName={action.sourceCompanyName} size="sm" />
            )}
            {action.targetCompanyName && action.sourceCompanyName && (
              <span className="text-xs text-muted-foreground">→</span>
            )}
            {action.targetCompanyName && (
              <CompanyBadge companyName={action.targetCompanyName} size="sm" />
            )}
            {action.isCrossCompany && (
              <Badge variant="outline" className="text-xs">
                Cross-Company
              </Badge>
            )}
          </div>
        )}
        {/* Approval status */}
        {action.approvalStatus === "pending" && (
          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
            Pending Approval
          </Badge>
        )}
        {action.workflowId && (
          <Link
            href={`/workflows/${action.workflowId}`}
            className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Workflow className="h-3 w-3" />
            <span>View Workflow</span>
          </Link>
        )}
        {action.documentName && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span>📄</span>
            <span className="truncate">{action.documentName}</span>
            {action.documentId && action.documentId.trim() !== "" && (
              <span className="text-xs text-muted-foreground">(Linked)</span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(action.createdAt, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
