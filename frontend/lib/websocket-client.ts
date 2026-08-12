import { io, Socket } from 'socket.io-client';

/**
 * Resolve the Socket.IO base URL.
 *
 * HTTP can be same-origin via `/api-backend` rewrites, but WebSocket cannot.
 * Prefer NEXT_PUBLIC_WS_URL (Railway host in production); fall back to an
 * absolute NEXT_PUBLIC_API_URL for local dev.
 */
function resolveSocketUrl(): string {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (wsUrl) {
    try {
      const url = new URL(wsUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      console.warn('[WebSocket] Invalid NEXT_PUBLIC_WS_URL:', wsUrl);
    }
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003';
  if (apiUrl.startsWith('/')) {
    console.warn(
      '[WebSocket] NEXT_PUBLIC_API_URL is relative; set NEXT_PUBLIC_WS_URL to the Railway host',
    );
    return 'http://localhost:4003';
  }

  try {
    const url = new URL(apiUrl);
    // Preserve host + port; drop any path so we hit the Nest Socket.IO root.
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'http://localhost:4003';
  }
}

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(token?: string) {
    if (this.socket?.connected) {
      return;
    }

    // Tear down a half-open client before opening a new one (avoids duplicate
    // reconnect loops after a failed handshake).
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const socketUrl = resolveSocketUrl();
    const auth: Record<string, string> = {};
    if (token) {
      auth.token = token;
    }

    this.socket = io(socketUrl, {
      auth,
      withCredentials: true, // send dt_access cookie on the handshake
      // Polling first: pure websocket often fails cross-origin / behind proxies
      // and surfaces as a noisy "websocket error" in the Next.js overlay.
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
      this.emitLocal('connected', {});
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      this.emitLocal('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      // warn (not error) so Next.js doesn't turn transient handshake noise into
      // a full-screen "Console Error" overlay.
      console.warn('[WebSocket] Connection error:', error.message);
      this.reconnectAttempts++;
      if (this.reconnectAttempts === this.maxReconnectAttempts) {
        console.warn('[WebSocket] Max reconnection attempts reached');
        this.emitLocal('updates_paused', {
          reason: 'max_reconnect_attempts',
        });
      }
    });

    const onReconnectFailed = () => {
      console.warn('[WebSocket] Reconnect failed');
      this.emitLocal('updates_paused', { reason: 'reconnect_failed' });
    };
    this.socket.io.off('reconnect_failed', onReconnectFailed);
    this.socket.io.on('reconnect_failed', onReconnectFailed);

    // Forward all events to listeners
    this.socket.onAny((event, ...args) => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach((listener) => listener(args[0]));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.io.removeAllListeners('reconnect_failed');
      } catch {
        // ignore
      }
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    // Preserve app-level listeners (e.g. soft "Updates paused" toast) across
    // reconnect cycles; only the socket wiring is torn down.
  }

  on(event: string, callback: (data: any) => void) {
    // Local map only — onAny already forwards wire events to listeners.
    // Also calling socket.on would double-deliver every event.
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback?: (data: any) => void) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  /** App-level emit to local listeners (not the wire). */
  private emitLocal(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[WebSocket] Cannot emit, socket not connected');
    }
  }

  joinRoom(room: string, userId: string) {
    this.emit('joinRoom', { room, userId });
  }

  leaveRoom(room: string) {
    this.emit('leaveRoom', { room });
  }

  viewResource(resourceType: string, resourceId: string, userId: string) {
    this.emit('viewResource', { resourceType, resourceId, userId });
  }

  stopViewingResource(resourceType: string, resourceId: string, userId: string) {
    this.emit('stopViewingResource', { resourceType, resourceId, userId });
  }

  get isConnected() {
    return this.socket?.connected || false;
  }
}

export const wsClient = new WebSocketClient();
