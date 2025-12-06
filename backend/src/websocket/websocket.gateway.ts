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
import { Logger } from '@nestjs/common';

interface UserRoom {
  userId: string;
  rooms: Set<string>;
}

@WSGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(WebSocketGateway.name);
  private userRooms = new Map<string, UserRoom>(); // socketId -> UserRoom
  private activeViewers = new Map<string, Set<string>>(); // resourceId -> Set of userIds

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // User authentication would happen here via JWT token
    // For now, we'll extract user info from handshake auth
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
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; userId: string },
  ) {
    const { room, userId } = data;
    client.join(room);

    // Track user rooms
    let userRoom = this.userRooms.get(client.id);
    if (!userRoom) {
      userRoom = { userId, rooms: new Set() };
      this.userRooms.set(client.id, userRoom);
    }
    userRoom.rooms.add(room);

    this.logger.log(`User ${userId} joined room: ${room}`);
    client.emit('joinedRoom', { room });
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
  handleViewResource(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { resourceType: string; resourceId: string; userId: string },
  ) {
    const { resourceType, resourceId, userId } = data;
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

