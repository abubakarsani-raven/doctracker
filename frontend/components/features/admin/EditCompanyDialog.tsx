"use client";

import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { useUpdateCompany } from "@/lib/hooks/use-companies";

interface EditCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: {
    id: string;
    name: string;
    description?: string | null;
    address?: string | null;
  } | null;
}

export function EditCompanyDialog({
  open,
  onOpenChange,
  company,
}: EditCompanyDialogProps) {
  const updateCompany = useUpdateCompany();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!company || !open) return;
    setName(company.name || "");
    setDescription(company.description || "");
    setAddress(company.address || "");
  }, [company, open]);

  const handleSave = async () => {
    if (!company || !name.trim()) return;
    try {
      await updateCompany.mutateAsync({
        id: company.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          address: address.trim() || undefined,
        },
      });
      onOpenChange(false);
    } catch {
      // toast from hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
          <DialogDescription>
            Update the company name and profile details shown in the registry.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="company-name">Name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={updateCompany.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-description">Description</Label>
            <Textarea
              id="company-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={updateCompany.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-address">Address</Label>
            <Input
              id="company-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={updateCompany.isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateCompany.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || updateCompany.isPending}
          >
            {updateCompany.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
