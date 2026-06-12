import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getEnv, isEmailVerificationSkipped } from './config/env';
import { getCorsOptions } from './config/cors';

// Local dev only — hosted staging/production inject env vars via the platform (Render, etc.)
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: resolve(__dirname, '../../../.env') });
}

async function bootstrap() {
  const env = getEnv();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors(getCorsOptions());

  const port = env.API_PORT;
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
