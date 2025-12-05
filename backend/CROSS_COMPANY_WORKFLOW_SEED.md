# Cross-Company Workflow Seed Data

## What Was Added

### New Users for Tech Solutions Ltd:
- `sarah@techsolutions.com` - Company Admin (password: `password123`)
- `mike@techsolutions.com` - Department Head (password: `password123`)

### Cross-Company Workflow:
**Title:** Partnership Agreement Collaboration

**Details:**
- **Source Company:** Acme Corporation
- **Target Company:** Tech Solutions Ltd
- **Status:** Pending (waiting for approval)
- **Type:** Document workflow
- **Assigned By:** Charlie Brown (Company Admin from Acme)
- **Progress:** 0%
- **Due Date:** 30 days from now

### Cross-Company Approval Request:
- **Request Type:** workflow_assignment
- **Status:** Pending
- **Requested:** 2 days ago
- Waiting for Tech Solutions Ltd Company Admin (Sarah Chen) to approve

### Inter-Organizational Action:
**Title:** Provide Partnership Terms and Conditions

**Details:**
- **Type:** request_response (requires response from another organization)
- **Status:** Pending
- **Assigned To:** Mike Rodriguez (Tech Solutions Ltd)
- **Description:** Requires Tech Solutions Ltd to provide their standard partnership terms and conditions
- **Cross-Company:** Yes - from Acme to Tech Solutions
- **Approval Status:** Pending

## Testing Cross-Company Collaboration

1. **Login as Sarah** (`sarah@techsolutions.com` / `password123`)
   - Go to Approvals page
   - You should see pending approval requests from Acme Corporation

2. **Login as Charlie** (`charlie@example.com` / `password123`)
   - View workflows - you'll see the cross-company workflow
   - Status shows "Pending Approval"

3. **Login as Mike** (`mike@techsolutions.com` / `password123`)
   - View actions - you'll see the inter-organizational action
   - Can respond with partnership terms

## Workflow States

The workflow demonstrates:
- ✅ Cross-company workflow creation
- ✅ Approval request system
- ✅ Inter-organizational action assignment
- ✅ Request/response action type for collaboration




