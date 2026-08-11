import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { CSRFMiddleware } from './auth/csrf.middleware';
import * as dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

dotenv.config();

// Prisma returns BigInt for `File.fileSize`, and JSON.stringify throws on
// BigInt rather than serialising it — which turned every response carrying a
// file size into a 500. Serialise as a number: file sizes in bytes stay well
// inside the safe integer range.
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

function resolveTrustProxySetting(): boolean | number | string {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) {
    // Railway / reverse proxies: trust the first hop so req.ip is the client.
    return process.env.NODE_ENV === 'production' ? 1 : 'loopback';
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const asNum = Number(raw);
  if (!Number.isNaN(asNum)) return asNum;
  return raw;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Without this, Express reports the proxy IP for every request and the
  // throttler treats all users as one client.
  app.set('trust proxy', resolveTrustProxySetting());
  
  // Security headers with helmet
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for now to avoid conflicts with frontend
    crossOriginEmbedderPolicy: false, // Disable COEP for compatibility
  }));
  
  // Cookie parser middleware (required for reading cookies)
  app.use(cookieParser());
  
  // Trusted domains for CORS
  const trustedOrigins = [
    'http://localhost:3000', // Local development
    'http://localhost:3001', // Alternative local port
  ];
  
  // In production, only allow CORS_ORIGIN domains
  if (process.env.NODE_ENV === 'production') {
    if (process.env.CORS_ORIGIN) {
      const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
      trustedOrigins.length = 0; // Clear default origins in production
      trustedOrigins.push(...envOrigins);
    }
  } else {
    // In development, also add CORS_ORIGIN if provided
    if (process.env.CORS_ORIGIN) {
      const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
      trustedOrigins.push(...envOrigins);
    }
  }
  
  // Enable CORS with trusted domains and credentials
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      
      if (trustedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Required for cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });
  
  // Add Morgan logging middleware for development
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }
  
  // Apply CSRF protection middleware
  const csrfMiddleware = new CSRFMiddleware();
  app.use(csrfMiddleware.use.bind(csrfMiddleware));
  
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  
  // Railway routes to the port it injects as PORT and probes /health there.
  // Bind 0.0.0.0 explicitly: the default host is not reachable from outside the
  // container on every platform, and a healthcheck that cannot connect reads as
  // "service unavailable" with nothing in the logs to explain it.
  const port = Number(process.env.PORT) || 4003;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on 0.0.0.0:${port} (PORT=${process.env.PORT ?? 'unset'})`);
  console.log(`CORS enabled for origins: ${trustedOrigins.join(', ')}`);

  // Seed after listen so Railway healthchecks are not blocked if seed is slow.
  void import('./seed/run-seed')
    .then(({ runSeed }) => runSeed())
    .catch((error) => {
      console.error('Startup seed failed (app is still running):', error);
    });
}

bootstrap();
