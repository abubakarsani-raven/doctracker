import { useEffect, useMemo, useRef } from 'react';
import { wsClient } from '@/lib/websocket-client';
import { useCurrentUser } from './use-users';

/** Which user id the singleton socket is currently bound to. */
let connectedForUserId: string | null = null;

export function useRealtime() {
  const { data: currentUser } = useCurrentUser();
  const userIdRef = useRef<string | null>(null);

  // Keep the latest user id for stable method closures.
  userIdRef.current = currentUser?.id ?? null;

  useEffect(() => {
    const userId = currentUser?.id ?? null;

    if (!userId) {
      // Logout / no session — tear down the socket.
      if (connectedForUserId || wsClient.isConnected) {
        wsClient.disconnect();
        connectedForUserId = null;
      }
      return;
    }

    // Already connected for this identity — leave it alone.
    if (connectedForUserId === userId && wsClient.isConnected) {
      return;
    }

    // Cookie auth (dt_access) is primary. Only pass a localStorage token if one
    // still exists — login clears those, so most sessions rely on cookies alone.
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('authToken') || localStorage.getItem('access_token')
        : null;

    // User switched (or first connect) — bind a fresh socket to this identity.
    if (wsClient.isConnected || connectedForUserId) {
      wsClient.disconnect();
    }
    wsClient.connect(token || undefined);
    connectedForUserId = userId;

    // Do not disconnect on unmount — other consumers share the singleton.
    // Logout (null user) is handled when this effect re-runs.
  }, [currentUser?.id]);

  // Stable API so effect deps that include these methods don't thrash.
  const api = useMemo(
    () => ({
      get isConnected() {
        return wsClient.isConnected;
      },
      joinRoom: (room: string) => {
        const id = userIdRef.current;
        if (id) wsClient.joinRoom(room, id);
      },
      leaveRoom: (room: string) => {
        wsClient.leaveRoom(room);
      },
      viewResource: (resourceType: string, resourceId: string) => {
        const id = userIdRef.current;
        if (id) wsClient.viewResource(resourceType, resourceId, id);
      },
      stopViewingResource: (resourceType: string, resourceId: string) => {
        const id = userIdRef.current;
        if (id) wsClient.stopViewingResource(resourceType, resourceId, id);
      },
      on: (event: string, callback: (data: any) => void) => {
        wsClient.on(event, callback);
      },
      off: (event: string, callback?: (data: any) => void) => {
        wsClient.off(event, callback);
      },
      emit: (event: string, data: any) => {
        wsClient.emit(event, data);
      },
    }),
    [],
  );

  return api;
}

export function useRealtimeUpdates(
  resourceType: 'workflow' | 'action' | 'document' | 'notification',
  resourceId: string,
  onUpdate: (data: any) => void,
) {
  const { data: currentUser } = useCurrentUser();
  const realtime = useRealtime();
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!currentUser?.id || !resourceId) return;

    const room = `${resourceType}:${resourceId}`;
    realtime.joinRoom(room);

    const updateEvent = `${resourceType}Updated`;
    const handler = (data: any) => onUpdateRef.current(data);
    realtime.on(updateEvent, handler);

    return () => {
      realtime.leaveRoom(room);
      realtime.off(updateEvent, handler);
    };
  }, [resourceType, resourceId, currentUser?.id, realtime]);
}
