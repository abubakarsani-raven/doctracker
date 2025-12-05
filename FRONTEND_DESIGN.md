# Frontend Design & Screen Structure Plan

## Design System Overview

**UI Framework**: shadcn/ui with Tailwind CSS  
**Design Principles**: Clean, modern, accessible, mobile-first  
**Color Scheme**: Customizable theme with light/dark mode support  
**Typography**: Inter font family (or system default)  
**Spacing**: Consistent 4px grid system

## Core shadcn/ui Components Used

### Layout Components
- `Card` - Container for content sections
- `Tabs` - Tab navigation
- `Sheet` - Side panels and drawers
- `Dialog` - Modals and popups
- `Dropdown Menu` - Context menus
- `Separator` - Visual dividers
- `ScrollArea` - Scrollable containers

### Navigation Components
- `Navigation Menu` - Main navigation
- `Breadcrumb` - Navigation hierarchy
- `Sidebar` - Side navigation panel
- `Command` - Command palette/search

### Data Display Components
- `Table` - Data tables
- `DataTable` - Advanced tables with sorting/filtering
- `Badge` - Status indicators
- `Avatar` - User avatars
- `Progress` - Progress bars
- `Skeleton` - Loading states

### Form Components
- `Button` - Action buttons
- `Input` - Text inputs
- `Textarea` - Multi-line text
- `Select` - Dropdown selections
- `Checkbox` - Checkboxes
- `Radio Group` - Radio buttons
- `Switch` - Toggle switches
- `Date Picker` - Date selection
- `File Upload` - File input with drag-drop

### Feedback Components
- `Alert` - Alert messages
- `Toast` - Toast notifications
- `Tooltip` - Tooltips
- `Popover` - Popover menus

### Rich Text Editor
- `Tiptap Editor` - Rich text editing integration

---

## Screen Structure & Layouts

## 1. Authentication Screens

### 1.1 Login Page
**Route**: `/login`

**Layout Structure:**
```
┌─────────────────────────────────────┐
│  [Logo] Document Repository System  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Card Container             │   │
│  │                             │   │
│  │  Login Form:                │   │
│  │  - Email Input              │   │
│  │  - Password Input           │   │
│  │  - Remember Me Checkbox     │   │
│  │  - Login Button             │   │
│  │  - Forgot Password Link     │   │
│  │  - Register Link            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Components Used:**
- `Card` - Main form container
- `CardHeader` - Title section
- `CardTitle` - "Welcome Back"
- `CardDescription` - Subtitle
- `CardContent` - Form content
- `Input` - Email and password fields
- `Button` - Login button (primary)
- `Checkbox` - Remember me
- `Link` - Navigation links

**Design Notes:**
- Centered card layout
- Clean, minimal design
- Form validation with error messages
- Loading state on submit

### 1.2 Register Page
**Route**: `/register`

**Layout Structure:**
Similar to login with additional fields:
- Full Name
- Email
- Password
- Confirm Password
- Company Selection (if applicable)
- Terms & Conditions checkbox

**Components Used:**
- Same as login + `Select` for company selection

### 1.3 Forgot Password Page
**Route**: `/forgot-password`

**Components Used:**
- `Card` - Container
- `Input` - Email field
- `Button` - Submit button
- `Alert` - Success/error messages

---

## 2. Main Dashboard Screens

### 2.1 Main Dashboard Layout
**Route**: `/dashboard`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: [Logo] [Search] [Notifications] [User Menu]     │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │  Main Content Area                          │
│          │                                              │
│ - Home   │  ┌──────────────────────────────────────┐  │
│ - Docs   │  │ Dashboard Widgets                     │  │
│ - Files  │  │ - Recent Documents                    │  │
│ - Tasks  │  │ - Pending Actions                     │  │
│ - Reports│  │ - Storage Usage                       │  │
│ - Admin  │  │ - Activity Feed                       │  │
│          │  └──────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────┘
```

**Components Used:**
- `Sidebar` - Navigation sidebar
- `Header` - Top header bar
- `Breadcrumb` - Navigation path
- `Card` - Widget containers
- `Badge` - Status indicators
- `Avatar` - User avatar in header
- `Dropdown Menu` - User menu
- `Command` - Global search (Cmd+K)

