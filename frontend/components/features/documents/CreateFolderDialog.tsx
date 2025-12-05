"use client";

import { useState } from "react";
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
import { useMockData } from "@/lib/contexts/MockDataContext";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentFolderId?: string;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentFolderId,
}: CreateFolderDialogProps) {
  const { currentUser, companies, refresh } = useMockData();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"company" | "department" | "division">("company");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    if (!currentUser) {
      toast.error("You must be logged in to create a folder");
      return;
    }

    setCreating(true);

    try {
      // Get user's department/division IDs if needed
      let departmentId: string | undefined;
      let divisionId: string | undefined;

      if (scope === "department" || scope === "division") {
        const userCompany = companies?.find((c: any) => c.id === currentUser.companyId);
        if (userCompany?.departments) {
          const userDept = userCompany.departments.find((d: any) => d.name === currentUser.department);
          if (userDept) {
            departmentId = userDept.id;
            if (scope === "division" && userDept.divisions) {
              const userDiv = userDept.divisions.find((d: any) => d.name === currentUser.division);
              if (userDiv) {
                divisionId = userDiv.id;
              }
            }
          }
        }
      }

      await api.createFolder({
        name: name.trim(),
        description: description.trim() || undefined,
        scopeLevel: scope,
        parentFolderId: parentFolderId,
        departmentId: departmentId,
        divisionId: divisionId,
      });

      toast.success("Folder created successfully");
      setName("");
      setDescription("");
      setScope("company");
      onOpenChange(false);
      
      // Refresh data to show new folder
      if (refresh) {
        await refresh();
      }
    } catch (error: any) {
      console.error("Failed to create folder:", error);
      toast.error(error?.message || "Failed to create folder. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Create a new folder to organize your documents
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Folder Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My New Folder"
              required
              disabled={creating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              disabled={creating}
            />
          </div>

          <div className="space-y-2">
            <Label>Folder Scope</Label>
            <Select
              value={scope}
              onValueChange={(value: "company" | "department" | "division") =>
                setScope(value)
              }
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
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
