"use client";

import * as React from "react";
import {
  FileText,
  Folder,
  FolderPlus,
  Users,
  Settings,
  Workflow,
  LayoutDashboard,
  CheckSquare,
  Archive,
  Target,
  BookTemplate,
  Building2,
  ShieldCheck,
  FileCheck,
  BarChart3,
  HardDrive,
  Upload,
} from "lucide-react";
import {
  CommandDialog as CommandDialogPrimitive,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { useDocuments } from "@/lib/hooks/use-documents";
import { useFolders } from "@/lib/hooks/use-documents";
import { useWorkflows } from "@/lib/hooks/use-workflows";
import { useActions } from "@/lib/hooks/use-actions";
import { usePermissions } from "@/lib/hooks/use-permissions";
import type { Capability } from "@/lib/permissions";

interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PaletteAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  /** Capability required to show this action. Omit = always shown when signed in. */
  requires?: Capability;
  /** Extra predicate (e.g. Master-only admin). */
  when?: boolean;
};

export function CommandDialogComponent({
  open,
  onOpenChange,
}: CommandDialogProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const { can, isMaster, ready } = usePermissions();

  const canViewDocs = can("documents.view");
  const canViewWorkflows = can("workflows.view");
  // Actions list is available to anyone who can complete or assign work.
  const canViewActions = can("actions.complete") || can("actions.assign");

  const { data: documents = [] } = useDocuments();
  const { data: folders = [] } = useFolders();
  const { data: workflows = [] } = useWorkflows();
  const { data: actions = [] } = useActions();

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      setSearch("");
      command();
    },
    [onOpenChange],
  );

  const go = React.useCallback(
    (href: string) => runCommand(() => router.push(href)),
    [runCommand, router],
  );

  const quickActions = React.useMemo((): PaletteAction[] => {
    const items: PaletteAction[] = [
      {
        id: "create-document",
        label: "Create new document",
        icon: FileText,
        href: "/documents",
        requires: "documents.create",
      },
      {
        id: "upload-document",
        label: "Upload document",
        icon: Upload,
        href: "/documents",
        requires: "documents.create",
      },
      {
        id: "create-folder",
        label: "Create folder",
        icon: FolderPlus,
        href: "/documents",
        requires: "folders.create",
      },
      {
        id: "create-workflow",
        label: "Create workflow",
        icon: Workflow,
        href: "/workflows",
        requires: "workflows.create",
      },
      {
        id: "invite-user",
        label: "Invite user",
        icon: Users,
        href: "/users",
        requires: "users.manage",
      },
    ];

    return items.filter((item) => {
      if (item.when === false) return false;
      if (!item.requires) return true;
      return ready && can(item.requires);
    });
  }, [can, ready]);

  const navigation = React.useMemo((): PaletteAction[] => {
    const items: PaletteAction[] = [
      { id: "nav-dashboard", label: "Go to Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      {
        id: "nav-documents",
        label: "Go to Documents",
        icon: Folder,
        href: "/documents",
        requires: "documents.view",
      },
      {
        id: "nav-workflows",
        label: "Go to Workflows",
        icon: Workflow,
        href: "/workflows",
        requires: "workflows.view",
      },
      {
        id: "nav-actions",
        label: "Go to Actions",
        icon: CheckSquare,
        href: "/actions",
      },
      {
        id: "nav-goals",
        label: "Go to My Goals",
        icon: Target,
        href: "/my-goals",
      },
      {
        id: "nav-templates",
        label: "Go to Templates",
        icon: BookTemplate,
        href: "/templates",
        requires: "documents.create",
      },
      {
        id: "nav-archived",
        label: "Go to Archived",
        icon: Archive,
        href: "/archived",
      },
      {
        id: "nav-users",
        label: "Go to Users",
        icon: Users,
        href: "/users",
        requires: "users.view",
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        icon: Settings,
        href: "/settings",
      },
      {
        id: "nav-admin",
        label: "Go to Admin Dashboard",
        icon: LayoutDashboard,
        href: "/admin/dashboard",
        requires: "reports.view",
      },
      {
        id: "nav-companies",
        label: "Go to Companies",
        icon: Building2,
        href: "/admin/companies",
        when: isMaster,
      },
      {
        id: "nav-approvals",
        label: "Go to Approvals",
        icon: ShieldCheck,
        href: "/approvals",
        requires: "approvals.review",
      },
      {
        id: "nav-access-requests",
        label: "Go to Access Requests",
        icon: FileCheck,
        href: "/access-requests",
        requires: "access_requests.review",
      },
      {
        id: "nav-reports",
        label: "Go to Reports",
        icon: BarChart3,
        href: "/admin/reports",
        requires: "reports.view",
      },
      {
        id: "nav-storage",
        label: "Go to Storage",
        icon: HardDrive,
        href: "/admin/storage",
        requires: "storage.view",
      },
    ];

    return items.filter((item) => {
      if (item.when === false) return false;
      if (!item.requires) return true;
      return ready && can(item.requires);
    });
  }, [can, isMaster, ready]);

  const searchResults = React.useMemo(() => {
    if (!search.trim()) {
      return { documents: [], folders: [], workflows: [], actions: [] };
    }

    const query = search.toLowerCase();

    const filteredDocuments = canViewDocs
      ? documents
          .filter(
            (doc: any) =>
              doc.name?.toLowerCase().includes(query) ||
              doc.description?.toLowerCase().includes(query),
          )
          .slice(0, 5)
      : [];

    const filteredFolders = canViewDocs
      ? folders
          .filter(
            (folder: any) =>
              folder.name?.toLowerCase().includes(query) ||
              folder.description?.toLowerCase().includes(query),
          )
          .slice(0, 5)
      : [];

    const filteredWorkflows = canViewWorkflows
      ? workflows
          .filter(
            (workflow: any) =>
              workflow.title?.toLowerCase().includes(query) ||
              workflow.description?.toLowerCase().includes(query),
          )
          .slice(0, 5)
      : [];

    const filteredActions = canViewActions
      ? actions
          .filter(
            (action: any) =>
              action.title?.toLowerCase().includes(query) ||
              action.description?.toLowerCase().includes(query),
          )
          .slice(0, 5)
      : [];

    return {
      documents: filteredDocuments,
      folders: filteredFolders,
      workflows: filteredWorkflows,
      actions: filteredActions,
    };
  }, [
    search,
    documents,
    folders,
    workflows,
    actions,
    canViewDocs,
    canViewWorkflows,
    canViewActions,
  ]);

  const filteredQuickActions = React.useMemo(() => {
    if (!search.trim()) return quickActions;
    const q = search.toLowerCase();
    return quickActions.filter((a) => a.label.toLowerCase().includes(q));
  }, [quickActions, search]);

  const filteredNavigation = React.useMemo(() => {
    if (!search.trim()) return navigation;
    const q = search.toLowerCase();
    return navigation.filter((a) => a.label.toLowerCase().includes(q));
  }, [navigation, search]);

  const hasResults =
    filteredQuickActions.length > 0 ||
    filteredNavigation.length > 0 ||
    searchResults.documents.length > 0 ||
    searchResults.folders.length > 0 ||
    searchResults.workflows.length > 0 ||
    searchResults.actions.length > 0;

  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <CommandDialogPrimitive open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search or jump to…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {!hasResults ? (
          <CommandEmpty>
            {ready
              ? "No matching actions for your role."
              : "Loading your permissions…"}
          </CommandEmpty>
        ) : (
          <>
            {filteredQuickActions.length > 0 && (
              <CommandGroup heading="Quick Actions">
                {filteredQuickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <CommandItem
                      key={action.id}
                      value={action.label}
                      onSelect={() => action.href && go(action.href)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {action.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {filteredNavigation.length > 0 && (
              <>
                {filteredQuickActions.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Navigate">
                  {filteredNavigation.map((action) => {
                    const Icon = action.icon;
                    return (
                      <CommandItem
                        key={action.id}
                        value={action.label}
                        onSelect={() => action.href && go(action.href)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {action.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            {search.trim() && searchResults.documents.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Documents">
                  {searchResults.documents.map((doc: any) => (
                    <CommandItem
                      key={doc.id}
                      value={`doc ${doc.name}`}
                      onSelect={() => go(`/documents/${doc.id}`)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <span>{doc.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {search.trim() && searchResults.folders.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Folders">
                  {searchResults.folders.map((folder: any) => (
                    <CommandItem
                      key={folder.id}
                      value={`folder ${folder.name}`}
                      onSelect={() => go(`/documents/folder/${folder.id}`)}
                    >
                      <Folder className="mr-2 h-4 w-4" />
                      <span>{folder.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {search.trim() && searchResults.workflows.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Workflows">
                  {searchResults.workflows.map((workflow: any) => (
                    <CommandItem
                      key={workflow.id}
                      value={`workflow ${workflow.title}`}
                      onSelect={() => go(`/workflows/${workflow.id}`)}
                    >
                      <Workflow className="mr-2 h-4 w-4" />
                      <span>{workflow.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {search.trim() && searchResults.actions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  {searchResults.actions.map((action: any) => (
                    <CommandItem
                      key={action.id}
                      value={`action ${action.title}`}
                      onSelect={() => go(`/actions/${action.id}`)}
                    >
                      <CheckSquare className="mr-2 h-4 w-4" />
                      <span>{action.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialogPrimitive>
  );
}
