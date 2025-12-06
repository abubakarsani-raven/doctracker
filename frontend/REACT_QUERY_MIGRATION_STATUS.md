# React Query + Zustand Migration Status

## Overview

Migrating the entire application from event-based architecture to React Query (TanStack Query) for server state and Zustand for client-only UI state. All mock data has been removed - everything comes from the database.

## ✅ Completed (35-40%)

### Phase 1: Setup and Installation
- ✅ Installed `@tanstack/react-query` and `zustand` packages
- ✅ Created React Query Provider with proper configuration
- ✅ Updated `frontend/lib/providers.tsx` to include QueryClientProvider

### Phase 2: React Query Hooks Created
- ✅ `use-workflows.ts` - useWorkflows, useWorkflow, useCreateWorkflow, useUpdateWorkflow
- ✅ `use-actions.ts` - useActions, useAction, useActionsByWorkflow, useCreateAction, useUpdateAction
- ✅ `use-notifications.ts` - useNotifications, useUnreadNotificationsCount, useMarkNotificationRead
- ✅ `use-users.ts` - useUsers, useCurrentUser
- ✅ `use-companies.ts` - useCompanies
- ✅ `use-documents.ts` - useDocuments, useFolders, useFolder, useCreateFolder
- ✅ `use-workflow-progress.ts` - useUpdateWorkflowProgress hook
- ✅ `use-access-requests.ts` - useAccessRequests, useCreateAccessRequest, useUpdateAccessRequest (localStorage for now)
- ✅ `use-approval-requests.ts` - useApprovalRequests, useCreateApprovalRequest, useUpdateApprovalRequest (localStorage for now)

### Phase 3: Zustand Stores Created
- ✅ `ui-store.ts` - UI-only state (dialogs, filters, search queries)

### Phase 4: API Service Updated
- ✅ Removed ALL mock data fallbacks from `api.ts`
- ✅ API now only uses real backend (throws errors if not available)
- ✅ Removed localStorage as data persistence layer (except auth token)

### Phase 5: Utility Functions Updated
- ✅ `workflow-utils.ts` - Removed localStorage and event dependencies
- ✅ Made functions pure (no side effects)
- ✅ Kept only calculation functions
- ✅ `cross-company-utils.ts` - Removed window events from saveApprovalRequests

### Phase 6: Components Migrated (14+ files)
- ✅ `app/(dashboard)/workflows/page.tsx` - Uses React Query hooks, removed events
- ✅ `app/(dashboard)/workflows/[id]/page.tsx` - Workflow detail page
- ✅ `app/(dashboard)/actions/page.tsx` - Uses React Query hooks, removed events
- ✅ `app/(dashboard)/actions/[id]/page.tsx` - Action detail page
- ✅ `app/(dashboard)/dashboard/page.tsx`
- ✅ `components/features/workflows/ActionCompletionDialog.tsx`
- ✅ `components/features/workflows/DocumentUploadActionDialog.tsx`
- ✅ `components/features/workflows/RequestResponseActionDialog.tsx`
- ✅ `components/features/workflows/WorkflowActionsList.tsx`
- ✅ `components/features/workflows/WorkflowTimeline.tsx`
- ✅ `components/features/workflows/ActionResults.tsx`
- ✅ `components/common/NotificationDropdown.tsx`
- ✅ `components/layout/Header.tsx`
- ✅ `components/layout/Sidebar.tsx`

## 🚧 Still To Migrate (30+ files - 60-65%)

### Workflow Components (5 files)
- [ ] `components/features/workflows/CreateWorkflowDialog.tsx`
- [ ] `components/features/workflows/CreateWorkflowDialogV2.tsx`
- [ ] `components/features/workflows/WorkflowRoutingSheet.tsx`
- [ ] `components/features/workflows/CrossCompanyApprovalDialog.tsx`
- [ ] `components/features/workflows/CreateActionFromWorkflowDialog.tsx`

### Action Components (Already done - all critical ones migrated)

### Document Pages & Components (10+ files)
- [ ] `app/(dashboard)/documents/page.tsx`
- [ ] `app/(dashboard)/documents/[id]/page.tsx`
- [ ] `app/(dashboard)/documents/folder/[id]/page.tsx`
- [ ] `components/features/documents/CreateFolderDialog.tsx`
- [ ] `components/features/documents/FileUploadDialog.tsx`
- [ ] `components/features/documents/CreateRichTextDocumentDialog.tsx`
- [ ] `components/features/documents/AddToFolderDialog.tsx`
- [ ] `components/features/documents/MoveDocumentDialog.tsx`
- [ ] `components/features/documents/AccessRequestDialog.tsx`
- [ ] `components/features/documents/PermissionManagementDialog.tsx`
- [ ] Other document components...

