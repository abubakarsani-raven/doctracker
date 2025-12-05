"use client";

import { useState } from "react";
import { DocumentCard, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArchiveDialog } from "@/components/features/documents/ArchiveDialog";
import { ArchiveRestore, Search, Archive } from "lucide-react";

// Mock archived documents
const archivedDocuments = [
  {
    id: "1",
    name: "old_contract.pdf",
    type: "pdf",
    size: 2450000,
    scope: "company" as const,
    status: "archived",
    modifiedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    archivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "2",
    name: "completed_project.docx",
    type: "docx",
    size: 125000,
    scope: "department" as const,
    status: "archived",
    modifiedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    archivedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
  },
];

export default function ArchivedDocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>();

  const filteredDocuments = archivedDocuments.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRestore = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setRestoreDialogOpen(true);
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Archived Documents</h1>
          <p className="text-muted-foreground">
            View and manage archived documents
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search archived documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Documents Grid */}
        {filteredDocuments.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No archived documents found"
            description={
              searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Archived documents will appear here"
            }
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="relative">
                  <DocumentCard
                    document={{
                      id: doc.id,
                      name: doc.name,
                      type: doc.type,
                      size: doc.size,
                      scope: doc.scope,
                      status: doc.status,
                      modifiedAt: doc.modifiedAt,
                    }}
                    onView={() => {
                      window.location.href = `/documents/${doc.id}`;
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleRestore(doc.id)}
                  >
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-sm text-muted-foreground text-center">
              Showing {filteredDocuments.length} archived document(s)
            </div>
          </>
        )}

        <ArchiveDialog
          open={restoreDialogOpen}
          onOpenChange={setRestoreDialogOpen}
          documentId={selectedDocumentId}
          isRestore={true}
        />
      </div>
  );
}
