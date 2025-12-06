import { io, Socket } from 'socket.io-client';

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(token?: string) {
    if (this.socket?.connected) {
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003';
    const wsUrl = apiUrl.replace(/^https?:\/\//, '').split(':')[0];
    const wsPort = apiUrl.includes('localhost') ? '4003' : '';
    const protocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const socketUrl = `${protocol}://${wsUrl}${wsPort ? ':' + wsPort : ''}`;

    this.socket = io(socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
      this.emit('connected', {});
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
      }
    });

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
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Also listen on socket if connected
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback);
      }
    } else {
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
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

