import { Module } from '@nestjs/common';
import { DocumentNotesService } from './document-notes.service';
import { DocumentNotesController } from './document-notes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, ActivityModule, WebSocketModule],
  controllers: [DocumentNotesController],
  providers: [DocumentNotesService],
  exports: [DocumentNotesService],
})
export class DocumentNotesModule {}

