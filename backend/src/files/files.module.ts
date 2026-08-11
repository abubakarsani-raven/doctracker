import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ObjectStorageModule } from '../object-storage';

@Module({
  imports: [PrismaModule, ActivityModule, PermissionsModule, ObjectStorageModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
