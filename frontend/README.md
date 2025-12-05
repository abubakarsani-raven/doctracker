# Document Tracker Frontend

A modern, responsive document repository and workflow management system built with Next.js 14 and shadcn/ui.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
frontend/
├── app/                      # Next.js app router pages
│   ├── (auth)/              # Authentication route group
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/         # Dashboard route group
│   │   ├── dashboard/
│   │   ├── documents/
│   │   ├── workflows/
│   │   ├── actions/
│   │   ├── external-documents/
│   │   ├── search/
│   │   ├── users/
│   │   ├── settings/
│   │   └── admin/
│   └── layout.tsx           # Root layout
├── components/
│   ├── ui/                  # shadcn/ui base components (26 components)
│   ├── layout/              # Layout components
│   ├── common/              # Reusable common components
│   └── features/            # Feature-specific components
├── lib/
│   ├── types/               # TypeScript type definitions
│   └── utils.ts             # Utility functions
└── public/                  # Static assets
```

## 🎨 Components

### Layout Components
- `DashboardLayout` - Main dashboard wrapper
- `Header` - Top navigation bar
- `Sidebar` - Side navigation menu
- `MobileNav` - Mobile navigation drawer

### Common Components
- `DocumentCard` - Document card display
- `FolderCard` - Folder card display
- `WorkflowCard` - Workflow card component
- `ActionCard` - Action/resolution card
- `StatusBadge` - Status indicator badge
- `EmptyState` - Empty state placeholder
- `LoadingState` - Loading skeleton states
- `CommandDialog` - Global search (Cmd+K)
- `NotificationDropdown` - Notification center
- `FileUpload` - Drag-and-drop file upload

### Feature Components
Organized by feature in `components/features/`:
- Documents (upload, preview, notes, versions)
- Workflows (timeline, files, routing)
- Actions (create, manage)
- External Documents (upload workflow)
- Users (invite, manage)

## 📱 Screens Built

### Authentication
- Login, Register, Forgot Password

### Main Features
- Dashboard, Documents, Workflows, Actions
- External Documents, Search, Users, Settings
- Admin Dashboard

### Detail Pages
- Document Detail, Workflow Detail, Action Detail

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: lucide-react
- **Date Formatting**: date-fns
- **Toast Notifications**: Sonner

## 📦 Available Scripts

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🎯 Design Patterns

1. **Reusability First** - Components designed for reuse
2. **Type Safety** - Full TypeScript support
3. **Component Splitting** - Files kept under 300 lines
4. **Mobile First** - Responsive design approach
5. **Accessibility** - WCAG compliant components

### Dialog & Sheet Usage

- **Dialogs**: Used for modals (file upload, forms, creation)
- **Sheets**: Used for mobile-friendly bottom sheets (workflow routing, mobile nav)

## 📝 Mock Data System

The frontend is configured to work with **mock data** from `lib/mock-data.json`, allowing you to test all features without backend/database connection.

### Testing with Mock Data

1. **Start dev server**: `npm run dev`
2. **Login**: Enter any email/password (mock auth accepts anything)
3. **Navigate**: All pages work with mock data
4. **Edit mock data**: Modify `lib/mock-data.json` to customize sample data

### Mock Data Files

- `lib/mock-data.json` - All sample data (users, documents, workflows, etc.)
- `lib/mock-api.ts` - Mock API functions
- `lib/api.ts` - API router (uses mock when `USE_MOCK_DATA = true`)
- `lib/contexts/MockDataContext.tsx` - React context for mock data

### Switching to Real Backend

When backend is ready, set `USE_MOCK_DATA = false` in `lib/mock-api.ts` and update `lib/api.ts` to use real endpoints.

## 🔄 Next Steps

1. Connect to backend API endpoints
2. Implement real authentication
3. Add file upload functionality
4. Implement search functionality
5. Add real-time notifications

## 📄 License

Private project
