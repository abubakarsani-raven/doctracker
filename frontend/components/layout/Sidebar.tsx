"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
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
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/lib/hooks/use-permissions";
import type { Capability } from "@/lib/permissions";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Hide this entry unless the user holds the capability. */
  requires?: Capability;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Documents", href: "/documents", icon: FolderOpen },
  {
    title: "Workflows",
    href: "/workflows",
    icon: Workflow,
    requires: "workflows.view",
  },
  { title: "Actions", href: "/actions", icon: CheckSquare },
  { title: "My Goals", href: "/my-goals", icon: Target },
  {
    title: "Templates",
    href: "/templates",
    icon: BookTemplate,
    requires: "documents.create",
  },
  { title: "Archived", href: "/archived", icon: Archive },
  {
    title: "Users",
    href: "/users",
    icon: Users,
    requires: "users.view",
  },
  { title: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  className?: string;
}

function navLinkClass(isActive: boolean) {
  return cn(
    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { can, isMaster, ready } = usePermissions();

  const adminLinks = [
    {
      href: "/admin/dashboard",
      title: "Admin Dashboard",
      icon: LayoutDashboard,
      show: can("reports.view"),
    },
    {
      href: "/admin/companies",
      title: "Companies",
      icon: Building2,
      show: isMaster,
    },
    {
      href: "/approvals",
      title: "Approvals",
      icon: ShieldCheck,
      show: can("approvals.review"),
    },
    {
      href: "/access-requests",
      title: "Access Requests",
      icon: FileCheck,
      show: can("access_requests.review"),
    },
    {
      href: "/admin/reports",
      title: "Reports",
      icon: BarChart3,
      show: can("reports.view"),
    },
    {
      href: "/admin/storage",
      title: "Storage",
      icon: HardDrive,
      show: can("storage.view"),
    },
  ].filter((link) => link.show);

  const visibleNavItems = navItems.filter(
    (item) => !item.requires || (ready && can(item.requires)),
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] w-64 flex-col border-r bg-sidebar",
        className,
      )}
    >
      {/*
        Plain overflow scroll — Radix ScrollArea was collapsing horizontal
        inset so nav icons sat flush on the left edge.
      */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mb-3 px-3">
          <span className="register-label">Registry</span>
        </div>
        <nav className="flex flex-col gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(!!isActive)}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-scope-company" : undefined,
                  )}
                />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {adminLinks.length > 0 && (
          <>
            <Separator className="my-5" />
            <div className="mb-3 flex items-center gap-2 px-3">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="register-label">Administration</span>
            </div>
            <nav className="flex flex-col gap-1">
              {adminLinks.map((link) => {
                const Icon = link.icon;
                const isActive =
                  pathname === link.href ||
                  pathname?.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={navLinkClass(!!isActive)}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-brass" : undefined,
                      )}
                    />
                    <span>{link.title}</span>
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>
    </aside>
  );
}
