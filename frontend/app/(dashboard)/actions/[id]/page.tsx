"use client";

import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, LoadingState, EmptyState } from "@/components/common";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  User,
  Building2,
  FileText,
  Upload,
  MessageSquare,
  Workflow as WorkflowIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ActionCompletionDialog } from "@/components/features/workflows/ActionCompletionDialog";
import { DocumentUploadActionDialog } from "@/components/features/workflows/DocumentUploadActionDialog";
import { RequestResponseActionDialog } from "@/components/features/workflows/RequestResponseActionDialog";
import { useAction } from "@/lib/hooks/use-actions";
import { useWorkflow } from "@/lib/hooks/use-workflows";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { canRespondToAction, isAssignedToAction } from "@/lib/action-utils";
import { CompanyBadge } from "@/components/features/workflows/CompanyBadge";

export default function ActionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const actionId = params.id as string;

  const { data: action, isLoading } = useAction(actionId);
  const { data: currentUser } = useCurrentUser();
  const { data: workflow } = useWorkflow(action?.workflowId || "");

  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);

  const handleActionClick = () => {
    if (!action || !currentUser) return;

    const canRespond = canRespondToAction(action, workflow || null, currentUser);
    const isAssigned = isAssignedToAction(action, currentUser);

    if (!canRespond && !isAssigned) {
      return;
    }

    if (
      action.type === "document_upload" &&
      action.status === "pending" &&
      canRespond
    ) {
      setUploadDialogOpen(true);
    } else if (
      action.type === "document_upload" &&
      action.status === "document_uploaded" &&
      canRespond
    ) {
      setCompletionDialogOpen(true);
    } else if (
      action.type === "request_response" &&
      !action.response &&
      canRespond
    ) {
      setResponseDialogOpen(true);
    } else if (
      action.type === "request_response" &&
      action.status === "response_received"
    ) {
      const isRequester =
        currentUser && action.createdBy === currentUser.name;
      if (isRequester && isAssigned) {
        setCompletionDialogOpen(true);
      } else if (canRespond) {
        setResponseDialogOpen(true);
      }
    } else if (action.status !== "completed" && canRespond) {
      setCompletionDialogOpen(true);
    }
  };

  if (isLoading) {
    return <LoadingState type="card" />;
  }

  if (!action) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Action not found"
        description="The action you're looking for doesn't exist or has been deleted."
        action={{
          label: "Go Back",
          onClick: () => router.push("/actions"),
        }}
      />
    );
  }

  const isOverdue =
    action.dueDate &&
    action.status !== "completed" &&
    new Date(action.dueDate) < new Date();
  const isRequester = currentUser && action.createdBy === currentUser.name;
  const canComplete = action.status !== "completed";

  const canRespond = canRespondToAction(action, workflow || null, currentUser);
  const isAssigned = isAssignedToAction(action, currentUser);

  const canActuallyComplete = canComplete && canRespond && isAssigned;

  const isViewOnly = workflow && !isAssigned && !canRespond;

  const isPendingApproval = action.approvalStatus === "pending";

  const hasValidDocument =
    action.documentId &&
    action.documentId.trim() !== "" &&
    action.documentName;

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
            <BreadcrumbLink href="/actions">Actions</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>{action.title}</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{action.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={action.status} />
              {action.dueDate && (
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span
                    className={
                      isOverdue
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {isOverdue
                      ? "Overdue"
                      : `Due ${formatDistanceToNow(action.dueDate, {
                          addSuffix: true,
                        })}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        {canActuallyComplete && canRespond && (
          <Button onClick={handleActionClick}>
            {action.type === "document_upload" &&
              action.status === "pending" && (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </>
              )}
            {action.type === "request_response" && !action.response && (
              <>
                <MessageSquare className="mr-2 h-4 w-4" />
                Respond
              </>
            )}
            {((action.type === "document_upload" &&
              action.status === "document_uploaded") ||
              (action.type === "request_response" &&
                action.status === "response_received" &&
                isRequester &&
                isAssigned) ||
              action.type === "regular") && (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark Complete
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {action.description || "No description provided."}
              </p>
              {isViewOnly && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>View Only:</strong> You are part of this workflow
                    but not assigned to this action. You can view the action but
                    cannot respond or complete it.
                  </p>
                </div>
              )}
              {isPendingApproval && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Pending Approval:</strong> This cross-company action
                    is waiting for approval from the target company. You cannot
                    complete this action until it has been approved.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Upload Action - Show uploaded document info */}
          {action.type === "document_upload" &&
            action.status === "document_uploaded" &&
            action.uploadedDocumentName && (
              <Card>
                <CardHeader>
                  <CardTitle>Uploaded Document</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">
                        {action.uploadedDocumentName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Uploaded{" "}
                        {action.uploadedAt &&
                          formatDistanceToNow(new Date(action.uploadedAt), {
                            addSuffix: true,
                          })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Request/Response Action - Show request and response */}
          {action.type === "request_response" && (
            <Card>
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                  <p className="text-sm">
                    {action.requestDetails || "No request details provided."}
                  </p>
                </div>
                {action.response && (
                  <>
                    <div className="font-medium text-sm">Response:</div>
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
                      <p className="text-sm">{action.response}</p>
                      {action.responseReceivedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Responded{" "}
                          {formatDistanceToNow(
                            new Date(action.responseReceivedAt),
                            { addSuffix: true }
                          )}{" "}
                          by {action.respondedBy || "Unknown"}
                        </p>
                      )}
                    </div>
                    {action.responseData &&
                      action.responseData !== action.response && (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-xs font-medium mb-1">
                            Additional Data:
                          </p>
                          <pre className="text-xs whitespace-pre-wrap">
                            {action.responseData}
                          </pre>
                        </div>
                      )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Only show document link if documentId is valid */}
          {hasValidDocument && (
            <Card>
              <CardHeader>
                <CardTitle>Related Document</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium">{action.documentName}</p>
                    <p className="text-sm text-muted-foreground">
                      Linked to this action
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Action Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Action Type
                </p>
                <p className="text-sm">
                  {action.type === "document_upload"
                    ? "Document Upload"
                    : action.type === "request_response"
                    ? "Request/Response"
                    : "Regular Action"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Assigned To
                </p>
                <div className="flex items-center gap-2">
                  {action.assignedTo?.type === "user" ? (
                    <User className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {action.assignedTo?.name || "Unassigned"}
                  </span>
                </div>
              </div>
              {action.createdBy && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Created By
                  </p>
                  <p className="text-sm">{action.createdBy}</p>
                </div>
              )}
              {action.createdAt && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Created
                  </p>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(action.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}
              {action.dueDate && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Due Date
                  </p>
                  <p
                    className={`text-sm ${isOverdue ? "text-destructive" : ""}`}
                  >
                    {new Date(action.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {action.completedAt && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Completed
                  </p>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(action.completedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}
              {/* Cross-company information */}
              {(action.isCrossCompany ||
                action.sourceCompanyName ||
                action.targetCompanyName) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Company Information
                  </p>
                  <div className="space-y-2">
                    {action.sourceCompanyName && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          From:
                        </span>
                        <CompanyBadge
                          companyName={action.sourceCompanyName}
                          size="sm"
                        />
                      </div>
                    )}
                    {action.targetCompanyName && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">To:</span>
                        <CompanyBadge
                          companyName={action.targetCompanyName}
                          size="sm"
                        />
                      </div>
                    )}
                    {action.approvalStatus === "pending" && (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                          <strong>Pending Approval</strong>
                        </p>
                      </div>
                    )}
                    {action.approvalStatus === "approved" && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                        <p className="text-xs text-green-800 dark:text-green-200">
                          <strong>Approved</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {action.workflowId && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Related Workflow
                    </p>
                    <Link
                      href={`/workflows/${action.workflowId}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <WorkflowIcon className="h-4 w-4" />
                      <span>View Workflow</span>
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Document Upload Dialog */}
      {action &&
        action.type === "document_upload" &&
        canRespond && (
          <DocumentUploadActionDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            actionId={actionId}
            action={action}
          />
        )}

      {/* Request/Response Dialog */}
      {action && action.type === "request_response" && canRespond && (
        <RequestResponseActionDialog
          open={responseDialogOpen}
          onOpenChange={setResponseDialogOpen}
          actionId={actionId}
          action={action}
          isRequester={isRequester && isAssigned}
        />
      )}

      {/* Action Completion Dialog - Only if can respond */}
      {action && canRespond && (
        <ActionCompletionDialog
          open={completionDialogOpen}
          onOpenChange={setCompletionDialogOpen}
          actionId={actionId}
          action={action}
        />
      )}
    </div>
  );
}
