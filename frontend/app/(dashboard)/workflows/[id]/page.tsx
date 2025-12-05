"use client";

import { useState, useEffect, useRef } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, LoadingState, EmptyState } from "@/components/common";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { WorkflowRoutingSheet } from "@/components/features/workflows/WorkflowRoutingSheet";
import { AddFileToWorkflowDialog } from "@/components/features/workflows/AddFileToWorkflowDialog";
import { CreateActionFromWorkflowDialog } from "@/components/features/workflows/CreateActionFromWorkflowDialog";
import { WorkflowActionsList } from "@/components/features/workflows/WorkflowActionsList";
import {
  ArrowLeft,
  Send,
  Plus,
  Clock,
  User,
  Building2,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { WorkflowTimeline } from "@/components/features/workflows/WorkflowTimeline";
import { WorkflowFiles } from "@/components/features/workflows/WorkflowFiles";
import { ActionResults } from "@/components/features/workflows/ActionResults";
import { api } from "@/lib/api";
import { updateWorkflowProgress, calculateWorkflowProgress } from "@/lib/workflow-utils";
import Link from "next/link";
import { CompanyBadge } from "@/components/features/workflows/CompanyBadge";

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [routingSheetOpen, setRoutingSheetOpen] = useState(false);
  const [addFileDialogOpen, setAddFileDialogOpen] = useState(false);
  const [createActionDialogOpen, setCreateActionDialogOpen] = useState(false);
  
  // Debounce timers to prevent rapid-fire API calls
  const workflowUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const actionUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadWorkflow();
    
    // Listen for workflow updates - just reload workflow (no progress update to avoid loop)
    const handleWorkflowUpdate = () => {
      // Debounce to prevent rapid-fire calls
      if (workflowUpdateTimerRef.current) {
        clearTimeout(workflowUpdateTimerRef.current);
      }
      workflowUpdateTimerRef.current = setTimeout(() => {
        loadWorkflow();
      }, 300);
    };
    
    // Listen for action updates to recalculate progress
    const handleActionUpdate = () => {
      // Debounce to prevent rapid-fire calls
      if (actionUpdateTimerRef.current) {
        clearTimeout(actionUpdateTimerRef.current);
      }
      actionUpdateTimerRef.current = setTimeout(async () => {
        // Update progress but skip event dispatch to prevent circular loop
        await updateWorkflowProgress(workflowId, true);
        // Then reload workflow to reflect changes
        loadWorkflow();
      }, 300);
    };
    
    window.addEventListener("workflowsUpdated", handleWorkflowUpdate);
    window.addEventListener("actionsUpdated", handleActionUpdate);
    
    return () => {
      // Cleanup timers
      if (workflowUpdateTimerRef.current) {
        clearTimeout(workflowUpdateTimerRef.current);
      }
      if (actionUpdateTimerRef.current) {
        clearTimeout(actionUpdateTimerRef.current);
      }
      window.removeEventListener("workflowsUpdated", handleWorkflowUpdate);
      window.removeEventListener("actionsUpdated", handleActionUpdate);
    };
  }, [workflowId]);

  const loadWorkflow = async () => {
    setLoading(true);
    try {
      const workflowsData = await api.getWorkflows();
      const localWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]");
      
      // Merge and find workflow
      const allWorkflows = [...workflowsData, ...localWorkflows];
      const foundWorkflow = allWorkflows.find((w: any) => w.id === workflowId);
      
      if (foundWorkflow) {
        // Calculate and update progress
        const progress = await calculateWorkflowProgress(workflowId);
        setWorkflow({
          ...foundWorkflow,
          progress: progress,
        });
      }
    } catch (error) {
      console.error("Failed to load workflow:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState type="card" />;
  }

  if (!workflow) {
    return (
      <EmptyState
        icon={FileText}
        title="Workflow not found"
        description="The workflow you're looking for doesn't exist or has been deleted."
        action={{
          label: "Go Back",
          onClick: () => router.push("/workflows"),
        }}
      />
    );
  }

  const isOverdue = workflow.dueDate && new Date(workflow.dueDate) < new Date();
  const workflowTitle = workflow.folderName || workflow.documentName || workflow.title || "Untitled Workflow";
  const isFolderBased = workflow.type === "folder" || workflow.folderId;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/workflows">Workflows</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{workflowTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{workflowTitle}</h1>
              {workflow.type && (
                <Badge variant="outline">
                  {workflow.type === "folder" ? (
                    <>
                      <Folder className="h-3 w-3 mr-1" />
                      Folder-Based
                    </>
                  ) : (
                    <>
                      <FileText className="h-3 w-3 mr-1" />
                      Document-Based
                    </>
                  )}
                </Badge>
              )}
            </div>
            {workflow.description && (
              <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
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
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className={isOverdue ? "text-destructive" : ""}>
                    {isOverdue
                      ? "Overdue"
                      : `Due ${formatDistanceToNow(new Date(workflow.dueDate), { addSuffix: true })}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setRoutingSheetOpen(true)}>
          <Send className="mr-2 h-4 w-4" />
          Route Workflow
        </Button>
      </div>

      {/* Folder/Document Context */}
      {isFolderBased && workflow.folderId && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Folder</p>
                <Link
                  href={`/documents/folder/${workflow.folderId}`}
                  className="text-sm text-primary hover:underline"
                >
                  {workflow.folderPath || workflow.folderName || "View Folder"}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Timeline */}
          <WorkflowTimeline workflowId={workflowId} />

          {/* Actions List */}
          <WorkflowActionsList
            workflowId={workflowId}
            onCreateAction={() => setCreateActionDialogOpen(true)}
          />

          {/* Action Results */}
          <ActionResults workflowId={workflowId} />

          {/* Files Added */}
          <WorkflowFiles workflowId={workflowId} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Assigned To
                </p>
                <div className="flex items-center gap-2">
                  {typeof workflow.assignedTo === "object" ? (
                    <>
                      {workflow.assignedTo.type === "user" ? (
                        <User className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">{workflow.assignedTo.name?.trim() || "Unassigned"}</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{workflow.assignedTo || "Unassigned"}</span>
                    </>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Progress
                </p>
                <div className="space-y-2">
                  <Progress value={workflow.progress || 0} />
                  <p className="text-sm">{workflow.progress || 0}% complete</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Started
                </p>
                <p className="text-sm">
                  {workflow.assignedAt
                    ? formatDistanceToNow(new Date(workflow.assignedAt), { addSuffix: true })
                    : "Recently"}
                </p>
              </div>
              {workflow.assignedBy && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Created By
                    </p>
                    <p className="text-sm">{workflow.assignedBy}</p>
                  </div>
                </>
              )}
              {/* Cross-company information */}
              {(workflow.isCrossCompany || workflow.sourceCompanyName || workflow.targetCompanyName) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Company Information
                    </p>
                    <div className="space-y-2">
                      {workflow.sourceCompanyName && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">From:</span>
                          <CompanyBadge companyName={workflow.sourceCompanyName} size="sm" />
                        </div>
                      )}
                      {workflow.targetCompanyName && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">To:</span>
                          <CompanyBadge companyName={workflow.targetCompanyName} size="sm" />
                        </div>
                      )}
                      {workflow.approvalStatus === "pending" && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Pending Approval:</strong> This workflow is waiting for approval from the target company.
                          </p>
                        </div>
                      )}
                      {workflow.approvalStatus === "approved" && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-800 dark:text-green-200">
                            <strong>Approved:</strong> Cross-company workflow has been approved.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isFolderBased && workflow.folderId && (
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  asChild
                >
                  <Link href={`/documents/folder/${workflow.folderId}`}>
                    <Folder className="mr-2 h-4 w-4" />
                    View Folder
                  </Link>
                </Button>
              )}
              {workflow.documentId && (
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  asChild
                >
                  <Link href={`/documents/${workflow.documentId}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    View Document
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => setAddFileDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add File
              </Button>
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => setCreateActionDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Action
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Routing Sheet */}
      <WorkflowRoutingSheet
        open={routingSheetOpen}
        onOpenChange={setRoutingSheetOpen}
        workflowId={workflowId}
      />

      {/* Add File Dialog */}
      <AddFileToWorkflowDialog
        open={addFileDialogOpen}
        onOpenChange={setAddFileDialogOpen}
        workflowId={workflowId}
      />

      {/* Create Action Dialog */}
      <CreateActionFromWorkflowDialog
        open={createActionDialogOpen}
        onOpenChange={setCreateActionDialogOpen}
        workflowId={workflowId}
        workflow={workflow}
        onActionCreated={loadWorkflow}
      />
    </div>
  );
}