### 2.2 Dashboard Home Page
**Route**: `/dashboard`

**Widget Sections:**

**A. Quick Stats Cards**
- Total Documents
- Active Workflows
- Pending Actions
- Storage Used

**Components:**
- `Card` - Individual stat cards
- `Badge` - Status badges
- `Progress` - Storage progress bar

**B. Recent Documents Table**
- Document Name
- Folder Location
- Last Modified
- Actions (View, Download)

**Components:**
- `Table` - Data table
- `Button` - Action buttons (icon buttons)
- `Dropdown Menu` - More actions

**C. Pending Actions List**
- Action Title
- Due Date
- Status
- Quick Actions

**Components:**
- `Card` - Action item cards
- `Badge` - Status badge
- `Button` - Complete action button

**D. Activity Feed**
- Recent activity items
- User + Action + Resource
- Timestamp

**Components:**
- `Timeline` - Activity timeline
- `Avatar` - User avatars
- `Badge` - Activity type

---

## 3. Document Repository Screens

### 3.1 Folder/File Browser
**Route**: `/documents` or `/documents/[folderId]`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb Navigation                                    │
│ [Home] > [Company] > [Folder] > [Subfolder]            │
├─────────────────────────────────────────────────────────┤
│ Toolbar: [New Folder] [Upload] [Grid/List View] [Sort] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│ │ Folder   │ │ Folder   │ │ File     │               │
│ │ Icon     │ │ Icon     │ │ Icon     │               │
│ │ Name     │ │ Name     │ │ Name     │               │
│ │ Metadata │ │ Metadata │ │ Metadata │               │
│ └──────────┘ └──────────┘ └──────────┘               │
│                                                         │
│ [Pagination Controls]                                   │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Breadcrumb` - Folder navigation
- `Button` - Toolbar actions
- `Card` - Folder/file cards
- `Dropdown Menu` - Sort/filter menu
- `Badge` - Scope indicators (company/department/division)
- `Avatar` - Folder icons
- `Dialog` - Upload modal
- `Tabs` - Grid/List view toggle

**Folder/File Card Components:**
- `Card` - Container
- `CardHeader` - Thumbnail/icon area
- `CardTitle` - Name
- `CardDescription` - Metadata (size, date, scope)
- `CardFooter` - Action buttons
- `Badge` - Scope badge (company-wide, dept-wide, etc.)
- `Dropdown Menu` - Context menu (More options)

### 3.2 File Upload Modal
**Route**: Modal/Dialog

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ Upload Files              [X Close] │
├─────────────────────────────────────┤
│                                     │
│ ┌───────────────────────────────┐  │
│ │  Drag & Drop Area             │  │
│ │  or click to browse           │  │
│ └───────────────────────────────┘  │
│                                     │
│ Selected Files:                     │
│ ┌───────────────────────────────┐  │
│ │ file1.pdf     [X] [Edit Meta] │  │
│ │ file2.doc     [X] [Edit Meta] │  │
│ └───────────────────────────────┘  │
│                                     │
│ Scope: [Company/Dept/Division]      │
│                                     │
│ [Cancel]              [Upload]      │
└─────────────────────────────────────┘
```

**Components Used:**
- `Dialog` - Modal container
- `DialogHeader` - Title section
- `DialogContent` - Main content
- `DialogFooter` - Action buttons
- `FileUpload` - Drag-drop upload area
- `Input` - File input
- `Select` - Scope selection
- `Progress` - Upload progress per file
- `Button` - Actions

