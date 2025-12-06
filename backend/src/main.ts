import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as morgan from 'morgan';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Trusted domains for CORS
  const trustedOrigins = [
    'http://localhost:3000', // Local development
    'https://doctracker-git-main-sani-abubakar-babaganas-projects.vercel.app', // Production Vercel
    'https://doctracker-eight.vercel.app',
  ];
  
  // Add CORS_ORIGIN from environment if provided
  if (process.env.CORS_ORIGIN) {
    const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
    trustedOrigins.push(...envOrigins);
  }
  
  // Enable CORS with trusted domains
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (trustedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  
  // Add Morgan logging middleware for development
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }
  
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  
  const port = process.env.PORT || 4003;
  await app.listen(port);
  console.log(`Backend server running on http://localhost:${port}`);
  console.log(`CORS enabled for origins: ${trustedOrigins.join(', ')}`);
}

bootstrap();
