"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { useCurrentUser } from "@/lib/hooks/use-users";

interface PresenceIndicatorProps {
  resourceType: "workflow" | "document";
  resourceId: string;
}

export function PresenceIndicator({ resourceType, resourceId }: PresenceIndicatorProps) {
  const { data: currentUser } = useCurrentUser();
  const realtime = useRealtime();
  const [activeViewers, setActiveViewers] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser?.id || !resourceId) return;

    // Start viewing resource
    realtime.viewResource(resourceType, resourceId);

    // Listen for viewer updates
    const handleActiveViewers = (data: { resourceId: string; viewers: string[] }) => {
      if (data.resourceId === resourceId) {
        setActiveViewers(data.viewers.filter((id) => id !== currentUser.id));
      }
    };

    const handleUserViewing = (data: { userId: string; resourceId: string }) => {
      if (data.resourceId === resourceId && data.userId !== currentUser.id) {
        setActiveViewers((prev) => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      }
    };

    const handleUserStoppedViewing = (data: { userId: string; resourceId: string }) => {
      if (data.resourceId === resourceId) {
        setActiveViewers((prev) => prev.filter((id) => id !== data.userId));
      }
    };

    realtime.on("activeViewers", handleActiveViewers);
    realtime.on("userViewing", handleUserViewing);
    realtime.on("userStoppedViewing", handleUserStoppedViewing);

    return () => {
      realtime.stopViewingResource(resourceType, resourceId);
      realtime.off("activeViewers", handleActiveViewers);
      realtime.off("userViewing", handleUserViewing);
      realtime.off("userStoppedViewing", handleUserStoppedViewing);
    };
  }, [resourceType, resourceId, currentUser?.id, realtime]);

  if (activeViewers.length === 0) {
    return null;
  }

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <Users className="h-3 w-3" />
      {activeViewers.length} {activeViewers.length === 1 ? "user" : "users"} viewing
    </Badge>
  );
}

