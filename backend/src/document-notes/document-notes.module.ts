import { Module } from '@nestjs/common';
import { DocumentNotesService } from './document-notes.service';
import { DocumentNotesController } from './document-notes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PrismaModule, ActivityModule, WebSocketModule, PermissionsModule],
  controllers: [DocumentNotesController],
  providers: [DocumentNotesService],
  exports: [DocumentNotesService],
})
export class DocumentNotesModule {}