### 3.3 Document Detail View
**Route**: `/documents/[fileId]`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb + Back Button                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌──────────────┐ ┌──────────────────────────────────┐ │
│ │              │ │ Document Info Panel              │ │
│ │              │ │                                  │ │
│ │ Preview      │ │ Name: document.pdf               │ │
│ │ Area         │ │ Size: 2.5 MB                     │ │
│ │              │ │ Created: Jan 1, 2024             │ │
│ │              │ │ Modified: Jan 15, 2024           │ │
│ │              │ │ Scope: Company-wide              │ │
│ │              │ │                                  │ │
│ │              │ │ Tags: [tag1] [tag2]              │ │
│ │              │ │                                  │ │
│ │              │ │ Actions:                         │ │
│ │              │ │ [Download] [Edit] [Share]        │ │
│ │              │ │                                  │ │
│ │              │ │ Versions:                        │ │
│ │              │ │ - v3 (Current)                   │ │
│ │              │ │ - v2                             │ │
│ │              │ │ - v1                             │ │
│ │              │ │                                  │ │
│ └──────────────┘ │ Notes Tab                        │ │
│                  │ [Public Notes] [Private Notes]   │ │
│                  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Tabs` - Info/Notes/Versions tabs
- `Card` - Info panel
- `Badge` - Status and tags
- `Button` - Action buttons
- `Avatar` - Document icon
- `ScrollArea` - Version list
- Document preview component (custom)
- Rich text editor for notes

### 3.4 Document Preview Component
**Route**: Part of Document Detail View

**Components:**
- PDF viewer (react-pdf or similar)
- Image viewer with zoom controls
- Office document viewer (converted preview)
- Custom controls: Zoom, Rotate, Download, Fullscreen

**shadcn/ui Components:**
- `Button` - Control buttons
- `Slider` - Zoom control
- `Dialog` - Fullscreen modal

---

## 4. Workflow Management Screens

### 4.1 Workflow Dashboard
**Route**: `/workflows`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Tabs: [All] [Assigned to Me] [My Assignments] [Completed]│
├─────────────────────────────────────────────────────────┤
│ Filters: [Status] [Department] [Date Range] [Search]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Workflow Cards:                                         │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Document: contract.pdf                           │   │
│ │ Status: In Progress                              │   │
│ │ Assigned: Legal Department                       │   │
│ │ Started: Jan 10, 2024                            │   │
│ │ Progress: [████████░░] 80%                       │   │
│ │                                                   │   │
│ │ Actions: [View] [Assign] [Complete]              │   │
│ └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Tabs` - Status filtering
- `Card` - Workflow cards
- `Badge` - Status badges
- `Progress` - Progress indicator
- `Select` - Filter dropdowns
- `Input` - Search input
- `Date Picker` - Date range filter
- `Button` - Action buttons

### 4.2 Workflow Detail View
**Route**: `/workflows/[workflowId]`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Workflow: Document Processing                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌──────────────────┐ ┌──────────────────────────────┐ │
│ │ Document Info    │ │ Workflow Timeline            │ │
│ │                  │ │                              │ │
│ │ Name: doc.pdf    │ │ ● Assigned (Jan 10)         │ │
│ │ Folder: Legal    │ │   ↓                         │ │
│ │                  │ │ ● In Progress (Jan 11)      │ │
│ │ Current Stage:   │ │   ↓                         │ │
│ │ [In Progress]    │ │ ○ Under Review              │ │
│ │                  │ │   ↓                         │ │
│ │ Assigned To:     │ │ ○ Completed                 │ │
│ │ Legal Dept       │ │                              │ │
│ │                  │ └──────────────────────────────┘ │
│ │ [Change Status]  │                                 │
│ └──────────────────┘                                 │
│                                                         │
│ Files Added:                                           │
│ ┌──────────────────────────────────────────────────┐ │
│ │ review_notes.pdf  - Added by Legal Dept          │ │
│ │ response_draft.doc - Added by John Doe           │ │
│ └──────────────────────────────────────────────────┘ │
│                                                         │
│ Notes:                                                 │
│ ┌──────────────────────────────────────────────────┐ │
│ │ [Add Note] (Public/Private toggle)               │ │
│ │ [Rich Text Editor]                               │ │
│ └──────────────────────────────────────────────────┘ │
│                                                         │
│ Actions:                                               │
│ [Send to Secretary] [Add Actions] [Route to Dept]     │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Card` - Sections
- `Timeline` - Workflow progress (custom)
- `Badge` - Status badges
- `Table` - Files list with attribution
- Rich text editor - Notes
- `Button` - Action buttons
- `Select` - Status change dropdown
- `Dialog` - Routing modal

### 4.3 Assign Document Modal
**Route**: Modal/Dialog

**Layout:**
```
┌─────────────────────────────────────┐
│ Assign Document         [X Close]   │
├─────────────────────────────────────┤
│                                     │
│ Document: contract.pdf              │
│                                     │
│ Assign To:                          │
│ ○ Department                        │
│ ○ Division                          │
│ ○ Individual                        │
│                                     │
│ [Search/Select Dropdown]            │
│                                     │
│ Notification:                       │
│ ☑ Send email notification          │
│ ☑ Send in-app notification         │
│                                     │
│ Message (optional):                 │
│ [Textarea]                          │
│                                     │
│ [Cancel]              [Assign]      │
└─────────────────────────────────────┘
```

**Components Used:**
- `Dialog` - Modal
- `Radio Group` - Assignment type
- `Command` - Searchable select
- `Checkbox` - Notification options
- `Textarea` - Optional message
- `Button` - Actions

---

## 5. Actions & Resolutions Dashboard

### 5.1 Actions Dashboard
**Route**: `/actions`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Actions & Resolutions                                    │
├─────────────────────────────────────────────────────────┤
│ Tabs: [Pending] [In Progress] [Completed] [All]        │
├─────────────────────────────────────────────────────────┤
│ Filters: [Assigned To] [Department] [Due Date]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Action Cards:                                           │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Review Contract Terms                            │   │
│ │ Due: Jan 20, 2024                                │   │
│ │ Assigned: Legal Department                       │   │
│ │ Document: contract.pdf                           │   │
│ │ Status: [Pending]                                │   │
│ │                                                   │   │
│ │ [View Document] [Mark In Progress] [Complete]    │   │
│ └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Tabs` - Status filtering
- `Card` - Action cards
- `Badge` - Status and priority
- `Button` - Action buttons
- `Date Picker` - Due date display
- `Alert` - Overdue warnings

