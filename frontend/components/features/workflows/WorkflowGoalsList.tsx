"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Target } from "lucide-react";
import { useWorkflowGoals } from "@/lib/hooks/use-goals";
import { GoalCard } from "./GoalCard";
import { CreateGoalDialog } from "./CreateGoalDialog";
import { useState } from "react";
import { useWorkflow } from "@/lib/hooks/use-workflows";
import { LoadingState } from "@/components/common/LoadingState";

interface WorkflowGoalsListProps {
  workflowId: string;
  createGoalDialogOpen?: boolean;
  onOpenCreateGoalDialog?: () => void;
}

export function WorkflowGoalsList({ 
  workflowId, 
  createGoalDialogOpen: externalDialogOpen,
  onOpenCreateGoalDialog: onOpenExternalDialog
}: WorkflowGoalsListProps) {
  const { data: goals = [], isLoading } = useWorkflowGoals(workflowId);
  const { data: workflow } = useWorkflow(workflowId);
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);
  
  // Use external dialog state if provided, otherwise use internal
  const isUsingExternalDialog = externalDialogOpen !== undefined;
  const createGoalDialogOpen = isUsingExternalDialog ? externalDialogOpen : internalDialogOpen;
  const handleOpenDialog = () => {
    if (isUsingExternalDialog && onOpenExternalDialog) {
      onOpenExternalDialog();
    } else {
      setInternalDialogOpen(true);
    }
  };

  // Only show goals section if workflow is ready_for_review or completed
  const canCreateGoals =
    workflow?.status === "ready_for_review" || workflow?.status === "completed";

  if (!canCreateGoals) {
    return null;
  }

  const pendingGoals = goals.filter((g: any) => g.status === "pending");
  const inProgressGoals = goals.filter((g: any) => g.status === "in_progress");
  const achievedGoals = goals.filter((g: any) => g.status === "achieved");

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>Post-Workflow Goals</CardTitle>
            </div>
            <Button
              size="sm"
              onClick={handleOpenDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Goal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState type="card" />
          ) : goals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No goals created yet</p>
              <p className="text-sm mt-2">
                Create goals to track follow-up tasks after workflow completion
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingGoals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1 w-1 rounded-full bg-gray-400" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Pending <span className="text-muted-foreground font-normal">({pendingGoals.length})</span>
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {pendingGoals.map((goal: any) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        workflowId={workflowId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inProgressGoals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                    <h4 className="text-sm font-semibold text-foreground">
                      In Progress <span className="text-muted-foreground font-normal">({inProgressGoals.length})</span>
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {inProgressGoals.map((goal: any) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        workflowId={workflowId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {achievedGoals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1 w-1 rounded-full bg-green-600" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Achieved <span className="text-muted-foreground font-normal">({achievedGoals.length})</span>
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {achievedGoals.map((goal: any) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        workflowId={workflowId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!isUsingExternalDialog && (
        <CreateGoalDialog
          open={createGoalDialogOpen}
          onOpenChange={setInternalDialogOpen}
          workflowId={workflowId}
          onGoalCreated={() => {
            setInternalDialogOpen(false);
          }}
        />
      )}
    </>
  );
}
