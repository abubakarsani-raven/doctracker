"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalDocumentUploadDialog } from "@/components/features/external-documents/ExternalDocumentUploadDialog";
import { Plus, Mail, FileText, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StatusBadge } from "@/components/common";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/common";

// Mock data
const externalDocuments = [
  {
    id: "1",
    fromName: "John Doe",
    fromEmail: "john@example.com",
    documentName: "application.pdf",
    receivedAt: new Date("2024-01-15"),
    status: "acknowledged" as const,
    acknowledgmentSent: true,
  },
  {
    id: "2",
    fromName: "Jane Smith",
    fromEmail: "jane@example.com",
    documentName: "invoice.pdf",
    receivedAt: new Date("2024-01-14"),
    status: "filed" as const,
    acknowledgmentSent: true,
  },
];

export default function ExternalDocumentsPage() {
  const router = useRouter();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const filteredDocuments = externalDocuments.filter((doc) => {
    if (activeTab === "all") return true;
    return doc.status === activeTab;
  });

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">External Documents</h1>
            <p className="text-muted-foreground">
              Manage documents received from external parties
            </p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload External Document
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending Filing</TabsTrigger>
            <TabsTrigger value="filed">Filed</TabsTrigger>
            <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredDocuments.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No external documents"
                description="Get started by uploading a document received from an external party"
                action={{
                  label: "Upload Document",
                  onClick: () => setUploadDialogOpen(true),
                }}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDocuments.map((doc) => (
                  <Card
                    key={doc.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/external-documents/${doc.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm">{doc.documentName}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            From: {doc.fromName}
                          </p>
                        </div>
                        <StatusBadge
                          status={
                            doc.status === "acknowledged"
                              ? "completed"
                              : doc.status === "filed"
                              ? "completed"
                              : "pending"
                          }
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{doc.fromEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            Received {formatDistanceToNow(doc.receivedAt, { addSuffix: true })}
                          </span>
                        </div>
                        {doc.acknowledgmentSent && (
                          <Badge variant="outline" className="text-xs">
                            Acknowledgment sent
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <ExternalDocumentUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
        />
      </div>
  );
}
