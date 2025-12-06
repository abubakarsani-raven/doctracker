"use client";

import * as React from "react";
import { Search, FileText, Folder, Users, Settings, Workflow } from "lucide-react";
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

interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandDialogComponent({
  open,
  onOpenChange,
}: CommandDialogProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  
  // Fetch data for search
  const { data: documents = [] } = useDocuments();
  const { data: folders = [] } = useFolders();
  const { data: workflows = [] } = useWorkflows();
  const { data: actions = [] } = useActions();

  const runCommand = React.useCallback((command: () => void) => {
    onOpenChange(false);
    command();
  }, [onOpenChange]);

  // Filter search results
  const searchResults = React.useMemo(() => {
    if (!search.trim()) return { documents: [], folders: [], workflows: [], actions: [] };

    const query = search.toLowerCase();
    
    const filteredDocuments = documents.filter((doc: any) =>
      doc.name?.toLowerCase().includes(query) ||
      doc.description?.toLowerCase().includes(query)
    ).slice(0, 5);

    const filteredFolders = folders.filter((folder: any) =>
      folder.name?.toLowerCase().includes(query) ||
      folder.description?.toLowerCase().includes(query)
    ).slice(0, 5);

    const filteredWorkflows = workflows.filter((workflow: any) =>
      workflow.title?.toLowerCase().includes(query) ||
      workflow.description?.toLowerCase().includes(query)
    ).slice(0, 5);

    const filteredActions = actions.filter((action: any) =>
      action.title?.toLowerCase().includes(query) ||
      action.description?.toLowerCase().includes(query)
    ).slice(0, 5);

    return {
      documents: filteredDocuments,
      folders: filteredFolders,
      workflows: filteredWorkflows,
      actions: filteredActions,
    };
  }, [search, documents, folders, workflows, actions]);

  const hasResults = searchResults.documents.length > 0 ||
    searchResults.folders.length > 0 ||
    searchResults.workflows.length > 0 ||
    searchResults.actions.length > 0;

  // Quick actions
  const quickActions = [
    {
      icon: FileText,
      label: "Create new document",
      command: () => runCommand(() => router.push("/documents")),
    },
    {
      icon: Folder,
      label: "Create folder",
      command: () => runCommand(() => router.push("/documents")),
    },
  ];

  return (
    <CommandDialogPrimitive open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search documents, folders, or actions..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {!search.trim() ? (
          <>
            {/* Quick Actions - only show when no search */}
            <CommandGroup heading="Quick Actions">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.label}
                    onSelect={action.command}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        ) : hasResults ? (
          <>
            {/* Search Results */}
            {searchResults.documents.length > 0 && (
              <>
                <CommandGroup heading="Documents">
                  {searchResults.documents.map((doc: any) => (
                    <CommandItem
                      key={doc.id}
                      onSelect={() => runCommand(() => router.push(`/documents/${doc.id}`))}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <span>{doc.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {searchResults.folders.length > 0 && (
              <>
                <CommandGroup heading="Folders">
                  {searchResults.folders.map((folder: any) => (
                    <CommandItem
                      key={folder.id}
                      onSelect={() => runCommand(() => router.push(`/documents/folder/${folder.id}`))}
                    >
                      <Folder className="mr-2 h-4 w-4" />
                      <span>{folder.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {searchResults.workflows.length > 0 && (
              <>
                <CommandGroup heading="Workflows">
                  {searchResults.workflows.map((workflow: any) => (
                    <CommandItem
                      key={workflow.id}
                      onSelect={() => runCommand(() => router.push(`/workflows/${workflow.id}`))}
                    >
                      <Workflow className="mr-2 h-4 w-4" />
                      <span>{workflow.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {searchResults.actions.length > 0 && (
              <CommandGroup heading="Actions">
                {searchResults.actions.map((action: any) => (
                  <CommandItem
                    key={action.id}
                    onSelect={() => runCommand(() => router.push(`/actions/${action.id}`))}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span>{action.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        ) : (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
      </CommandList>
    </CommandDialogPrimitive>
  );
}
