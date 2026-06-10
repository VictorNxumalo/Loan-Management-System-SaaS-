import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getEnv } from './config/env';

async function bootstrap() {
  getEnv();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: getEnv().NEXTAUTH_URL,
    credentials: true,
  });

  const port = getEnv().API_PORT;
  await app.listen(port);
  console.warn(`LMS API running on http://localhost:${port}/v1`);
}

void bootstrap();
