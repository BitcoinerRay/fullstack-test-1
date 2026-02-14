import {resolve} from 'node:path';
import {config} from 'dotenv';
import {Logger, ValidationPipe} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {DocumentBuilder, OpenAPIObject, SwaggerModule} from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {AppModule} from './app.module';
import {PrismaExceptionFilter} from './common/filters/prisma-exception/prisma-exception.filter';
import {Logger as LoggerService} from './common/logger/logger.service';

for (const p of [
  resolve(process.cwd(), '../../.env.example'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '.env.example'),
  resolve(process.cwd(), '.env'),
])
  config({path: p, override: true, quiet: true});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.use(helmet());

  app.enableCors({
    origin: process.env.FRONTEND_HOST,
    credentials: true,
  });

  app.useLogger(new LoggerService());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(cookieParser());

  app.setGlobalPrefix('api');

  app.useGlobalFilters(new PrismaExceptionFilter());

  if (process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('nest auth boilerplate')
      .setDescription('The nest auth boilerplate API description')
      .setVersion('1.0')
      .build();
    const documentFactory = (): OpenAPIObject => SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 4000);

  if (process.env.ENABLE_SWAGGER === 'true') {
    const logger = new Logger('bootstrap', {timestamp: true});
    logger.log(`Swagger is running on: ${await app.getUrl()}/api/docs`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
bootstrap();
