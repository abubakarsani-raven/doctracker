"use client";

import { seesAllCompanies } from "@/lib/permissions";
import { useState, useMemo } from "react";
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
import { StatusBadge, LoadingState, EmptyState, PresenceIndicator, QueryErrorState } from "@/components/common";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { WorkflowRoutingSheet } from "@/components/features/workflows/WorkflowRoutingSheet";
import { AddFileToWorkflowDialog } from "@/components/features/workflows/AddFileToWorkflowDialog";
import { CreateActionFromWorkflowDialog } from "@/components/features/workflows/CreateActionFromWorkflowDialog";
import { WorkflowActionsList } from "@/components/features/workflows/WorkflowActionsList";
import { SetWorkflowEndPointDialog } from "@/components/features/workflows/SetWorkflowEndPointDialog";
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
  Target,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { WorkflowTimeline } from "@/components/features/workflows/WorkflowTimeline";
import { WorkflowFiles } from "@/components/features/workflows/WorkflowFiles";
import { ActionResults } from "@/components/features/workflows/ActionResults";
import { WorkflowGoalsList } from "@/components/features/workflows/WorkflowGoalsList";
import { CreateGoalDialog } from "@/components/features/workflows/CreateGoalDialog";
import { WorkflowCompletionDialog } from "@/components/features/workflows/WorkflowCompletionDialog";
import { useWorkflow } from "@/lib/hooks/use-workflows";
import { useActionsByWorkflow } from "@/lib/hooks/use-actions";
import { useUsers, useCurrentUser } from "@/lib/hooks/use-users";
import { calculateProgressFromActions, canCloseWorkflow } from "@/lib/workflow-utils";
import { usePermissions } from "@/lib/hooks/use-permissions";
import Link from "next/link";
import { CompanyBadge } from "@/components/features/workflows/CompanyBadge";

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const { data: workflow, isLoading, isError, error, refetch } = useWorkflow(workflowId);
  const { data: actions = [] } = useActionsByWorkflow(workflowId);
  const { data: users = [] } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const { can } = usePermissions();
  const canAssignActions = can("actions.assign");
  const canEditWorkflow = can("workflows.edit");
  const canCreateGoals = can("workflows.create");

  // Helper to get creator name with fallback — never show a raw user id.
  const creatorName = useMemo(() => {
    if (!workflow) return null;

    if (workflow.assignedByName) return workflow.assignedByName;
    if (workflow.creatorName) return workflow.creatorName;
    if (workflow.creator?.name) return workflow.creator.name;
    if (workflow.creator?.email) return workflow.creator.email;

    if (workflow.assignedBy) {
      const user = users.find((u: any) => u.id === workflow.assignedBy);
      if (user) return user.name || user.email || null;
    }

    return null;
  }, [workflow, users]);

  const [routingSheetOpen, setRoutingSheetOpen] = useState(false);
  const [addFileDialogOpen, setAddFileDialogOpen] = useState(false);
  const [createActionDialogOpen, setCreateActionDialogOpen] = useState(false);
  const [createGoalDialogOpen, setCreateGoalDialogOpen] = useState(false);
  const [completeWorkflowDialogOpen, setCompleteWorkflowDialogOpen] = useState(false);
  const [endPointDialogOpen, setEndPointDialogOpen] = useState(false);

  // Calculate progress from actions
  const progress = useMemo(() => {
    return workflow ? calculateProgressFromActions(actions) : 0;
  }, [workflow, actions]);

  // Merge progress into workflow data for display
  const workflowWithProgress = useMemo(() => {
    return workflow ? { ...workflow, progress, actions } : null;
  }, [workflow, progress, actions]);

  const canCompleteWorkflow = useMemo(() => {
    return canEditWorkflow && canCloseWorkflow(workflow, currentUser);
  }, [canEditWorkflow, currentUser, workflow]);

  const canSetEndPoint = useMemo(() => {
    if (!currentUser || !workflow) return false;
    if (workflow.canSetEndPoint === true) return true;
    if (seesAllCompanies(currentUser)) return true;

    const isCreator =
      workflow.creator?.id === currentUser.id ||
      workflow.assignedBy === currentUser.id;
    if (isCreator) return true;

    const role =
      currentUser.role ||
      currentUser.permissions?.role ||
      "";
    const sameCompany =
      !!currentUser.companyId &&
      currentUser.companyId === workflow.companyId;

    return (
      sameCompany &&
      (role === "Company Secretary" || role === "Department Head")
    );
  }, [currentUser, workflow]);

  if (isLoading) {
    return <LoadingState type="card" />;
  }

  if (isError) {
    return (
      <QueryErrorState
        title="Failed to load workflow"
        error={error}
        onRetry={() => refetch()}
        onBack={() => router.back()}
      />
    );
  }

  if (!workflowWithProgress) {
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

  const isOverdue =
    workflowWithProgress.dueDate &&
    new Date(workflowWithProgress.dueDate) < new Date();
  const workflowTitle =
    workflowWithProgress.folderName ||
    workflowWithProgress.documentName ||
    workflowWithProgress.title ||
    "Untitled Workflow";
  const isFolderBased =
    workflowWithProgress.type === "folder" ||
    workflowWithProgress.folderId;

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight">{workflowTitle}</h1>
              {workflowWithProgress.type && (
                <Badge variant="outline" className="shrink-0">
                  {workflowWithProgress.type === "folder" ? (
                    <>
                      <Folder className="h-3 w-3 mr-1" />
                      Folder
                    </>
                  ) : (
                    <>
                      <FileText className="h-3 w-3 mr-1" />
                      Document
                    </>
                  )}
                </Badge>
              )}
            </div>
            {workflowWithProgress.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {workflowWithProgress.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={workflowWithProgress.status} />
              <PresenceIndicator resourceType="workflow" resourceId={workflowId} />
              {workflowWithProgress.dueDate && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className={isOverdue ? "text-destructive" : ""}>
                    {isOverdue
                      ? "Past end point"
                      : `Ends ${formatDistanceToNow(
                          new Date(workflowWithProgress.dueDate),
                          { addSuffix: true }
                        )}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center"
          role="group"
          aria-label="Workflow actions"
        >
          {canEditWorkflow && (
            <Button
              className="w-full sm:w-auto"
              onClick={() => setRoutingSheetOpen(true)}
            >
              <Send className="h-4 w-4" />
              Route
            </Button>
          )}
          {canCompleteWorkflow && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setCompleteWorkflowDialogOpen(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Close
            </Button>
          )}
          {canSetEndPoint && workflowWithProgress?.status !== "completed" && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setEndPointDialogOpen(true)}
            >
              <CalendarClock className="h-4 w-4" />
              {workflowWithProgress.dueDate ? "End point" : "Set end point"}
            </Button>
          )}
        </div>
      </div>

      {workflowWithProgress.status === "completed" && (
        <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div className="min-w-0">
            <p className="font-medium">This workflow is closed</p>
            <p className="text-sm text-muted-foreground">
              {workflowWithProgress.completedAt
                ? `Closed ${formatDistanceToNow(new Date(workflowWithProgress.completedAt), { addSuffix: true })}.`
                : "Work on this workflow is finished."}
              {workflowWithProgress.filedAt
                ? " Documents have been filed."
                : " Use Route to file the documents if you need to archive the case."}
            </p>
          </div>
        </div>
      )}

      {/* Folder/Document Context */}
      {isFolderBased && workflowWithProgress.folderId && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Folder</p>
                <Link
                  href={`/documents/folder/${workflowWithProgress.folderId}`}
                  className="text-sm text-primary hover:underline"
                >
                  {workflowWithProgress.folderPath ||
                    workflowWithProgress.folderName ||
                    "View Folder"}
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
            onCreateAction={
              canAssignActions && workflowWithProgress?.status !== "completed"
                ? () => setCreateActionDialogOpen(true)
                : undefined
            }
          />

          {/* Action Results */}
          <ActionResults workflowId={workflowId} />

          {/* Files Added */}
          <WorkflowFiles
            workflowId={workflowId}
            workflowTitle={workflowWithProgress.title}
          />

          {/* Post-Workflow Goals */}
          <WorkflowGoalsList 
            workflowId={workflowId}
            createGoalDialogOpen={createGoalDialogOpen}
            onOpenCreateGoalDialog={() => setCreateGoalDialogOpen(true)}
          />
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
                  {workflowWithProgress.assignedTo &&
                  typeof workflowWithProgress.assignedTo === "object" ? (
                    <>
                      {workflowWithProgress.assignedTo.type === "user" ? (
                        <User className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">
                        {workflowWithProgress.assignedTo.name?.trim() ||
                          "Unassigned"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {workflowWithProgress.assignedTo || "Unassigned"}
                      </span>
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
                  <Progress value={progress} />
                  <p className="text-sm">{progress}% complete</p>
                </div>
              </div>
              <Separator />
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    End point
                  </p>
                  {canSetEndPoint &&
                    workflowWithProgress.status !== "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEndPointDialogOpen(true)}
                      >
                        {workflowWithProgress.dueDate ? "Change" : "Set"}
                      </Button>
                    )}
                </div>
                {workflowWithProgress.dueDate ? (
                  <p
                    className={`text-sm ${
                      isOverdue ? "text-destructive font-medium" : ""
                    }`}
                  >
                    {format(
                      new Date(workflowWithProgress.dueDate),
                      "PPp",
                    )}
                    {isOverdue ? " (past)" : ""}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Started
                </p>
                <p className="text-sm">
                  {workflowWithProgress.assignedAt
                    ? formatDistanceToNow(
                        new Date(workflowWithProgress.assignedAt),
                        { addSuffix: true }
                      )
                    : "Recently"}
                </p>
              </div>
              {workflowWithProgress.status === "completed" && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Closed
                    </p>
                    <p className="text-sm">
                      {workflowWithProgress.completedAt
                        ? format(
                            new Date(workflowWithProgress.completedAt),
                            "PPp",
                          )
                        : "Yes"}
                    </p>
                  </div>
                </>
              )}
              {creatorName && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Created By
                    </p>
                    <p className="text-sm">{creatorName}</p>
                  </div>
                </>
              )}
              {/* Cross-company information */}
              {(workflowWithProgress.isCrossCompany ||
                workflowWithProgress.sourceCompanyName ||
                workflowWithProgress.targetCompanyName) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Company Information
                    </p>
                    <div className="space-y-2">
                      {workflowWithProgress.sourceCompanyName && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            From:
                          </span>
                          <CompanyBadge
                            companyName={workflowWithProgress.sourceCompanyName}
                            size="sm"
                          />
                        </div>
                      )}
                      {workflowWithProgress.targetCompanyName && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            To:
                          </span>
                          <CompanyBadge
                            companyName={workflowWithProgress.targetCompanyName}
                            size="sm"
                          />
                        </div>
                      )}
                      {workflowWithProgress.approvalStatus === "pending" && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Pending Approval:</strong> This workflow is
                            waiting for approval from the target company.
                          </p>
                        </div>
                      )}
                      {workflowWithProgress.approvalStatus === "approved" && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-800 dark:text-green-200">
                            <strong>Approved:</strong> Cross-company workflow
                            has been approved.
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
              {isFolderBased && workflowWithProgress.folderId && (
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  asChild
                >
                  <Link href={`/documents/folder/${workflowWithProgress.folderId}`}>
                    <Folder className="mr-2 h-4 w-4" />
                    View Folder
                  </Link>
                </Button>
              )}
              {workflowWithProgress.documentId && (
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  asChild
                >
                  <Link href={`/documents/${workflowWithProgress.documentId}`}>
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
              {canAssignActions && workflowWithProgress.status !== "completed" && (
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() => setCreateActionDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Action
                </Button>
              )}
              {canCreateGoals &&
                (workflowWithProgress.status === "ready_for_review" ||
                  workflowWithProgress.status === "completed") && (
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() => setCreateGoalDialogOpen(true)}
                >
                  <Target className="mr-2 h-4 w-4" />
                  Create Goal
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Routing Sheet */}
      <WorkflowRoutingSheet
        open={routingSheetOpen}
        onOpenChange={setRoutingSheetOpen}
        workflowId={workflowId}
        onRequestCreateAction={
          canAssignActions ? () => setCreateActionDialogOpen(true) : undefined
        }
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
        workflow={workflowWithProgress}
      />

      {/* Create Goal Dialog */}
      <CreateGoalDialog
        open={createGoalDialogOpen}
        onOpenChange={setCreateGoalDialogOpen}
        workflowId={workflowId}
        onGoalCreated={() => {
          setCreateGoalDialogOpen(false);
        }}
      />

      {/* Complete Workflow Dialog */}
      <WorkflowCompletionDialog
        open={completeWorkflowDialogOpen}
        onOpenChange={setCompleteWorkflowDialogOpen}
        workflowId={workflowId}
        workflow={workflowWithProgress}
        onWorkflowCompleted={() => {
          setCompleteWorkflowDialogOpen(false);
        }}
      />

      <SetWorkflowEndPointDialog
        open={endPointDialogOpen}
        onOpenChange={setEndPointDialogOpen}
        workflowId={workflowId}
        currentEndPoint={workflowWithProgress.dueDate}
      />
    </div>
  );
}
