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
import { FileUpload } from "@/components/common";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, Mail } from "lucide-react";
import type { FileWithMetadata } from "@/components/common";

interface ExternalDocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExternalDocumentUploadDialog({
  open,
  onOpenChange,
}: ExternalDocumentUploadDialogProps) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [contactInfo, setContactInfo] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });
  const [documentType, setDocumentType] = useState("");
  const [description, setDescription] = useState("");
  const [sendAcknowledgment, setSendAcknowledgment] = useState(true);
  const [uploading, setUploading] = useState(false);

  const handleFilesSelected = (selectedFiles: FileWithMetadata[]) => {
    setFiles(selectedFiles);
  };

  const handleNext = () => {
    if (step === 1 && files.length === 0) {
      toast.error("Please upload at least one document");
      return;
    }
    if (step === 2 && (!contactInfo.name || !contactInfo.email)) {
      toast.error("Please fill in contact information");
      return;
    }
    setStep(step + 1);
  };

  const handleUpload = async () => {
    setUploading(true);

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success(
        `Document uploaded and ${sendAcknowledgment ? "acknowledgment sent" : "saved"} successfully`
      );
      
      // Reset form
      setFiles([]);
      setContactInfo({ name: "", email: "", phone: "", company: "" });
      setDocumentType("");
      setDescription("");
      setSendAcknowledgment(true);
      setStep(1);
      onOpenChange(false);
    } catch (error) {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload External Document</DialogTitle>
          <DialogDescription>
            Upload a document received from an external party and send acknowledgment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Upload Document */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Step 1: Upload Document</Label>
                <FileUpload
                  onFilesSelected={handleFilesSelected}
                  multiple={false}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Step 2: Contact Information</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={contactInfo.name}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, name: e.target.value })
                      }
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={contactInfo.email}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, email: e.target.value })
                      }
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={contactInfo.phone}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, phone: e.target.value })
                      }
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={contactInfo.company}
                      onChange={(e) =>
                        setContactInfo({ ...contactInfo, company: e.target.value })
                      }
                      placeholder="Company Name"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Document Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label>Step 3: Document Details</Label>
                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="documentType">Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="application">Application</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Additional details about the document..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="acknowledge"
                      checked={sendAcknowledgment}
                      onCheckedChange={(checked) => setSendAcknowledgment(checked === true)}
                    />
                    <Label htmlFor="acknowledge" className="cursor-pointer">
                      Send acknowledgment email with watermarked PDF
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (step > 1) {
                setStep(step - 1);
              } else {
                onOpenChange(false);
              }
            }}
            disabled={uploading}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} disabled={uploading}>
              Next
            </Button>
          ) : (
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                "Uploading..."
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & {sendAcknowledgment ? "Send Acknowledgment" : "Save"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
