import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { ActivityModule } from '../activity/activity.module';
import { FilesModule } from '../files/files.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SignaturesModule } from '../signatures/signatures.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    WebSocketModule,
    ActivityModule,
    FilesModule,
    PermissionsModule,
    SignaturesModule,
  ],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
