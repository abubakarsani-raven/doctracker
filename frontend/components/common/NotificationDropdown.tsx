"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useNotifications, useUnreadNotificationsCount, useMarkNotificationRead } from "@/lib/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";

export function NotificationDropdown() {
  const { data: notifications = [], isLoading, error } = useNotifications();
  const unreadCount = useUnreadNotificationsCount();
  const markAsRead = useMarkNotificationRead();

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read && notification.id) {
      try {
        await markAsRead.mutateAsync(notification.id);
      } catch (error) {
        console.error('[NotificationDropdown] Error marking notification as read:', error);
      }
    }
  };

  const getNotificationHref = (notification: any): string => {
    if (notification.resourceType === "action" && notification.resourceId) {
      return `/actions/${notification.resourceId}`;
    }
    if (notification.resourceType === "workflow" && notification.resourceId) {
      return `/workflows/${notification.resourceId}`;
    }
    if (notification.resourceType === "access_request" && notification.resourceId) {
      return `/access-requests`;
    }
    return "#";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-destructive">
              Failed to load notifications
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="py-1">
              {notifications.slice(0, 10).map((notification: any) => (
                <Link
                  key={notification.id}
                  href={getNotificationHref(notification)}
                  className="block"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <DropdownMenuItem
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 cursor-pointer",
                      !notification.read && "bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary ml-2 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {notification.createdAt
                        ? formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })
                        : "Recently"}
                    </p>
                  </DropdownMenuItem>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="w-full text-center">
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
