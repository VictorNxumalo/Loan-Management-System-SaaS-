import { loadedEnvPath } from './config/load-env';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getEnv, assertEmailDeliveryReady, isBrevoConfigured, isEmailVerificationSkipped } from './config/env';
import { getCorsOptions } from './config/cors';

async function bootstrap() {
  assertEmailDeliveryReady();
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
  if (loadedEnvPath) {
    console.warn(`Loaded env from ${loadedEnvPath}`);
  }
  console.warn(
    `Email verification: ${isEmailVerificationSkipped() ? 'SKIPPED (dev mode)' : 'REQUIRED'}`,
  );
  console.warn(
    `Transactional email: ${isBrevoConfigured() ? 'Brevo' : 'console only (set BREVO_API_KEY + BREVO_FROM_EMAIL)'}`,
  );
}

void bootstrap();
