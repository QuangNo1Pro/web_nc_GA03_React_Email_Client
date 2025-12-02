import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import * as express from 'express'; // Import express

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Cache-Control', 'Accept'], // Added Cache-Control and Accept
    exposedHeaders: ['Set-Cookie'],
  });

  // Increase payload size limit
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);
  
  // Increase server timeout for SSE (long-lived connections)
  const server = app.getHttpServer();
  server.keepAliveTimeout = 620000; // 10+ minutes
  server.headersTimeout = 630000;
  
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();