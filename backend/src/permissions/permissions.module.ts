import { Module, forwardRef } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { CapabilityGuard } from './require-capability.decorator';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    PrismaModule,
    // Permissions ↔ Notifications ↔ WebSocket cycle
    forwardRef(() => NotificationsModule),
    ActivityModule,
  ],
  controllers: [PermissionsController, RolesController],
  providers: [PermissionsService, CapabilityGuard],
  exports: [PermissionsService, CapabilityGuard],
})
export class PermissionsModule {}
