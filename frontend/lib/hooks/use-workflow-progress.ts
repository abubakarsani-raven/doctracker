import { useQueryClient } from "@tanstack/react-query";
import { useUpdateWorkflow } from "./use-workflows";
import { api } from "@/lib/api";
import {
  calculateProgressFromActions,
  calculateWorkflowStatus,
} from "@/lib/workflow-utils";

/**
 * Hook to update workflow progress based on actions
 */
export function useUpdateWorkflowProgress() {
  const queryClient = useQueryClient();
  const updateWorkflow = useUpdateWorkflow();

  const updateProgress = async (workflowId: string) => {
    try {
      // Fetch fresh actions data from API to avoid stale cache issues
      const allActions = await api.getActions();
      const actions = allActions.filter((a: any) => a.workflowId === workflowId);

      // Calculate progress from fresh data
      const progress = calculateProgressFromActions(actions);

      // Get current workflow (try cache first, then fetch if needed)
      let workflow = queryClient.getQueryData<any>(["workflows", workflowId]);
      if (!workflow) {
        workflow = await api.getWorkflow(workflowId);
      }

      if (!workflow) {
        console.warn(`Workflow ${workflowId} not found`);
        return;
      }

      // Determine new status using utility function
      const newStatus = calculateWorkflowStatus(
        workflow.status,
        progress,
        actions
      );

      // Only update if status or progress changed
      if (newStatus !== workflow.status || progress !== workflow.progress) {
        await updateWorkflow.mutateAsync({
          id: workflowId,
          data: {
            progress,
            status: newStatus,
          },
        });
      }
    } catch (error) {
      console.error("Failed to update workflow progress:", error);
      // Don't throw - let the UI continue to work even if progress update fails
    }
  };

  return { updateProgress };
}
