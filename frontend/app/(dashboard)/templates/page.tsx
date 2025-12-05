"use client";

import { TemplateLibrary } from "@/components/features/documents/TemplateLibrary";

export default function TemplatesPage() {
  return (
    <TemplateLibrary
      onSelectTemplate={(templateId) => {
        // Handle template selection
        console.log("Selected template:", templateId);
      }}
    />
  );
}
