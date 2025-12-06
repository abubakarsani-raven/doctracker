import { useEffect, useRef } from 'react';
import { wsClient } from '@/lib/websocket-client';
import { useCurrentUser } from './use-users';

export function useRealtime() {
  const { data: currentUser } = useCurrentUser();
  const initialized = useRef(false);

  useEffect(() => {
    if (!currentUser?.id || initialized.current) return;

    // Get auth token
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('authToken') || localStorage.getItem('access_token')
        : null;

    // Connect WebSocket
    wsClient.connect(token || undefined);

    initialized.current = true;

    return () => {
      // Don't disconnect on unmount - keep connection alive
      // wsClient.disconnect();
    };
  }, [currentUser?.id]);

  return {
    isConnected: wsClient.isConnected,
    joinRoom: (room: string) => {
      if (currentUser?.id) {
        wsClient.joinRoom(room, currentUser.id);
      }
    },
    leaveRoom: (room: string) => {
      wsClient.leaveRoom(room);
    },
    viewResource: (resourceType: string, resourceId: string) => {
      if (currentUser?.id) {
        wsClient.viewResource(resourceType, resourceId, currentUser.id);
      }
    },
    stopViewingResource: (resourceType: string, resourceId: string) => {
      if (currentUser?.id) {
        wsClient.stopViewingResource(resourceType, resourceId, currentUser.id);
      }
    },
    on: wsClient.on.bind(wsClient),
    off: wsClient.off.bind(wsClient),
    emit: wsClient.emit.bind(wsClient),
  };
}

export function useRealtimeUpdates(
  resourceType: 'workflow' | 'action' | 'document' | 'notification',
  resourceId: string,
  onUpdate: (data: any) => void,
) {
  const { data: currentUser } = useCurrentUser();
  const realtime = useRealtime();

  useEffect(() => {
    if (!currentUser?.id || !resourceId) return;

    // Join resource room
    const room = `${resourceType}:${resourceId}`;
    realtime.joinRoom(room);

    // Listen for updates
    const updateEvent = `${resourceType}Updated`;
    realtime.on(updateEvent, onUpdate);

    return () => {
      realtime.leaveRoom(room);
      realtime.off(updateEvent, onUpdate);
    };
  }, [resourceType, resourceId, currentUser?.id, onUpdate, realtime]);
}

