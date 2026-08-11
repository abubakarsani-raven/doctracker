# DocTracker User Manual

DocTracker is a multi-company document registry. Organisations file contracts and other documents, control who can open them, route work through workflows and actions, and collect signatures when needed.

Access is **need-to-know**. Putting a folder under a department records where it belongs — it does not automatically open that folder to everyone in the department. Someone must grant access to a person, department, or division.

---

## Contents

1. [Getting started](#1-getting-started)
2. [Roles at a glance](#2-roles-at-a-glance)
3. [Finding your way around](#3-finding-your-way-around)
4. [Documents and folders](#4-documents-and-folders)
5. [Access and permissions](#5-access-and-permissions)
6. [Workflows](#6-workflows)
7. [Actions and goals](#7-actions-and-goals)
8. [Signatures](#8-signatures)
9. [Approvals and access requests](#9-approvals-and-access-requests)
10. [Users and companies](#10-users-and-companies)
11. [Archived documents, search, and storage](#11-archived-documents-search-and-storage)
12. [Demo accounts](#12-demo-accounts)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Getting started

### Sign in

1. Open the DocTracker site (locally: `http://localhost:3001`).
2. Go to **Login** (`/login`).
3. Enter your email and password.
4. Optionally choose **Remember me**.

If your account is deactivated you will see a clear message and cannot sign in until an administrator restores it.

Related pages:

| Page | Path | Purpose |
|------|------|---------|
| Register | `/register` | Create an account (when self-registration is allowed) |
| Forgot password | `/forgot-password` | Request a reset link |
| Reset password | `/reset-password` | Set a new password from the email link |

### Profile and settings

- Open your **avatar** (top right) → **Profile** (`/profile`) to see your details and effective permissions.
- **Settings** (`/settings`) covers profile fields, notification preferences, and security / appearance options.
- **Log out** ends the session.

### Notifications

The **bell** in the header shows in-app notifications (actions assigned, access changes, signature requests, and similar). Click an item to jump to the related action, workflow, document, or access-request page. Mark items as read from the dropdown.

### Command palette

Press **⌘K** (Mac) or **Ctrl+K** (Windows/Linux) to open the command palette. You can:

- Run quick actions you are allowed to use (upload document, create folder, create workflow, invite user, and so on)
- Jump to any area of the app your role can see
- Search documents, folders, workflows, and actions

---

## 2. Roles at a glance

What you can do depends on two things that both must pass:

1. **Capability** — does your role allow this kind of action (for example delete a document, invite users)?
2. **Access** — may you reach *this* folder or document?

| Role | Typical reach | Typical work |
|------|---------------|--------------|
| **Master** | All companies | Full control; recover locked resources; manage companies |
| **Group Secretary** | All companies | Cross-company routing; users; permissions; approvals; reports/storage |
| **Company Secretary** | One company | Internal routing; document permissions; signatures; access review |
| **Company Admin** | One company | Users, approvals, storage, permissions, deletes within the company |
| **Department Head** | Department | Strong control in the department; assign work; review access |
| **Department Secretary** | Department | Route and track; share and sign; assign work (no delete) |
| **Division Head** | Division | Control division documents and folder permissions |
| **Manager** | Division | Create, route, share, and sign (no delete / re-permission) |
| **Staff** | Division | Create and edit documents; create workflows; complete actions; request access |
| **Receptionist** | Own items | Create documents; view and complete assigned work; request access |

Company-wide roles (Company Admin, Company Secretary) can reach documents in their company by role. Everyone else needs an ACL grant (or be the creator). Master always reaches everything so a resource can never be permanently locked.

For the full permission model, see [How permissions work](README.md#how-permissions-work) in the project README.

---

## 3. Finding your way around

### Registry (sidebar)

| Item | Path | What it is |
|------|------|------------|
| Dashboard | `/dashboard` | Snapshot of your documents, workflows, actions, goals, and recent activity |
| Documents | `/documents` | Folder and document library |
| Workflows | `/workflows` | Active and past workflows |
| Actions | `/actions` | Tasks assigned to you or your teams |
| My Goals | `/my-goals` | Goals from workflows assigned to you |
| Templates | `/templates` | Placeholder (coming soon) |
| Archived | `/archived` | Soft-archived documents you can restore |
| Users | `/users` | People in scope (invite if you manage users) |
| Settings | `/settings` | Your account preferences |

Some items only appear if your role has the matching capability.

### Administration (sidebar)

Visible when you hold the relevant admin capabilities:

| Item | Path | Who |
|------|------|-----|
| Admin Dashboard | `/admin/dashboard` | Reports viewers |
| Companies | `/admin/companies` | Master |
| Approvals | `/approvals` | Cross-company approval reviewers |
| Access Requests | `/access-requests` | Access reviewers |
| Reports | `/admin/reports` | Placeholder (coming soon) |
| Storage | `/admin/storage` | Storage viewers |

The header also shows your **company** (or “All Companies” for instance-wide roles) and your **role**.

---

## 4. Documents and folders

### Browse the library

1. Open **Documents** (`/documents`).
2. Browse folders and files you can see.
3. Use search and filters to narrow by name, type, or other criteria.
4. Open a folder (`/documents/folder/[id]`) or a document (`/documents/[id]`).

Folders you cannot open still appear greyed out, with a reason and **Request access**. Documents inside locked folders are not listed.

Folder nesting is limited to **three levels** so paths stay readable.

### Create a folder

1. From Documents or inside a folder, choose **Create folder** (or equivalent).
2. Enter a name and optional description.
3. Choose scope (company / department / division) and parent folder if needed.
4. Confirm.

Filing a folder “for” a department writes an initial ACL grant for that department so the new folder is usable under need-to-know.

### Upload a file

1. Choose **Upload**.
2. Select one or more allowed file types (for example PDF, Office, images).
3. Optionally place the upload in a folder.
4. Confirm.

### Create a rich-text document

1. Choose **Create rich text** (or similar).
2. Give the document a name and write content in the editor.
3. Save — it appears in the registry like any other document.

### Work with a document

On `/documents/[id]` you can typically:

| Tab / action | Purpose |
|--------------|---------|
| Preview | View the file |
| Notes | Add discussion notes |
| Versions | Upload or restore versions |
| Workflows | See linked workflows; start a new one |
| Signatures | Request or complete signatures |
| Manage access | Grant or deny people / departments / divisions |
| Move | Place the document in another folder |
| Archive / Delete | Soft-archive or remove (capability required) |

Use multi-select on the documents list for bulk export or archive when those actions are available to you.

---

## 5. Access and permissions

### Mental model

- **Filing ≠ access.** Organisation under a department does not open the content by itself.
- **Grants** name a user, department, or division, with verbs such as read, write, delete, share, or manage.
- **Deny** beats grant.
- **Folder grant** cascades to contents; **file grant** opens only that file (the parent folder becomes navigable but only shows granted files).
- **Creators** keep access to what they created.
- **Master** can always reach a resource.

### Manage access

1. Open a folder or document.
2. Choose **Manage access**.
3. Add an allow or deny for a person, department, or division.
4. Choose the verbs they should have.
5. Save.

When access is removed, the person can be notified and open work may be left alone or flagged for reassignment, depending on the options you choose.

### Request access

1. On a locked folder or document, choose **Request access**.
2. Explain why you need it.
3. Wait for a reviewer to approve or reject on **Access Requests** (`/access-requests`).

---

## 6. Workflows

Workflows organise work around a **folder** or a **document**.

### Create a workflow

1. From Documents, a folder, a document, or Workflows, choose **Create workflow**.
2. Choose type:
   - **Folder-based** — work tied to a folder (and optionally many related files).
   - **Document-based** — work tied to one primary document.
3. Set title, description, assignee (user or department), and optional due date.
4. Confirm.

Cross-company assignment may create an **approval request** instead of assigning immediately.

### Open a workflow

Go to **Workflows** (`/workflows`) and open an item (`/workflows/[id]`). The detail page typically shows:

- Status and assignees
- Routing history / timeline
- **Files Added**
- Actions and goals
- **Action Results**
- Controls to route, complete, or add files

### Route a workflow

1. Open the workflow.
2. Choose **Route workflow** (or similar).
3. Pick a routing type, for example:
   - Secretary
   - Department
   - Individual user
   - Department head
   - Original sender
   - Create action
4. Add optional notes.
5. Confirm.

Routing history records every hand-off. Participants and assignees can see the workflow according to their role and company rules. Cross-company routes go through **Approvals**.

A longer walkthrough lives in [WORKFLOW_ROUTING_GUIDE.md](WORKFLOW_ROUTING_GUIDE.md).

### Files Added

The **Files Added** section lists the primary document (for document workflows) plus any attachments.

**Add a file**

1. Choose **Add File**.
2. **Reference** an existing registry document, **Upload** a new file, or create **Rich text**.
3. Optionally add a note.
4. Confirm.

Rules:

- **Document-based** workflows may attach additional documents under Files Added, but when you **complete an action** you may only **reference the primary document**.
- **Folder-based** workflows can reference Files Added entries or other company documents when completing actions.

File names in Files Added are links — click to open the document.

### Complete a workflow

When work is finished (actions done / ready for review), the creator or an authorised instance-wide user can **complete** the workflow from the detail page.

---

## 7. Actions and goals

### Actions

Actions are concrete tasks on a workflow (review, respond, upload evidence, and so on).

1. Open **Actions** (`/actions`) or open them from a workflow.
2. Open an action (`/actions/[id]`).
3. When finished, choose **Complete** / **Mark as Complete**.

**Completing an action**

1. Enter a **Result** (required) — what happened, decision, or next step.
2. Optionally **Reference a file**:
   - Folder workflows: pick from Files Added or other documents.
   - Document workflows: only the primary document.
3. Optionally type **`@`** in the result notes to pick a **folder** and save the referenced document into that folder.
4. Confirm.

Results appear under **Action Results** on the workflow. Referenced files appear there as clickable links and under Files Added.

### Goals

On a workflow, create **goals** for participants or departments. Assignees track them under **My Goals** (`/my-goals`) and mark progress or achievement as your process requires.

---

## 8. Signatures

On a document detail page (`/documents/[id]`):

1. Open the **Signatures** area.
2. Choose **Request signature**.
3. Add participants in signing order (existing users or email-only invitees).
4. Send the request.

Signers receive an in-app notification (and email when SMTP is configured). They open the document, place a signature on the PDF where required, and submit.

People who did not already have read access may receive temporary read access for the signature request; that access is cleaned up when signing is complete, according to product rules.

You need the relevant capabilities (`documents.request_signature`, `documents.sign`) to request or sign.

---

## 9. Approvals and access requests

### Cross-company approvals

When a workflow or assignment crosses company boundaries:

1. The request appears on **Approvals** (`/approvals`).
2. Reviewers approve or reject.
3. On approval, routing or assignment continues to the target company.

Cards and badges call out cross-company items so they are easy to spot.

### Access requests

Reviewers open **Access Requests** (`/access-requests`), read the reason, and approve or reject (with an optional rejection note). Approving grants the requested access on the folder or document.

---

## 10. Users and companies

### Invite a user

1. Open **Users** (`/users`).
2. Choose **Invite User** (requires `users.manage` — typically Master, Group Secretary, or Company Admin).
3. Enter email, role, and optional department / division.
4. Send the invite.

### Companies (Master)

1. Open **Companies** (`/admin/companies`).
2. Review company list (including user and document counts).
3. **Create Company** to add an organisation.
4. Open a company (`/admin/companies/[id]`) to inspect departments, divisions, and people.

---

## 11. Archived documents, search, and storage

| Area | Path | Notes |
|------|------|-------|
| Archived | `/archived` | Search and restore archived documents |
| Search | `/search` | Advanced document search |
| Storage | `/admin/storage` | Total and per-company storage usage |
| Admin dashboard | `/admin/dashboard` | High-level totals for docs, users, storage, workflows |

**Templates** and **Reports** pages may show as coming soon until those features ship.

---

## 12. Demo accounts

Local demos use password **`Password123!`** unless you override `SEED_PASSWORD`.

### Contracts bootstrap (recommended demo)

After the backend is up and the database has been seeded:

```bash
./scripts/bootstrap-contracts-api.sh
```

| Email | Role |
|-------|------|
| `aisha@example.com` | Master |
| `fatima@example.com` | Group Secretary |
| `habiba@example.com` | Company Secretary (Arewa) |
| `maryam@example.com` | Company Secretary (GDP) |
| `suleiman@example.com` | Staff (useful for ACL / action tests) |
| … | See [frontend/TEST_USERS.md](frontend/TEST_USERS.md) for the full list |

Organisations: **Arewa Contract Services Ltd**, **Global Development Partners Nigeria**.

### Prisma seed catalogue

The seed script also documents a fuller role ladder (Alice, Grace, Sade, and others). See [README — Signing in](README.md#signing-in). Use whichever set your environment actually created.

---

## 13. Troubleshooting

| Problem | What to try |
|---------|-------------|
| I cannot open a folder or document | Check whether you have a grant; use **Request access**. Company-wide roles see their company; others need ACL or creator rights. |
| I do not see a sidebar item | Your role may lack the capability; ask an administrator. |
| I cannot route a workflow | Confirm you are assignee or have routing rights, and that the workflow is not already completed or cancelled. |
| The person I routed to cannot see the workflow | Confirm company boundaries and approvals; ensure they are assignee or participant. |
| Completing an action fails without a result | Add **Result** notes — a recorded outcome is required. |
| I cannot reference another file on a document workflow | Document workflows only allow referencing the **primary** document on complete. Attach extras under Files Added separately. |
| `@` does nothing in result notes | Type `@` at the start of a token to open the folder picker; you need write access to the target folder, and a referenced file selected if you want it moved. |
| Signature invitee cannot open the file | Confirm the request was sent and they are signed in with the matching account; temporary read access is granted for the request when applicable. |
| Session expired / sent to login | Sign in again; use the `next` redirect if present to return to the page you were on. |
| Stats on Companies show zeros | Refresh after the API is updated; counts exclude soft-deleted files. |

---

## Quick reference — everyday paths

| Task | Where |
|------|--------|
| Upload or file a document | `/documents` |
| Start work on a file or folder | Create workflow from document/folder |
| Hand work to someone else | Workflow → Route |
| Record an outcome | Action → Complete (result + optional file / `@` folder) |
| Collect signatures | Document → Signatures |
| Open locked content | Request access → wait for approval |
| Cross-company hand-off | Approvals queue |
| See everything you own today | Dashboard + ⌘K / Ctrl+K |

---

*This manual describes DocTracker as an end-user product. For deployment, environment variables, and developer setup, see [README.md](README.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [ENV_VARIABLES.md](ENV_VARIABLES.md).*
