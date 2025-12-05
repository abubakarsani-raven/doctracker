"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Workflow,
  CheckSquare,
  Users,
  Settings,
  Building2,
  FileCheck,
  Archive,
  BarChart3,
  HardDrive,
  BookTemplate,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMockData } from "@/lib/contexts/MockDataContext";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Documents",
    href: "/documents",
    icon: FolderOpen,
  },
  {
    title: "Workflows",
    href: "/workflows",
    icon: Workflow,
  },
  {
    title: "Actions",
    href: "/actions",
    icon: CheckSquare,
  },
  {
    title: "Templates",
    href: "/templates",
    icon: BookTemplate,
  },
  {
    title: "Archived",
    href: "/archived",
    icon: Archive,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useMockData();

  // Check if user has admin privileges
  const isAdmin = currentUser?.role === "Master" || currentUser?.role === "Company Admin";
  const isMaster = currentUser?.role === "Master";

  // Filter nav items based on role
  const visibleNavItems = navItems.filter((item) => {
    // All users can see Dashboard, Documents, Workflows, Actions
    if (["/dashboard", "/documents", "/workflows", "/actions"].includes(item.href)) {
      return true;
    }
    // Templates, Archived, Users, Settings - visible to all for now
    // In production, you might want to restrict these based on role
    return true;
  });

  return (
    <aside className={cn("fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 border-r bg-background", className)}>
      <div className="flex h-full flex-col">
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}
          </nav>

          {/* Admin Section - Only show for admins */}
          {isAdmin && (
            <>
              <Separator className="my-4" />
              <div className="px-3 py-2">
                <div className="mb-2 flex items-center gap-2 px-3 text-xs font-semibold text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  ADMIN
                </div>
                <nav className="space-y-1">
                  <Link
                    href="/admin/dashboard"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      pathname === "/admin/dashboard"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    Admin Dashboard
                  </Link>
                  {/* Companies - Only for Master */}
                  {isMaster && (
                    <Link
                      href="/admin/companies"
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        pathname?.startsWith("/admin/companies")
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Building2 className="h-5 w-5" />
                      Companies
                    </Link>
                  )}
                  <Link
                    href="/approvals"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      pathname?.startsWith("/approvals")
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Approvals
                  </Link>
                  <Link
                    href="/access-requests"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      pathname?.startsWith("/access-requests")
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Access Requests
                  </Link>
                  <Link
                    href="/admin/reports"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      pathname === "/admin/reports"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <BarChart3 className="h-5 w-5" />
                    Reports
                  </Link>
                  <Link
                    href="/admin/storage"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      pathname === "/admin/storage"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <HardDrive className="h-5 w-5" />
                    Storage
                  </Link>
                </nav>
              </div>
            </>
          )}
        </ScrollArea>
      </div>
    </aside>
  );
}
