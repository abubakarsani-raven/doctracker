import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PermissionsService } from '../permissions/permissions.service';

interface UserRoom {
  userId: string;
  rooms: Set<string>;
}

@WSGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ]).map((o) => o.trim()),
    credentials: true,
  },
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(WebSocketGateway.name);
  private userRooms = new Map<string, UserRoom>(); // socketId -> UserRoom
  private activeViewers = new Map<string, Set<string>>(); // resourceId -> Set of userIds

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    @Inject(forwardRef(() => PermissionsService))
    private permissionsService: PermissionsService,
  ) {}

  private readAccessCookie(client: Socket): string | null {
    const cookies = client.handshake.headers.cookie;
    if (!cookies) return null;
    const cookieMatch = cookies.match(/(?:^|;\s*)dt_access=([^;]+)/);
    return cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  }

  async handleConnection(client: Socket) {
    try {
      // Prefer handshake auth token, then fall back to the httpOnly cookie.
      // If the explicit token is stale, still try the cookie — REST refresh
      // keeps dt_access fresh while localStorage often does not.
      const candidates = [
        client.handshake.auth?.token as string | undefined,
        this.readAccessCookie(client),
      ].filter((t): t is string => Boolean(t));

      if (candidates.length === 0) {
        this.logger.warn(`WebSocket connection rejected: No token provided for ${client.id}`);
        client.disconnect();
        return;
      }

      let payload: any = null;
      for (const token of candidates) {
        try {
          payload = this.jwtService.verify(token);
          break;
        } catch {
          // try next candidate
        }
      }

      if (!payload) {
        this.logger.warn(`WebSocket connection rejected: Invalid token for ${client.id}`);
        client.disconnect();
        return;
      }

      // Get user and verify they're active
      const user = await this.usersService.findOne(payload.sub);
      if (!user || user.status !== 'active') {
        this.logger.warn(`WebSocket connection rejected: User not found or inactive for ${client.id}`);
        client.disconnect();
        return;
      }

      // Build permissions
      const permissions = this.permissionsService.buildEffectivePermissions(user);

      // Attach user data to client
      client.data.user = {
        ...user,
        permissions,
      };

      this.logger.log(`WebSocket client authenticated: ${client.id} (user: ${user.email})`);
    } catch (error) {
      this.logger.error(`WebSocket authentication error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const userRoom = this.userRooms.get(client.id);
    if (userRoom) {
      // Remove user from all active viewers
      this.activeViewers.forEach((viewers, resourceId) => {
        viewers.delete(userRoom.userId);
        if (viewers.size === 0) {
          this.activeViewers.delete(resourceId);
        } else {
          // Notify others that user left
          this.server.to(`resource:${resourceId}`).emit('userLeft', {
            userId: userRoom.userId,
            resourceId,
          });
        }
      });
      this.userRooms.delete(client.id);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; userId: string },
  ) {
    if (!client.data.user) {
      client.disconnect();
      return;
    }

    const { room, userId } = data;
    const authenticatedUserId = client.data.user.id;

    // Verify the user can only join rooms for themselves
    if (userId !== authenticatedUserId) {
      this.logger.warn(`User ${authenticatedUserId} tried to join room as ${userId}`);
      client.emit('error', { message: 'Cannot join room for another user' });
      return;
    }

    // Basic room access control - user must be in same company or have access
    if (room.includes(':')) {
      const [roomType, resourceId] = room.split(':', 2);
      const allowed = await this.canUserAccessRoom(
        client.data.user,
        roomType,
        resourceId,
      );
      if (!allowed) {
        this.logger.warn(`User ${authenticatedUserId} denied access to room: ${room}`);
        client.emit('error', { message: 'Access denied to room' });
        return;
      }
    }

    client.join(room);

    // Track user rooms
    let userRoom = this.userRooms.get(client.id);
    if (!userRoom) {
      userRoom = { userId: authenticatedUserId, rooms: new Set() };
      this.userRooms.set(client.id, userRoom);
    }
    userRoom.rooms.add(room);

    this.logger.log(`User ${authenticatedUserId} joined room: ${room}`);
    client.emit('joinedRoom', { room });
  }

  /**
   * Room access: company/user rooms by membership; document/folder/workflow via ACL.
   */
  private async canUserAccessRoom(
    user: any,
    roomType: string,
    resourceId: string,
  ): Promise<boolean> {
    if (user?.permissions?.dataScope === 'all') {
      return true;
    }

    if (roomType === 'company') {
      return Boolean(user.companyId) && resourceId === user.companyId;
    }

    if (roomType === 'user') {
      return resourceId === user.id;
    }

    if (roomType === 'document' || roomType === 'file') {
      return this.permissionsService.checkPermission(
        user.id,
        'file',
        resourceId,
        'read',
      );
    }

    if (roomType === 'folder') {
      return this.permissionsService.canOpenFolder(user.id, resourceId);
    }

    // resource: presence rooms are further checked in viewResource
    if (roomType === 'resource') {
      return true;
    }

    // Deny unknown room types
    return false;
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const { room } = data;
    client.leave(room);

    const userRoom = this.userRooms.get(client.id);
    if (userRoom) {
      userRoom.rooms.delete(room);
    }

    this.logger.log(`Client left room: ${room}`);
    client.emit('leftRoom', { room });
  }

  @SubscribeMessage('viewResource')
  async handleViewResource(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { resourceType: string; resourceId: string; userId: string },
  ) {
    if (!client.data.user) {
      client.disconnect();
      return;
    }

    const authenticatedUserId = client.data.user.id;
    const { resourceType, resourceId } = data;
    const userId = authenticatedUserId;

    if (data.userId && data.userId !== authenticatedUserId) {
      client.emit('error', { message: 'Cannot spoof viewer identity' });
      return;
    }

    // ACL check for document/folder presence
    let allowed = client.data.user?.permissions?.dataScope === 'all';
    if (!allowed) {
      if (resourceType === 'document' || resourceType === 'file') {
        allowed = await this.permissionsService.checkPermission(
          userId,
          'file',
          resourceId,
          'read',
        );
      } else if (resourceType === 'folder') {
        allowed = await this.permissionsService.canOpenFolder(userId, resourceId);
      } else {
        allowed = false;
      }
    }

    if (!allowed) {
      client.emit('error', { message: 'Access denied to resource' });
      return;
    }

    const room = `resource:${resourceType}:${resourceId}`;
    
    client.join(room);

    // Track active viewers
    if (!this.activeViewers.has(resourceId)) {
      this.activeViewers.set(resourceId, new Set());
    }
    this.activeViewers.get(resourceId)!.add(userId);

    // Notify others in the room
    client.to(room).emit('userViewing', {
      userId,
      resourceType,
      resourceId,
    });

    // Send current viewers to the new viewer
    const viewers = Array.from(this.activeViewers.get(resourceId) || []);
    client.emit('activeViewers', {
      resourceId,
      viewers,
    });
  }

  @SubscribeMessage('stopViewingResource')
  handleStopViewingResource(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { resourceType: string; resourceId: string; userId: string },
  ) {
    const { resourceType, resourceId, userId } = data;
    const room = `resource:${resourceType}:${resourceId}`;
    
    client.leave(room);

    // Remove from active viewers
    const viewers = this.activeViewers.get(resourceId);
    if (viewers) {
      viewers.delete(userId);
      if (viewers.size === 0) {
        this.activeViewers.delete(resourceId);
      }
    }

    // Notify others
    client.to(room).emit('userStoppedViewing', {
      userId,
      resourceType,
      resourceId,
    });
  }

  // Methods to emit events from services
  emitWorkflowUpdate(workflowId: string, data: any) {
    this.server.to(`workflow:${workflowId}`).emit('workflowUpdated', data);
  }

  emitActionUpdate(actionId: string, data: any) {
    this.server.to(`action:${actionId}`).emit('actionUpdated', data);
  }

  emitNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  emitDocumentUpdate(documentId: string, data: any) {
    this.server.to(`document:${documentId}`).emit('documentUpdated', data);
  }
}

