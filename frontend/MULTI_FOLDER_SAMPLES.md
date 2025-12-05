# Multi-Folder Document Samples

## Sample Documents with Multiple Folders

The following documents in the mock data have been configured to appear in multiple folders to demonstrate the multi-folder feature:

### Document ID 1: "contract.pdf"
- **Primary Folder**: Legal Documents (folder ID: 1)
- **Also in**: Contract Templates (folder ID: 3)
- **Folder Count**: 2 folders
- **Description**: Main service contract

### Document ID 4: "employee_handbook.pdf"
- **Primary Folder**: Company Policies (folder ID: 4)
- **Also in**: HR Documents (folder ID: 2)
- **Folder Count**: 2 folders
- **Description**: Employee handbook

### Document ID 14: "legal_brief_template.docx"
- **Primary Folder**: Legal Documents (folder ID: 1)
- **Also in**: Contract Templates (folder ID: 3), Company Policies (folder ID: 4)
- **Folder Count**: 3 folders
- **Description**: Legal brief template

### Document ID 15: "shared_company_policy.pdf" (NEW)
- **Primary Folder**: Company Policies (folder ID: 4)
- **Also in**: HR Documents (folder ID: 2)
- **Folder Count**: 2 folders
- **Description**: Shared company policy document in multiple folders

### Document ID 16: "contract_template_multi.docx" (NEW)
- **Primary Folder**: Contract Templates (folder ID: 3)
- **Also in**: Legal Documents (folder ID: 1), Compliance Documents (folder ID: 11)
- **Folder Count**: 3 folders
- **Description**: Contract template available in multiple folders

## How to Test

1. **View Multi-Folder Indicator**:
   - Navigate to the Documents page
   - Look for documents with an "In X folders" badge
   - Hover over the badge to see all folder names in a tooltip

2. **Add Document to Multiple Folders**:
   - Click the three-dot menu (⋮) on any document card
   - Select "Add to Folder"
   - Select multiple folders using checkboxes
   - Click "Add to X Folder(s)"
   - The document will now appear in all selected folders

3. **Edit Folder**:
   - Click the three-dot menu (⋮) on any folder card
   - Select "Edit"
   - Modify folder details
   - Click "Save Changes"

## Features Working

✅ Multi-folder indicator badge
✅ Tooltip showing all folder names
✅ Add document to multiple folders dialog
✅ Folder count calculation
✅ Permission-based folder filtering
