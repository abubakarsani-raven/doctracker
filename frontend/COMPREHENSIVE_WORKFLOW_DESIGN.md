# Comprehensive Workflow System Design

## Requirements

1. **Folder-Based Workflows** (Primary)
   - Create workflow from folder
   - All documents in folder are part of workflow
   - Actions apply to folder context

2. **Document-Based Workflows** (Secondary)
   - Create workflow from existing document
   - Example: "Review this contract and come up with a counter contract"
   - Can create actions that require document upload

3. **Advanced Action Types**

   **a) Document Upload Actions**
   - Action requires uploading a document
   - Example: "Upload revised contract"
   - Document saved to selected folder
   - Action blocks until document uploaded

   **b) Request/Response Actions**
   - Interactive actions between departments
   - Example: "Request total budget from Accounts department"
   - Accounts responds with data
   - Workflow continues using that data
   - Action blocks until response received

   **c) Regular Actions**
   - Standard completion actions
   - Can be created during workflow
   - Can block workflow progression

## Workflow Creation Flow

### Option 1: Folder-Based Workflow
1. Select "Folder-Based" workflow type
2. Choose existing folder OR create new folder
3. Set workflow title/description
4. Assign to user/department
5. Create workflow

### Option 2: Document-Based Workflow
1. Select "Document-Based" workflow type
2. Choose existing document (e.g., "contract.pdf")
3. Auto-generate title: "Review contract.pdf and create counter contract"
4. Set description
5. Assign to user/department
6. Create workflow

## Action Types Implementation

### 1. Document Upload Action
- Type: "document_upload"
- Required fields: Title, Target Folder, File Type (optional)
- Action status: "pending" → "document_uploaded" → "completed"
- UI: Shows upload button, tracks uploaded document
- Document automatically saved to specified folder

### 2. Request/Response Action
- Type: "request_response"
- Required fields: Title, Request To (user/dept), Request Details
- Action status: "pending" → "request_sent" → "response_received" → "completed"
- UI: Shows request, response form for assigned party, response data
- Workflow can continue once response received

### 3. Regular Action
- Type: "regular"
- Standard action flow
- Completion with notes

## Data Structure

```typescript
// Workflow
{
  id: string;
  title: string;
  description: string;
  type: "folder" | "document";
  folderId?: string;
  folderName?: string;
  documentId?: string;
  documentName?: string;
  status: "assigned" | "in_progress" | "ready_for_review" | "completed";
  assignedTo: { type: "user" | "department", id: string, name: string };
  assignedBy: string;
  assignedAt: string;
  dueDate?: string;
  progress: number;
  routingHistory: any[];
}

// Action
{
  id: string;
  title: string;
  description: string;
  type: "regular" | "document_upload" | "request_response";
  workflowId: string;
  folderId?: string;
  documentId?: string;
  status: "pending" | "in_progress" | "response_received" | "document_uploaded" | "completed";
  assignedTo: { type: "user" | "department", id: string, name: string };
  
  // Document Upload Action specific
  targetFolderId?: string;
  uploadedDocumentId?: string;
  requiredFileType?: string;
  
  // Request/Response Action specific
  requestDetails?: string;
  response?: string;
  responseData?: any;
  responseReceivedAt?: string;
  
  createdBy: string;
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  resolutionNotes?: string;
}
```

## Implementation Plan

1. ✅ Refactor CreateWorkflowDialog to support both folder and document-based
2. ⏳ Create enhanced action creation with action types
3. ⏳ Create DocumentUploadActionDialog component
4. ⏳ Create RequestResponseActionDialog component
5. ⏳ Update workflow detail page to show actions and allow creation
6. ⏳ Update action completion flows