### 5.2 Management Actions Dashboard
**Route**: `/management/actions`

**Same layout as Actions Dashboard but with:**
- View all actions across company
- Filter by department/division
- Analytics widgets (completed rate, overdue count)
- Export functionality

**Additional Components:**
- `Chart` - Analytics charts (recharts or similar)
- `DataTable` - Exportable table view

---

## 6. External Documents Workflow

### 6.1 Receptionist Upload Interface
**Route**: `/external-documents/upload`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Upload External Document                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Step 1: Upload Document                                 │
│ ┌──────────────────────────────────────────────────┐   │
│ │ [Drag & Drop Upload Area]                        │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ Step 2: Contact Information                            │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Name: [Input]                                    │   │
│ │ Email: [Input]                                   │   │
│ │ Phone: [Input]                                   │   │
│ │ Company: [Input]                                 │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ Step 3: Document Details                               │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Document Type: [Select]                          │   │
│ │ Description: [Textarea]                          │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ Acknowledgment Preview:                                │
│ [Preview Watermarked PDF]                              │
│                                                         │
│ ☑ Send acknowledgment email                            │
│                                                         │
│ [Cancel]                    [Upload & Send]            │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Card` - Step containers
- `FileUpload` - Document upload
- `Input` - Contact fields
- `Select` - Document type
- `Textarea` - Description
- `Checkbox` - Email option
- `Button` - Actions
- PDF preview component

### 6.2 External Documents Queue
**Route**: `/external-documents`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ External Documents Queue                                 │
├─────────────────────────────────────────────────────────┤
│ Tabs: [Pending Filing] [Filed] [Acknowledged]          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Document List:                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ From: John Doe (john@example.com)                │   │
│ │ Document: application.pdf                        │   │
│ │ Received: Jan 15, 2024                           │   │
│ │ Status: Acknowledged                             │   │
│ │                                                   │   │
│ │ [View] [File Document] [Assign]                  │   │
│ └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Tabs` - Status filtering
- `Card` - Document cards
- `Badge` - Status badges
- `Button` - Actions
- `Table` - Alternative table view

---

## 7. Search & Discovery

