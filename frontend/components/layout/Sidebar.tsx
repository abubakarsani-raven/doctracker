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
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermissions } from "@/lib/hooks/use-permissions";
import type { Capability } from "@/lib/permissions";
import { useSidebarCollapse } from "./SidebarCollapse";

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
  /**
   * Mobile drawer mode: always expanded labels, relative layout (not fixed).
   * Collapse controls are hidden.
   */
  mobile?: boolean;
}

function navLinkClass(isActive: boolean, collapsed: boolean) {
  return cn(
    "flex w-full items-center rounded-md text-sm font-medium transition-colors",
    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

function NavLink({
  href,
  title,
  icon: Icon,
  isActive,
  collapsed,
  accentClass,
}: {
  href: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  collapsed: boolean;
  accentClass?: string;
}) {
  const link = (
    <Link
      href={href}
      className={navLinkClass(isActive, collapsed)}
      aria-label={title}
      title={collapsed ? title : undefined}
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", isActive ? accentClass : undefined)}
      />
      {!collapsed ? <span className="truncate">{title}</span> : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ className, mobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { can, isMaster, ready } = usePermissions();
  const { collapsed: storedCollapsed, toggle } = useSidebarCollapse();
  const collapsed = mobile ? false : storedCollapsed;

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
      data-collapsed={collapsed ? "true" : "false"}
      data-mobile={mobile ? "true" : "false"}
      className={cn(
        "z-40 flex h-[calc(100vh-3.5rem)] flex-col border-r bg-sidebar transition-[width] duration-200 ease-out",
        mobile
          ? "relative h-full w-full border-0"
          : "fixed left-0 top-14",
        !mobile && (collapsed ? "w-16" : "w-64"),
        className,
      )}
    >
      {/*
        Plain overflow scroll — Radix ScrollArea was collapsing horizontal
        inset so nav icons sat flush on the left edge.
      */}
      <div
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-5",
          collapsed ? "px-2" : "px-5",
        )}
      >
        {!collapsed ? (
          <div className="mb-3 px-3">
            <span className="register-label">Registry</span>
          </div>
        ) : (
          <div className="mb-3 flex justify-center">
            <span className="sr-only">Registry</span>
          </div>
        )}
        <nav className="flex flex-col gap-1">
          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <NavLink
                key={item.href}
                href={item.href}
                title={item.title}
                icon={item.icon}
                isActive={!!isActive}
                collapsed={collapsed}
                accentClass="text-scope-company"
              />
            );
          })}
        </nav>

        {adminLinks.length > 0 && (
          <>
            <Separator className={cn("my-5", collapsed && "mx-1")} />
            {!collapsed ? (
              <div className="mb-3 flex items-center gap-2 px-3">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="register-label">Administration</span>
              </div>
            ) : (
              <div className="mb-2 flex justify-center" aria-hidden>
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            <nav className="flex flex-col gap-1">
              {adminLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  pathname?.startsWith(`${link.href}/`);
                return (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    title={link.title}
                    icon={link.icon}
                    isActive={!!isActive}
                    collapsed={collapsed}
                    accentClass="text-brass"
                  />
                );
              })}
            </nav>
          </>
        )}
      </div>

      {!mobile ? (
        <div
          className={cn(
            "shrink-0 border-t p-2",
            collapsed ? "flex justify-center" : "px-3",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn(
              "text-muted-foreground",
              collapsed ? "h-9 w-9" : "w-full justify-start gap-2",
            )}
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
