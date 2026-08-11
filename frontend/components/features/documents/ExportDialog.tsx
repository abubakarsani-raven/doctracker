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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  documentIds?: string[];
}

export function ExportDialog({
  open,
  onOpenChange,
  folderId,
  documentIds,
}: ExportDialogProps) {
  const [format, setFormat] = useState<"zip" | "pdf" | "csv">("zip");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeVersions, setIncludeVersions] = useState(false);

  const handleExport = () => {
    // Export endpoint is not wired yet — do not fake success.
    toast.error("This action is not available yet");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Documents
          </DialogTitle>
          <DialogDescription>
            Export {folderId ? "folder" : documentIds?.length ? `${documentIds.length} documents` : "selected items"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={format} onValueChange={(value: any) => setFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">ZIP Archive</SelectItem>
                <SelectItem value="pdf">PDF Bundle</SelectItem>
                <SelectItem value="csv">CSV (Metadata Only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="metadata"
                checked={includeMetadata}
                onCheckedChange={(checked) => setIncludeMetadata(checked === true)}
              />
              <Label htmlFor="metadata" className="cursor-pointer">
                Include metadata and tags
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="versions"
                checked={includeVersions}
                onCheckedChange={(checked) => setIncludeVersions(checked === true)}
              />
              <Label htmlFor="versions" className="cursor-pointer">
                Include all versions
              </Label>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleExport}>
            Start Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
