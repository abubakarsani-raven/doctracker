"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X, Tag, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface DocumentTagsManagerProps {
  documentId?: string;
  folderId?: string;
  initialTags?: Tag[];
  onTagsChange?: (tags: Tag[]) => void;
}

export function DocumentTagsManager({
  documentId,
  initialTags = [],
  onTagsChange,
}: DocumentTagsManagerProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);

  // Load available tags and document tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const [allTags, fileTags] = await Promise.all([
          api.getTags(),
          documentId ? api.getFileTags(documentId) : Promise.resolve([])
        ]);
        setAvailableTags(allTags);
        setTags(fileTags);
        onTagsChange?.(fileTags);
      } catch (error: any) {
        toast.error("Failed to load tags");
      }
    };

    loadTags();
  }, [documentId, onTagsChange]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setLoading(true);
    try {
      const newTag = await api.createTag(newTagName.trim());
      setAvailableTags(prev => [...prev, newTag]);
      setNewTagName("");
      setCreateDialogOpen(false);
      toast.success("Tag created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create tag");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!documentId) return;

    try {
      const currentTagIds = tags.map(t => t.id);
      const newTagIds = [...currentTagIds, tagId];
      const updatedTags = await api.updateFileTags(documentId, newTagIds);
      setTags(updatedTags);
      onTagsChange?.(updatedTags);
      toast.success("Tag added successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to add tag");
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!documentId) return;

    try {
      const currentTagIds = tags.map(t => t.id);
      const newTagIds = currentTagIds.filter(id => id !== tagId);
      const updatedTags = await api.updateFileTags(documentId, newTagIds);
      setTags(updatedTags);
      onTagsChange?.(updatedTags);
      toast.success("Tag removed successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove tag");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Tag
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tags yet. Add tags to organize and filter documents.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {tag.name}
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>
              Select an existing tag or create a new one
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <Label>Existing Tags</Label>
                <Select onValueChange={handleAddTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tag to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags
                      .filter(tag => !tags.find(t => t.id === tag.id))
                      .map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tag-name">Or Create New Tag</Label>
              <Input
                id="tag-name"
                placeholder="e.g., Contract, Legal, Important"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateTag();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewTagName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim() || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
