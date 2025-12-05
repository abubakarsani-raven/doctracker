"use client";

import * as React from "react";
import { Search, FileText, Folder, Users, Settings } from "lucide-react";
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

  const runCommand = React.useCallback((command: () => void) => {
    onOpenChange(false);
    command();
  }, [onOpenChange]);

  // Mock recent searches - replace with real data
  const recentSearches = [
    "contract documents",
    "legal department files",
  ];

  // Quick actions
  const quickActions = [
    {
      icon: FileText,
      label: "Create new document",
      command: () => runCommand(() => router.push("/documents/new")),
    },
    {
      icon: Folder,
      label: "Upload files",
      command: () => runCommand(() => router.push("/documents/upload")),
    },
    {
      icon: Folder,
      label: "Create folder",
      command: () => runCommand(() => router.push("/documents/folder/new")),
    },
  ];

  return (
    <CommandDialogPrimitive open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search documents, folders, or actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <>
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((search) => (
                <CommandItem
                  key={search}
                  onSelect={() => runCommand(() => setSearch(search))}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {search}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
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

        {/* Search Results - Will be populated with actual search */}
        {search && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Results">
              {/* Results will be populated here */}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialogPrimitive>
  );
}
