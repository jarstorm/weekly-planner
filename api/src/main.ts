import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false porque el webhook de Stripe necesita el body crudo
  // (Buffer) sin parsear para poder verificar la firma Stripe-Signature —
  // si el JSON parser global lo toca primero, la verificación falla.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());
  app.enableCors({ origin: process.env.APP_BASE_URL ?? 'http://localhost:3000', credentials: true });
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
bootstrap();
