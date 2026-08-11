"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X, Loader2, Mail, User } from "lucide-react";
import { api } from "@/lib/api";
import { useUsers } from "@/lib/hooks/use-users";

interface SignatureParticipant {
  email: string;
  name: string;
  userId?: string;
  signingOrder: number;
}

interface RequestSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName?: string;
  onSuccess?: () => void;
}

export function RequestSignatureDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
  onSuccess,
}: RequestSignatureDialogProps) {
  const { data: users = [] } = useUsers();
  const [participants, setParticipants] = useState<SignatureParticipant[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [manual, setManual] = useState({ email: "", name: "" });
  const [loading, setLoading] = useState(false);

  const availableUsers = useMemo(
    () =>
      (users as any[]).filter(
        (u) =>
          u?.email &&
          !participants.some((p) => p.email === u.email || p.userId === u.id),
      ),
    [users, participants],
  );

  const addFromDirectory = () => {
    const user = (users as any[]).find((u) => u.id === selectedUserId);
    if (!user) {
      toast.error("Pick someone from the directory");
      return;
    }
    setParticipants((prev) => [
      ...prev,
      {
        email: user.email,
        name: user.name || user.email,
        userId: user.id,
        signingOrder: prev.length + 1,
      },
    ]);
    setSelectedUserId("");
  };

  const addManual = () => {
    if (!manual.email.trim() || !manual.name.trim()) {
      toast.error("Enter both email and name");
      return;
    }
    if (participants.some((p) => p.email === manual.email.trim())) {
      toast.error("That email is already listed");
      return;
    }
    setParticipants((prev) => [
      ...prev,
      {
        email: manual.email.trim(),
        name: manual.name.trim(),
        signingOrder: prev.length + 1,
      },
    ]);
    setManual({ email: "", name: "" });
  };

  const removeParticipant = (email: string) => {
    setParticipants((prev) =>
      prev
        .filter((p) => p.email !== email)
        .map((p, index) => ({ ...p, signingOrder: index + 1 })),
    );
  };

  const handleSubmit = async () => {
    if (participants.length === 0) {
      toast.error("Add at least one signer");
      return;
    }
    setLoading(true);
    try {
      await api.createSignatureRequest(fileId, participants);
      toast.success("Signature request sent");
      onSuccess?.();
      onOpenChange(false);
      setParticipants([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to create signature request");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setParticipants([]);
    setManual({ email: "", name: "" });
    setSelectedUserId("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Request signatures</DialogTitle>
          <DialogDescription>
            Ask people to sign “{fileName || "this document"}”. They choose the
            page and exact spot when they sign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>From directory</Label>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} · {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addFromDirectory}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="participant-email">
                <Mail className="mr-1 inline h-4 w-4" />
                Or email
              </Label>
              <Input
                id="participant-email"
                type="email"
                placeholder="signer@org.ng"
                value={manual.email}
                onChange={(e) =>
                  setManual((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participant-name">
                <User className="mr-1 inline h-4 w-4" />
                Name
              </Label>
              <Input
                id="participant-name"
                placeholder="Hadiza Aliyu"
                value={manual.name}
                onChange={(e) =>
                  setManual((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={addManual}>
            <Plus className="mr-2 h-4 w-4" />
            Add external signer
          </Button>

          {participants.length > 0 && (
            <div className="space-y-2">
              <Label>Signing order</Label>
              <div className="space-y-2">
                {participants.map((participant, index) => (
                  <div
                    key={participant.email}
                    className="flex items-center gap-2 rounded-lg border p-3"
                  >
                    <Badge variant="outline" className="shrink-0">
                      {index + 1}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{participant.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {participant.email}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeParticipant(participant.email)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={participants.length === 0 || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
