import { Module } from '@nestjs/common';
import { ApprovalRequestsService } from './approval-requests.service';
import { ApprovalRequestsController } from './approval-requests.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ApprovalRequestsController],
  providers: [ApprovalRequestsService],
  exports: [ApprovalRequestsService],
})
export class ApprovalRequestsModule {}

