"use client";

import { Search, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CommandDialogComponent as CommandDialog } from "@/components/common/CommandDialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationDropdown } from "@/components/common/NotificationDropdown";
import { useMockData } from "@/lib/contexts/MockDataContext";

export function Header() {
  const [openCommand, setOpenCommand] = useState(false);
  const router = useRouter();
  const { currentUser, companies } = useMockData();
  
  const handleLogout = () => {
    // Clear authentication
    localStorage.removeItem("mockCurrentUser");
    localStorage.removeItem("mockAuth");
    localStorage.removeItem("access_token");
    
    // Trigger event to update context
    window.dispatchEvent(new Event("mockUserChanged"));
    
    // Redirect to login
    router.push("/login");
  };
  
  // Get company name for current user
  const getCompanyName = () => {
    if (!currentUser || !companies) return null;
    if (currentUser.role === "Master") return "All Companies";
    const company = companies.find((c: any) => c.id === currentUser.companyId);
    return company?.name || null;
  };

  const companyName = getCompanyName();
  
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
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Logo and Search */}
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="font-bold text-lg">DocTracker</div>
            {companyName && (
              <div className="text-sm text-muted-foreground font-medium">
                {companyName}
              </div>
            )}
          </div>
          
          {/* Global Search - Trigger Command Dialog */}
          <Button
            variant="outline"
            className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:w-64 sm:pr-12"
            onClick={() => setOpenCommand(true)}
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline-flex">Search...</span>
            <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              ⌘K
            </kbd>
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <NotificationDropdown />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{getInitials(currentUser)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Command Dialog */}
      <CommandDialog open={openCommand} onOpenChange={setOpenCommand} />
    </header>
  );
}
