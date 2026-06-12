import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getEnv, isEmailVerificationSkipped } from './config/env';

// Load monorepo root .env (Nest runs from apps/api by default)
config({ path: resolve(__dirname, '../../../.env') });

async function bootstrap() {
  getEnv();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.use(cookieParser());
  const env = getEnv();
  app.enableCors({
    // Allow any origin in dev (localhost, 127.0.0.1, LAN IP browsers)
    origin: env.NODE_ENV === 'development' ? true : env.NEXTAUTH_URL,
    credentials: true,
  });

  const port = getEnv().API_PORT;
  await app.listen(port, '0.0.0.0');
  const hostHint =
    env.NODE_ENV === 'production'
      ? `LMS API listening on port ${port} (/v1)`
      : `LMS API running on http://localhost:${port}/v1 (LAN: use your PC IP on port ${port})`;
  console.warn(hostHint);
  console.warn(
    `Email verification: ${isEmailVerificationSkipped() ? 'SKIPPED (dev mode)' : 'REQUIRED'}`,
  );
}

void bootstrap();
