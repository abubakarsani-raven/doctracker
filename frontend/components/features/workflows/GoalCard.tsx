"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  Clock, 
  User, 
  Building2, 
  Users, 
  Calendar, 
  Trash2,
  Target,
  AlertCircle
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { useAchieveWorkflowGoal, useDeleteWorkflowGoal } from "@/lib/hooks/use-goals";
import { useCurrentUser } from "@/lib/hooks/use-users";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface GoalCardProps {
  goal: any;
  workflowId: string;
  onGoalUpdated?: () => void;
}

export function GoalCard({ goal, workflowId, onGoalUpdated }: GoalCardProps) {
  const { data: currentUser } = useCurrentUser();
  const achieveGoal = useAchieveWorkflowGoal();
  const deleteGoal = useDeleteWorkflowGoal();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isAchieved = goal.status === "achieved";
  const isAssignedToMe =
    goal.assignedToType === "all_participants" ||
    (goal.assignedToType === "user" && goal.assignedToId === currentUser?.id) ||
    (goal.assignedToType === "department" &&
      currentUser?.department &&
      (goal.assignedToId === currentUser.department ||
        goal.assignedToName === currentUser.department));

  const canAchieve = !isAchieved && isAssignedToMe;
  const canDelete = goal.createdBy === currentUser?.id || currentUser?.role === "Master";

  // Check if due date is overdue
  const dueDate = goal.dueDate ? new Date(goal.dueDate) : null;
  const isOverdue = dueDate && !isAchieved && isPast(dueDate) && !isToday(dueDate);

  const handleAchieve = async () => {
    try {
      await achieveGoal.mutateAsync({ goalId: goal.id });
      onGoalUpdated?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGoal.mutateAsync(goal.id);
      onGoalUpdated?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getStatusConfig = () => {
    if (isAchieved) {
      return {
        variant: "default" as const,
        className: "bg-green-600 hover:bg-green-700 text-white",
        icon: CheckCircle2,
        label: "Achieved",
      };
    }
    if (goal.status === "in_progress") {
      return {
        variant: "secondary" as const,
        className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
        icon: Clock,
        label: "In Progress",
      };
    }
    return {
      variant: "outline" as const,
      className: isOverdue 
        ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" 
        : "border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
      icon: Target,
      label: "Pending",
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Card 
      className={`
        relative overflow-hidden transition-all duration-200
        ${isAchieved ? "opacity-75 border-green-200 dark:border-green-800" : ""}
        ${isOverdue ? "border-l-4 border-l-orange-500" : ""}
        hover:shadow-md
      `}
    >
      {/* Status indicator bar */}
      <div 
        className={`
          absolute top-0 left-0 right-0 h-1
          ${isAchieved ? "bg-green-600" : goal.status === "in_progress" ? "bg-blue-500" : "bg-gray-300"}
        `}
      />

      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with title and status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-start gap-2">
                <div className={`
                  mt-0.5 p-1.5 rounded-md
                  ${isAchieved 
                    ? "bg-green-100 dark:bg-green-900/30" 
                    : goal.status === "in_progress"
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-gray-100 dark:bg-gray-800"
                  }
                `}>
                  <StatusIcon 
                    className={`
                      h-3.5 w-3.5
                      ${isAchieved 
                        ? "text-green-700 dark:text-green-400" 
                        : goal.status === "in_progress"
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400"
                      }
                    `}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm leading-tight mb-1">
                    {goal.title}
                  </h3>
                  {goal.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {goal.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-1.5 shrink-0">
              <Badge className={`${statusConfig.className} text-xs`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  disabled={deleteGoal.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-1 gap-2 pt-1">
            {/* Assigned To */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                {goal.assignedToType === "all_participants" ? (
                  <Users className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                ) : goal.assignedToType === "user" ? (
                  <User className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-orange-600" />
                )}
                <span className="font-medium text-foreground">Assigned:</span>
                <span className="truncate">
                  {goal.assignedToType === "all_participants" 
                    ? "All Participants" 
                    : goal.assignedToName || "Unassigned"}
                </span>
              </div>
            </div>

            {/* Due Date */}
            {dueDate && (
              <div className="flex items-center gap-2 text-xs">
                <div className={`flex items-center gap-1.5 ${isOverdue ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
                  <Calendar className={`h-3.5 w-3.5 shrink-0 ${isOverdue ? "text-orange-600" : ""}`} />
                  <span className="font-medium text-foreground">Due:</span>
                  <span className={isOverdue ? "font-semibold text-orange-600 dark:text-orange-400" : ""}>
                    {format(dueDate, "MMM d, yyyy")}
                    {isOverdue && !isAchieved && (
                      <AlertCircle className="h-3 w-3 ml-1 inline" />
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Achievement info */}
          {isAchieved && goal.achievedAt && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <span className="text-muted-foreground">
                  Achieved on <span className="font-medium text-foreground">{format(new Date(goal.achievedAt), "MMM d, yyyy")}</span>
                  {goal.achievedBy && (
                    <span className="text-muted-foreground"> by {goal.achievedBy}</span>
                  )}
                </span>
              </div>
            </>
          )}

          {/* Achievement notes */}
          {isAchieved && goal.achievementNotes && (
            <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-xs text-green-900 dark:text-green-200">
                {goal.achievementNotes}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {canAchieve && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center justify-end pt-0.5">
                <Button
                  size="sm"
                  onClick={handleAchieve}
                  disabled={achieveGoal.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {achieveGoal.isPending ? "Marking..." : "Mark as Achieved"}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>

      {/* Delete confirmation dialog */}
      {canDelete && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Goal</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this goal? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  handleDelete();
                  setDeleteDialogOpen(false);
                }}
                disabled={deleteGoal.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