### 7.1 Global Search
**Route**: Command Palette (Cmd+K)

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ 🔍 Search...                        │
├─────────────────────────────────────┤
│ Recent Searches:                    │
│ • contract documents                │
│ • legal department files            │
├─────────────────────────────────────┤
│ Quick Actions:                       │
│ • Create new document               │
│ • Upload files                      │
│ • Create folder                     │
├─────────────────────────────────────┤
│ Search Results: (as you type)       │
│ Files:                              │
│ • contract.pdf                      │
│ • agreement.doc                     │
│ Folders:                            │
│ • Legal Documents                   │
└─────────────────────────────────────┘
```

**Components Used:**
- `Command` - Command palette
- `CommandInput` - Search input
- `CommandList` - Results list
- `CommandGroup` - Result groups
- `CommandItem` - Individual results

### 7.2 Advanced Search Page
**Route**: `/search`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Advanced Search                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌──────────────────┐ ┌──────────────────────────────┐ │
│ │ Search Filters   │ │ Search Results               │ │
│ │                  │ │                              │ │
│ │ Query:           │ │ Found 25 results             │ │
│ │ [Input]          │ │                              │ │
│ │                  │ │ ┌──────────────────────────┐ │ │
│ │ File Type:       │ │ │ document.pdf             │ │ │
│ │ [Multi-select]   │ │ │ Legal/Contracts          │ │ │
│ │                  │ │ │ Modified: Jan 15         │ │ │
│ │ Date Range:      │ │ └──────────────────────────┘ │ │
│ │ [Date Picker]    │ │                              │ │
│ │                  │ │ [Pagination]                │ │
│ │ Department:      │ │                              │ │
│ │ [Select]         │ │                              │ │
│ │                  │ │                              │ │
│ │ Tags:            │ │                              │ │
│ │ [Multi-select]   │ │                              │ │
│ │                  │ │                              │ │
│ │ Scope:           │ │                              │ │
│ │ ☑ Company-wide   │ │                              │ │
│ │ ☑ Department     │ │                              │ │
│ │ ☑ Division       │ │                              │ │
│ │                  │ │                              │ │
│ │ [Reset] [Search] │ │                              │ │
│ └──────────────────┘ └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Card` - Filter panel and results
- `Input` - Search query
- `Select` - Filter dropdowns
- `Date Picker` - Date range
- `Checkbox` - Scope filters
- `Button` - Actions
- `Table` or `Card` - Results display
- `Pagination` - Results pagination

---

## 8. User Management Screens

### 8.1 User Management Dashboard (Admin)
**Route**: `/admin/users`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ User Management                      [+ Invite User]    │
├─────────────────────────────────────────────────────────┤
│ Search: [Input]  Filter: [Role] [Department] [Status]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Users Table:                                            │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Name    │ Email      │ Role      │ Dept   │ Actions│ │
│ ├──────────────────────────────────────────────────┤   │
│ │ John D. │ john@...   │ Staff     │ Legal  │ [Edit] │ │
│ │ Jane S. │ jane@...   │ Manager   │ HR     │ [Edit] │ │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ [Pagination]                                            │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `DataTable` - Advanced table with sorting/filtering
- `Button` - Invite user button
- `Input` - Search
- `Select` - Filters
- `Dropdown Menu` - Row actions
- `Avatar` - User avatars in table
- `Badge` - Role badges
- `Dialog` - Invite user modal

### 8.2 Invite User Modal
**Route**: Modal/Dialog

**Layout:**
```
┌─────────────────────────────────────┐
│ Invite User             [X Close]   │
├─────────────────────────────────────┤
│                                     │
│ Email: [Input]                      │
│                                     │
│ Role: [Select Dropdown]             │
│                                     │
│ Company: [Select]                   │
│                                     │
│ Department: [Select]                │
│                                     │
│ Division: [Select]                  │
│                                     │
│ Send Invitation Email:              │
│ ☑ Yes                               │
│                                     │
│ [Cancel]              [Send Invite] │
└─────────────────────────────────────┘
```

**Components Used:**
- `Dialog` - Modal
- `Input` - Email field
- `Select` - Role, company, department, division
- `Checkbox` - Email option
- `Button` - Actions