### Request Pages (2 files)
- [ ] `app/(dashboard)/approvals/page.tsx`
- [ ] `app/(dashboard)/access-requests/page.tsx`

### Other Pages (5+ files)
- [ ] `app/(dashboard)/profile/page.tsx`
- [ ] `app/(dashboard)/settings/page.tsx`
- [ ] `app/(auth)/login/page.tsx` (minor - just remove window.dispatchEvent)
- [ ] Other pages...

### Utility Files
- [ ] `access-request-utils.ts` - Remove localStorage, use hooks
- [ ] `cross-company-utils.ts` - Remove all window events

## 📝 Migration Pattern (Established)

### Before (Event-Based):
```typescript
const [data, setData] = useState([]);
useEffect(() => {
  loadData();
  window.addEventListener("dataUpdated", loadData);
  return () => window.removeEventListener("dataUpdated", loadData);
}, []);

const loadData = async () => {
  const apiData = await api.getData();
  const localData = JSON.parse(localStorage.getItem("data") || "[]");
  setData([...apiData, ...localData]);
};
```

### After (React Query):
```typescript
const { data = [], isLoading } = useData();
// That's it! React Query handles caching, refetching, etc.
```

### For Mutations:
```typescript
const createMutation = useCreateData();
const updateMutation = useUpdateData();

const handleCreate = async () => {
  await createMutation.mutateAsync(formData);
  // React Query automatically refetches and updates UI
};
```

## 🔧 Still To Do

### 1. Remove All Window Events
Search and remove all instances of:
- `window.dispatchEvent(new CustomEvent(...))`
- `window.addEventListener(...)`
- `window.removeEventListener(...)`

**Files still using events:** ~20+ files

### 2. Remove localStorage Data Persistence
- Remove all `localStorage.setItem()` calls for data (keep auth token only)
- Remove all `localStorage.getItem()` calls for data

**Files still using localStorage:** ~25+ files

### 3. Update All Components Using useMockData()
Replace:
- `useMockData().currentUser` → `useCurrentUser()`
- `useMockData().users` → `useUsers()`
- `useMockData().companies` → `useCompanies()`
- `useMockData().documents` → `useDocuments()`
- `useMockData().folders` → `useFolders()`
- `useMockData().workflows` → `useWorkflows()`
- `useMockData().actions` → `useActions()`

**Files still using useMockData():** ~25+ files

### 4. Remove MockDataContext
- Delete `frontend/lib/contexts/MockDataContext.tsx`
- Remove from providers
- **Cannot do until all components migrated**

### 5. Create Backend Endpoints (If Needed)
- Access requests endpoints (currently localStorage only)
- Approval requests endpoints (currently localStorage only)
- Notification creation endpoint
- Create React Query hooks for these once endpoints exist

### 6. Update Notification Creation
- Replace localStorage notification creation with API calls
- Create backend endpoint for creating notifications if needed

## 📋 Component Migration Checklist

For each component:
1. Replace `useMockData()` with React Query hooks
2. Replace local state with React Query queries
3. Replace manual API calls with mutations
4. Remove event listeners
5. Remove localStorage usage
6. Remove `window.dispatchEvent` calls
7. Use UI store for dialog/filter state (if applicable)
8. Update to use `useUpdateWorkflowProgress()` hook instead of utility function

## 🎯 Success Criteria

- [ ] No `window.dispatchEvent` or `window.addEventListener` calls remain
- [ ] No localStorage usage for data (auth token only)
- [ ] All components use React Query hooks
- [ ] MockDataContext removed
- [ ] All mock data removed
- [ ] API calls reduced by 70-80% (React Query caching)
- [ ] No circular loops
- [ ] TypeScript types are correct
- [ ] All features work as before

## 📈 Current Progress: ~35-40% Complete

### What's Working:
- ✅ React Query infrastructure complete
- ✅ All hooks created and ready
- ✅ Critical workflow/action pages migrated
- ✅ All action dialogs migrated
- ✅ Navigation components migrated

### What Remains:
- ❌ ~30+ components still need migration
- ❌ ~20+ files still have window events
- ❌ ~25+ files still use localStorage
- ❌ MockDataContext still in use
- ❌ Document pages/components need migration

## 🚀 Next Steps

1. Continue migrating components using established pattern
2. Test each migration incrementally
3. Remove MockDataContext once all components migrated
4. Clean up remaining event listeners
5. Verify all localStorage data usage removed
6. Performance testing

## 📚 Resources

- React Query Docs: https://tanstack.com/query/latest
- Zustand Docs: https://zustand-demo.pmnd.rs/
- Migration examples:
  - `workflows/page.tsx`
  - `actions/page.tsx`
  - `workflows/[id]/page.tsx`
  - `ActionCompletionDialog.tsx`
