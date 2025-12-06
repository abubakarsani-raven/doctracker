import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { ActionsModule } from './actions/actions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FilesModule } from './files/files.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';
import { ApprovalRequestsModule } from './approval-requests/approval-requests.module';
import { PermissionsModule } from './permissions/permissions.module';
import { StorageModule } from './storage/storage.module';
import { WebSocketModule } from './websocket/websocket.module';
import { ActivityModule } from './activity/activity.module';
import { DocumentNotesModule } from './document-notes/document-notes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    WorkflowsModule,
    ActionsModule,
    NotificationsModule,
    FilesModule,
    AccessRequestsModule,
    ApprovalRequestsModule,
    PermissionsModule,
    StorageModule,
    WebSocketModule,
    ActivityModule,
    DocumentNotesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