### 8.3 User Profile Page
**Route**: `/profile` or `/users/[userId]`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ User Profile                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌──────────────────┐                                   │
│ │ [Avatar]         │                                   │
│ │                  │                                   │
│ │ John Doe         │                                   │
│ │ john@example.com │                                   │
│ │ Staff            │                                   │
│ │ Legal Department │                                   │
│ └──────────────────┘                                   │
│                                                         │
│ Tabs: [Profile] [Activity] [Documents] [Permissions]  │
│                                                         │
│ Profile Tab:                                           │
│ - Name: [Editable]                                     │
│ - Email: [Display]                                     │
│ - Phone: [Editable]                                    │
│ - Department: [Display]                                │
│ - Role: [Display]                                      │
│                                                         │
│ [Save Changes]                                         │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Card` - Profile card
- `Avatar` - User avatar
- `Tabs` - Profile sections
- `Input` - Editable fields
- `Button` - Save button
- `Table` - Activity/Documents tables

---

## 9. Admin Dashboard Screens

### 9.1 Admin Dashboard
**Route**: `/admin/dashboard`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Admin Dashboard                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Stats Cards:                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ Total    │ │ Active   │ │ Storage  │ │ Users    │  │
│ │ Docs     │ │ Workflows│ │ Used     │ │          │  │
│ │ 1,234    │ │ 45       │ │ 45 GB    │ │ 156      │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│ Charts Section:                                         │
│ ┌──────────────────┐ ┌──────────────────────────────┐ │
│ │ Document Activity│ │ Storage Usage Over Time      │ │
│ │ [Chart]          │ │ [Chart]                      │ │
│ └──────────────────┘ └──────────────────────────────┘ │
│                                                         │
│ Recent Activity:                                        │
│ [Activity Feed Table]                                   │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Card` - Stat cards
- `Chart` - Analytics charts (recharts)
- `Table` - Activity table
- `Progress` - Storage progress
- `Badge` - Status indicators

### 9.2 Company Management
**Route**: `/admin/companies`

**Similar to User Management but for companies:**
- Company list table
- Create company modal
- Company settings page
- Department/Division management

**Components Used:**
- `DataTable` - Companies table
- `Dialog` - Create/Edit modals
- `Tabs` - Company details tabs
- Tree view for departments/divisions

---

## 10. Notification Center

### 10.1 Notification Dropdown
**Route**: Header component

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ Notifications (3)        [Mark All] │
├─────────────────────────────────────┤
│ • New document assigned             │
│   contract.pdf                       │
│   2 hours ago                        │
│                                     │
│ • Action completed                  │
│   Review contract terms             │
│   5 hours ago                        │
│                                     │
│ • Access request approved           │
│   Legal Documents folder            │
│   1 day ago                          │
│                                     │
│ [View All Notifications]            │
└─────────────────────────────────────┘
```

**Components Used:**
- `Dropdown Menu` - Notification dropdown
- `Badge` - Unread count on bell icon
- `Card` - Notification items
- `Button` - Actions
- `ScrollArea` - Scrollable list

### 10.2 Notification Preferences Page
**Route**: `/settings/notifications`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Notification Preferences                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Notification Type:     Email    In-App                  │
│ ──────────────────────────────────────────             │
│ Document Assignments   ☑         ☑                     │
│ Access Requests        ☑         ☑                     │
│ Action Items           ☑         ☑                     │
│ Workflow Updates       ☐         ☑                     │
│ Comments               ☐         ☑                     │
│                                                         │
│ [Save Preferences]                                     │
└─────────────────────────────────────────────────────────┘
```

**Components Used:**
- `Card` - Preferences container
- `Switch` - Toggle switches
- `Table` - Preferences table
- `Button` - Save button

---

## 11. Settings & Preferences

### 11.1 Settings Page
**Route**: `/settings`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Settings                                                │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar: │  Settings Content                           │
│          │                                              │
│ - Profile│  Tabs: [Profile] [Notifications] [Security] │
│ - Notify │                                              │
│ - Security│  [Settings Form Content]                    │
│ - Theme  │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Components Used:**
- `Tabs` - Settings sections
- `Card` - Setting groups
- `Input` - Form fields
- `Switch` - Toggle settings
- `Select` - Dropdown settings
- `Button` - Save buttons

---

## 12. Mobile Responsive Layouts

### 12.1 Mobile Navigation
- Hamburger menu for sidebar
- Bottom navigation bar for key actions
- Swipe gestures for navigation

### 12.2 Mobile Dashboard
- Stacked stat cards
- Simplified table views
- Touch-friendly buttons
- Mobile-optimized file upload

### 12.3 Mobile Document View
- Full-screen preview
- Swipe between documents
- Bottom sheet for actions
- Simplified info panel

