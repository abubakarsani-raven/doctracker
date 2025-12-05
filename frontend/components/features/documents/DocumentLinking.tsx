"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Link2, FileText, X } from "lucide-react";
import Link from "next/link";

interface LinkedDocument {
  id: string;
  name: string;
  type: string;
  relationshipType: string;
}

interface DocumentLinkingProps {
  documentId: string;
  linkedDocuments?: LinkedDocument[];
}

export function DocumentLinking({
  documentId,
  linkedDocuments = [],
}: DocumentLinkingProps) {
  const [linkedDocs, setLinkedDocs] = useState<LinkedDocument[]>(linkedDocuments);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [relationshipType, setRelationshipType] = useState("related");
  const [linking, setLinking] = useState(false);

  // Mock search results - replace with API call
  const searchResults: LinkedDocument[] = [
    { id: "1", name: "Contract Agreement.pdf", type: "pdf", relationshipType: "related" },
    { id: "2", name: "Amendment Letter.docx", type: "docx", relationshipType: "related" },
  ];

  const handleLinkDocument = async (doc: LinkedDocument) => {
    setLinking(true);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      const linkedDoc: LinkedDocument = {
        ...doc,
        relationshipType,
      };

      setLinkedDocs([...linkedDocs, linkedDoc]);
      setLinkDialogOpen(false);
      setSearchQuery("");
      toast.success("Document linked successfully");
    } catch (error) {
      toast.error("Failed to link document");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkDocument = async (docId: string) => {
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 300));

      setLinkedDocs(linkedDocs.filter((doc) => doc.id !== docId));
      toast.success("Document unlinked");
    } catch (error) {
      toast.error("Failed to unlink document");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Linked Documents
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLinkDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Link Document
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {linkedDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No linked documents. Link related documents for easy navigation.
          </p>
        ) : (
          <div className="space-y-2">
            {linkedDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Link
                    href={`/documents/${doc.id}`}
                    className="text-sm font-medium hover:text-primary truncate"
                  >
                    {doc.name}
                  </Link>
                  <Badge variant="outline" className="text-xs">
                    {doc.relationshipType}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleUnlinkDocument(doc.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Link Document</DialogTitle>
            <DialogDescription>
              Search and link a related document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Documents</Label>
              <Input
                id="search"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Relationship Type</Label>
              <select
                className="w-full p-2 border rounded-md"
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
              >
                <option value="related">Related</option>
                <option value="reference">Reference</option>
                <option value="amendment">Amendment</option>
                <option value="supersedes">Supersedes</option>
              </select>
            </div>
            {searchQuery && (
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {searchResults.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 hover:bg-muted cursor-pointer flex items-center justify-between"
                    onClick={() => handleLinkDocument(doc)}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{doc.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={linking}
                    >
                      Link
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLinkDialogOpen(false);
                setSearchQuery("");
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
