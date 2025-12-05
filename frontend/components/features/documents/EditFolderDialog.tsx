"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface EditFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  onFolderUpdated?: () => void;
}

export function EditFolderDialog({
  open,
  onOpenChange,
  folderId,
  onFolderUpdated,
}: EditFolderDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"company" | "department" | "division">("company");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && folderId) {
      loadFolder();
    } else if (!open) {
      // Reset form when dialog closes
      setName("");
      setDescription("");
      setScope("company");
    }
  }, [open, folderId]);

  const loadFolder = async () => {
    if (!folderId) return;

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const folder = await api.getFolder(folderId);
      // For now, get from folders list
      const folders = await api.getFolders();
      const folder = folders.find((f: any) => f.id === folderId);

      if (folder) {
        setName(folder.name || "");
        setDescription(folder.description || "");
        setScope(folder.scope || "company");
      }
    } catch (error) {
      console.error("Failed to load folder:", error);
      toast.error("Failed to load folder details");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    if (!folderId) {
      toast.error("Folder ID is required");
      return;
    }

    setSaving(true);

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // await api.updateFolder(folderId, { name, description, scope });

      toast.success("Folder updated successfully");
      onFolderUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update folder:", error);
      toast.error("Failed to update folder. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
          <DialogDescription>
            Update folder details and settings
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading folder details...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Folder Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Folder"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Folder Scope</Label>
              <Select
                value={scope}
                onValueChange={(value: "company" | "department" | "division") =>
                  setScope(value)
                }
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company-wide</SelectItem>
                  <SelectItem value="department">Department-wide</SelectItem>
                  <SelectItem value="division">Division-wide</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose who can access this folder by default
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || loading}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