**Components Used:**
- `Sheet` - Mobile side panels
- `Drawer` - Bottom drawers
- Responsive `Card` layouts
- Mobile-optimized `Table` views

---

## 13. Common UI Patterns

### 13.1 Loading States
**Components:**
- `Skeleton` - Loading placeholders for cards, tables
- `Spinner` - Loading indicators
- `Progress` - Progress bars

### 13.2 Error States
**Components:**
- `Alert` - Error messages
- `AlertDialog` - Error confirmation dialogs
- Empty states with illustrations

### 13.3 Empty States
**Components:**
- `Card` - Empty state container
- Custom illustrations
- `Button` - Action buttons (Create, Upload)

### 13.4 Confirmation Dialogs
**Components:**
- `AlertDialog` - Confirm actions
- `Dialog` - Custom confirmation modals

---

## 14. Component Library Reference

### Essential shadcn/ui Components to Install

1. **Layout**
   - `card`
   - `separator`
   - `scroll-area`

2. **Navigation**
   - `tabs`
   - `navigation-menu`
   - `breadcrumb`
   - `sidebar` (custom or shadcn)
   - `command`

3. **Data Display**
   - `table`
   - `badge`
   - `avatar`
   - `progress`
   - `skeleton`

4. **Forms**
   - `button`
   - `input`
   - `textarea`
   - `select`
   - `checkbox`
   - `radio-group`
   - `switch`
   - `label`
   - `form` (react-hook-form integration)

5. **Overlays**
   - `dialog`
   - `sheet`
   - `dropdown-menu`
   - `popover`
   - `tooltip`
   - `alert-dialog`

6. **Feedback**
   - `alert`
   - `toast`
   - `sonner` (toast library)

7. **Date/Time**
   - `calendar`
   - `date-picker` (custom component)

8. **Rich Text**
   - Tiptap editor (separate library, styled with Tailwind)

### Additional Libraries Needed

- **Charts**: Recharts or Chart.js
- **File Upload**: react-dropzone
- **PDF Viewer**: react-pdf or @react-pdf-viewer
- **Date Picker**: react-day-picker
- **Table**: TanStack Table (react-table)
- **Icons**: lucide-react (already included with shadcn)

---

## 15. Design Tokens & Theme

### Colors
- Primary: Company brand color
- Secondary: Complementary color
- Success: Green shades
- Warning: Yellow/Orange shades
- Error: Red shades
- Neutral: Gray shades

### Typography
- Font Family: Inter (or system default)
- Headings: Bold, larger sizes
- Body: Regular weight, readable sizes
- Code: Monospace font

### Spacing
- Base unit: 4px
- Consistent spacing scale (4, 8, 12, 16, 24, 32, 48, 64)

### Shadows
- Subtle shadows for elevation
- Consistent shadow scale

### Border Radius
- Small: 4px
- Medium: 8px
- Large: 12px

---

## 16. Responsive Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px
- **Large Desktop**: > 1280px

### Mobile-First Approach
- Design for mobile first
- Progressive enhancement for larger screens
- Touch-friendly targets (min 44x44px)

---

## 17. Accessibility Considerations

- Keyboard navigation support
- Screen reader compatibility
- ARIA labels on interactive elements
- Focus indicators
- Color contrast ratios (WCAG AA)
- Alt text for images/icons

---

## 18. Animation & Transitions

- Smooth page transitions
- Loading state animations
- Hover effects on interactive elements
- Modal/dialog animations
- List item animations

**Libraries:**
- Framer Motion (for complex animations)
- CSS transitions (for simple animations)

---

## Implementation Priority

### Phase 1: Core Layouts
1. Authentication screens
2. Main dashboard layout
3. Sidebar navigation
4. Header component

### Phase 2: Document Management
1. Folder/file browser
2. File upload modal
3. Document detail view
4. Document preview

### Phase 3: Workflow & Actions
1. Workflow dashboard
2. Workflow detail view
3. Actions dashboard
4. Assignment modals

### Phase 4: Advanced Features
1. Search interface
2. User management
3. Admin dashboards
4. Settings pages

### Phase 5: Polish
1. Mobile responsive
2. Animations
3. Loading states
4. Error handling
5. Empty states

---

This design plan provides a comprehensive structure for building all frontend screens using shadcn/ui components with a consistent, modern, and accessible design system.
