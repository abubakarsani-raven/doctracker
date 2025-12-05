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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Users, UserPlus, X, Shield } from "lucide-react";
import { useMockData } from "@/lib/contexts/MockDataContext";

interface PermissionManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  documentId?: string;
}

type PermissionType = "read" | "write" | "delete" | "share" | "manage";

interface PermissionEntry {
  userId: string;
  userName: string;
  userEmail: string;
  permissions: PermissionType[];
}

export function PermissionManagementDialog({
  open,
  onOpenChange,
  folderId,
  documentId,
}: PermissionManagementDialogProps) {
  const { users } = useMockData();
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionType[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadPermissions();
    }
  }, [open, folderId, documentId]);

  const loadPermissions = async () => {
    // TODO: Load actual permissions from API
    // For now, show empty list
    setPermissions([]);
  };

  const handleAddPermission = () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    if (selectedPermissions.length === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    const user = users.find((u: any) => u.id === selectedUserId);
    if (!user) return;

    // Check if user already has permissions
    if (permissions.find((p) => p.userId === selectedUserId)) {
      toast.error("User already has permissions");
      return;
    }

    setPermissions([
      ...permissions,
      {
        userId: selectedUserId,
        userName: user.name,
        userEmail: user.email,
        permissions: selectedPermissions,
      },
    ]);

    setSelectedUserId("");
    setSelectedPermissions([]);
  };

  const handleRemovePermission = (userId: string) => {
    setPermissions(permissions.filter((p) => p.userId !== userId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Permissions updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  const permissionLabels: Record<PermissionType, string> = {
    read: "Read",
    write: "Write",
    delete: "Delete",
    share: "Share",
    manage: "Manage",
  };

  const availableUsers = users.filter(
    (u: any) => !permissions.find((p) => p.userId === u.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Permissions
          </DialogTitle>
          <DialogDescription>
            {folderId
              ? "Manage who can access this folder and what they can do"
              : "Manage who can access this document and what they can do"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add Permission */}
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-base font-semibold">Add Permission</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={selectedPermissions.includes(key as PermissionType)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPermissions([
                              ...selectedPermissions,
                              key as PermissionType,
                            ]);
                          } else {
                            setSelectedPermissions(
                              selectedPermissions.filter((p) => p !== key)
                            );
                          }
                        }}
                      />
                      <Label
                        htmlFor={key}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={handleAddPermission} disabled={!selectedUserId || selectedPermissions.length === 0}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Permission
            </Button>
          </div>

          {/* Permissions List */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Current Permissions</Label>
            {permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                No custom permissions set. Using default scope-based access.
              </p>
            ) : (
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissions.map((entry) => (
                      <TableRow key={entry.userId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.userName}</div>
                            <div className="text-sm text-muted-foreground">
                              {entry.userEmail}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {entry.permissions.map((perm) => (
                              <Badge key={perm} variant="secondary">
                                {permissionLabels[perm]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePermission(entry.userId)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
