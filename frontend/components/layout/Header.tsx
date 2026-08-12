"use client";

import { Search, PanelLeft, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CommandDialogComponent as CommandDialog } from "@/components/common/CommandDialog";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotificationDropdown } from "@/components/common/NotificationDropdown";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { FontSizeToggle } from "@/components/layout/FontSizeToggle";
import { MobileNav } from "@/components/layout/MobileNav";
import { useSidebarCollapse } from "@/components/layout/SidebarCollapse";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { api } from "@/lib/api";
import { seesAllCompanies } from "@/lib/permissions";

export function Header() {
  const [openCommand, setOpenCommand] = useState(false);
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: companies = [] } = useCompanies();
  const { permissions } = usePermissions();
  const { collapsed, toggle } = useSidebarCollapse();

  // ⌘K / Ctrl+K opens the command palette (same entry as the search button).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      // Ignore when typing in native dialogs that manage their own shortcuts.
      event.preventDefault();
      setOpenCommand((open) => !open);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      // Call logout API to clear cookies
      await api.logout();
    } catch (error) {
      console.warn("Logout API call failed:", error);
    }
    
    // Clear local storage
    localStorage.removeItem("mockCurrentUser");
    localStorage.removeItem("mockAuth");
    localStorage.removeItem("access_token");
    localStorage.removeItem("authToken");
    try {
      sessionStorage.removeItem("dt_csrf_token");
    } catch {
      // ignore
    }

    // Redirect to login and force reload to clear React Query cache
    window.location.href = "/login";
  };

  // Get company name for current user
  const companyName = useMemo(() => {
    if (!currentUser || !companies.length) return null;
    if (seesAllCompanies(currentUser)) return "All Companies";
    const company = companies.find((c: any) => c.id === currentUser.companyId);
    return company?.name || null;
  }, [currentUser, companies]);

  // Get user initials
  const getInitials = (user: any) => {
    if (!user) return "U";
    if (user.name) {
      return user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 min-w-0 items-center justify-between gap-2 px-4">
        {/* Logo and Search */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <MobileNav />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 shrink-0 md:inline-flex"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
          <div className="flex min-w-0 shrink items-center gap-3">
            <div className="font-display truncate text-lg font-bold tracking-tight">
              DocTracker
            </div>
            {companyName && (
              <>
                <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                {/* Which company's records you are looking at is the first thing
                    to establish — most confusion here is cross-company. */}
                <span className="stamp hidden truncate text-muted-foreground sm:inline">
                  {companyName}
                </span>
              </>
            )}
          </div>

          {/* Global Search - Trigger Command Dialog */}
          <Button
            variant="outline"
            className="relative h-9 min-w-0 max-w-[12rem] flex-1 justify-start text-sm text-muted-foreground sm:max-w-xs sm:w-64 sm:flex-none sm:pr-12"
            onClick={() => setOpenCommand(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden truncate sm:inline-flex">Search...</span>
            <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              ⌘K
            </kbd>
          </Button>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden sm:flex">
            <FontSizeToggle />
          </div>
          <ThemeToggle />

          {/* Notifications */}
          <NotificationDropdown />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full"
                aria-label="User menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{getInitials(currentUser)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="truncate font-medium">
                  {currentUser?.name ?? "Signed in"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {currentUser?.email}
                </div>
                {/* Role is shown here because almost every "why can't I do X"
                    question starts with the person not knowing their own role. */}
                <div className="stamp mt-2 text-muted-foreground">
                  {permissions.role}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Command Dialog */}
      <CommandDialog open={openCommand} onOpenChange={setOpenCommand} />
    </header>
  );
}
