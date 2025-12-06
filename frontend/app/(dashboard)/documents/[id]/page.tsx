"use client";

import { useState, useMemo } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, LoadingState, EmptyState, PresenceIndicator } from "@/components/common";
import { Download, Share2, MoreVertical, FileText, Clock, User, Workflow } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DocumentPreview } from "@/components/features/documents/DocumentPreview";
import { DocumentNotes } from "@/components/features/documents/DocumentNotes";
import { DocumentVersions } from "@/components/features/documents/DocumentVersions";
import { MoveDocumentDialog } from "@/components/features/documents/MoveDocumentDialog";
import { EditRichTextDialog } from "@/components/features/documents/EditRichTextDialog";
import { UploadNewVersionDialog } from "@/components/features/documents/UploadNewVersionDialog";
import { CreateWorkflowDialog } from "@/components/features/workflows/CreateWorkflowDialog";
import { Edit, Upload } from "lucide-react";
import { useDocument, useFolders } from "@/lib/hooks/use-documents";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkflowsByDocument } from "@/lib/hooks/use-workflows";
import { WorkflowList } from "@/components/features/workflows/WorkflowList";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const queryClient = useQueryClient();
  
  const { data: documentData, isLoading: documentLoading } = useDocument(documentId);
  const { data: allFolders = [] } = useFolders();
  const { data: workflows = [], isLoading: workflowsLoading } = useWorkflowsByDocument(documentId);
  
  const [activeTab, setActiveTab] = useState("preview");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [createWorkflowDialogOpen, setCreateWorkflowDialogOpen] = useState(false);
  const [editRichTextDialogOpen, setEditRichTextDialogOpen] = useState(false);
  const [uploadNewVersionDialogOpen, setUploadNewVersionDialogOpen] = useState(false);

  // Process document data
  const document = useMemo(() => {
    if (!documentData) return null;

    const folder = allFolders.find((f: any) => f.id === documentData.folderId);
    return {
      ...documentData,
      folder: folder?.name || "Unknown",
      folderId: documentData.folderId,
      modifiedAt: new Date(documentData.modifiedAt),
      createdAt: new Date((documentData as any).createdAt || documentData.modifiedAt),
      createdBy: documentData.createdByName || documentData.createdBy || "Unknown",
      isRichText: documentData.type?.toLowerCase() === 'html' || documentData.fileType?.toLowerCase() === 'html',
    };
  }, [documentData, allFolders]);

  const handleMoveComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const handleEditSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
  };

  const handleVersionUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
  };

  if (documentLoading) {
    return <LoadingState type="card" />;
  }

  if (!document) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={FileText}
          title="Document not found"
          description="The document you're looking for doesn't exist or has been deleted."
          action={{
            label: "Go Back",
            onClick: () => router.push("/documents"),
          }}
        />
      </div>
    );
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const scopeLabels: Record<string, string> = {
    company: "Company-wide",
    department: "Dept-wide",
    division: "Division-wide",
  };

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
            <BreadcrumbLink href="/documents">Documents</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              href={
                document.folderId
                  ? `/documents/folder/${document.folderId}`
                  : "/documents"
              }
            >
              {document.folder}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>{document.name}</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <FileText className="h-10 w-10 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{document.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              {document.scope && (
                <Badge variant="outline">{scopeLabels[document.scope]}</Badge>
              )}
              {document.status && (
                <StatusBadge status={document.status as any} />
              )}
              <PresenceIndicator resourceType="document" resourceId={documentId} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {document?.isRichText ? (
                <DropdownMenuItem
                  onClick={() => setEditRichTextDialogOpen(true)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Document
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => setUploadNewVersionDialogOpen(true)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload New Version
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setMoveDialogOpen(true)}>
                Move
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCreateWorkflowDialogOpen(true)}
              >
                <Workflow className="mr-2 h-4 w-4" />
                Create Workflow
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Document Info & Tabs */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
              <TabsTrigger value="workflows">Workflows</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-4">
              <DocumentPreview
                documentId={documentId}
                document={document}
                fileType={document.type || document.fileType}
                fileName={document.name}
              />
            </TabsContent>
            <TabsContent value="notes" className="mt-4">
              <DocumentNotes documentId={documentId} />
            </TabsContent>
            <TabsContent value="versions" className="mt-4">
              <DocumentVersions
                documentId={documentId}
                key={document?.modifiedAt?.toString()}
                onVersionRestored={handleVersionUploaded}
              />
            </TabsContent>
            <TabsContent value="workflows" className="mt-4">
              <WorkflowList
                workflows={workflows}
                isLoading={workflowsLoading}
                title="Related Workflows"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          {/* Workflows Section */}
          {workflows && workflows.length > 0 && (
            <WorkflowList
              workflows={workflows}
              isLoading={workflowsLoading}
              title="Workflows"
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Size</p>
                <p className="text-sm">
                  {formatFileSize(document.size || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="text-sm">
                  {document.isRichText
                    ? "Rich Text"
                    : (document.type || document.fileType || "Unknown").toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Folder
                </p>
                <p className="text-sm">{document.folder}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(document.createdAt, {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Modified
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(document.modifiedAt, {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created By
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3 w-3" />
                  <span>{document.createdBy}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Move Dialog */}
      <MoveDocumentDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        documentId={documentId}
        currentFolderId={document.folderId}
        onMoveComplete={handleMoveComplete}
      />

      {/* Edit Rich Text Dialog */}
      {document?.isRichText && (
        <EditRichTextDialog
          open={editRichTextDialogOpen}
          onOpenChange={setEditRichTextDialogOpen}
          documentId={documentId}
          currentContent={document?.richTextContent}
          onSaved={handleEditSaved}
        />
      )}

      {/* Upload New Version Dialog */}
      {!document?.isRichText && (
        <UploadNewVersionDialog
          open={uploadNewVersionDialogOpen}
          onOpenChange={setUploadNewVersionDialogOpen}
          documentId={documentId}
          currentFileName={document?.name}
          onUploaded={handleVersionUploaded}
        />
      )}

      {/* Create Workflow Dialog */}
      <CreateWorkflowDialog
        open={createWorkflowDialogOpen}
        onOpenChange={setCreateWorkflowDialogOpen}
        documentId={documentId}
        folderId={document.folderId}
        onWorkflowCreated={() => {
          setCreateWorkflowDialogOpen(false);
          router.push("/workflows");
        }}
      />
    </div>
  );
}
