"use client";

import { useState, useMemo } from "react";
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
import { useCreateFolder } from "@/lib/hooks/use-documents";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";

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
  const { data: currentUser } = useCurrentUser();
  const { data: companies = [] } = useCompanies();
  const createFolder = useCreateFolder();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"company" | "department" | "division">("company");

  // Get user's department/division IDs
  const userContext = useMemo(() => {
    if (!currentUser || !companies.length) {
      return { departmentId: undefined, divisionId: undefined };
    }

    let departmentId: string | undefined;
    let divisionId: string | undefined;

    const userCompany = companies.find((c: any) => c.id === currentUser.companyId);
    if (userCompany?.departments) {
      const userDept = userCompany.departments.find(
        (d: any) => d.name === currentUser.department
      );
      if (userDept) {
        departmentId = userDept.id;
        if (scope === "division" && userDept.divisions) {
          const userDiv = userDept.divisions.find(
            (d: any) => d.name === currentUser.division
          );
          if (userDiv) {
            divisionId = userDiv.id;
          }
        }
      }
    }

    return { departmentId, divisionId };
  }, [currentUser, companies, scope]);

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

    try {
      await createFolder.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        scopeLevel: scope,
        parentFolderId: parentFolderId,
        departmentId: userContext.departmentId,
        divisionId: userContext.divisionId,
      });

      setName("");
      setDescription("");
      setScope("company");
      onOpenChange(false);
    } catch (error: any) {
      // Error toast is handled by the mutation hook
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
              disabled={createFolder.isPending}
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
              disabled={createFolder.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Folder Scope</Label>
            <Select
              value={scope}
              onValueChange={(value: "company" | "department" | "division") =>
                setScope(value)
              }
              disabled={createFolder.isPending}
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
              disabled={createFolder.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createFolder.isPending}>
              {createFolder.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
