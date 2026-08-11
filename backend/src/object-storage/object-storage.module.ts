import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ObjectStorageService } from './object-storage.interface';
import { R2ObjectStorageService } from './r2-object-storage.service';
import { LocalObjectStorageService } from './local-object-storage.service';
import { CloudinaryObjectStorageService } from './cloudinary-object-storage.service';

export const OBJECT_STORAGE = 'OBJECT_STORAGE';

function hasCloudinary(config: ConfigService): boolean {
  return !!(
    config.get('CLOUDINARY_CLOUD_NAME') &&
    config.get('CLOUDINARY_API_KEY') &&
    config.get('CLOUDINARY_API_SECRET')
  );
}

function hasR2OrS3(config: ConfigService): boolean {
  return !!(
    (config.get('R2_ACCESS_KEY_ID') || config.get('S3_ACCESS_KEY_ID')) &&
    (config.get('R2_SECRET_ACCESS_KEY') || config.get('S3_SECRET_ACCESS_KEY')) &&
    (config.get('R2_BUCKET') || config.get('S3_BUCKET'))
  );
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: (configService: ConfigService): ObjectStorageService => {
        const provider = (
          configService.get<string>('STORAGE_PROVIDER') || ''
        )
          .trim()
          .toLowerCase();

        if (provider === 'cloudinary' || (!provider && hasCloudinary(configService))) {
          if (provider === 'cloudinary' && !hasCloudinary(configService)) {
            throw new Error(
              'STORAGE_PROVIDER=cloudinary but Cloudinary credentials are missing',
            );
          }
          return new CloudinaryObjectStorageService(configService);
        }

        if (provider === 'r2' || provider === 's3' || (!provider && hasR2OrS3(configService))) {
          return new R2ObjectStorageService(configService);
        }

        if (provider === 'local' || !provider) {
          return new LocalObjectStorageService(configService);
        }

        throw new Error(
          `Unknown STORAGE_PROVIDER "${provider}". Use: local | cloudinary | r2 | s3`,
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}
