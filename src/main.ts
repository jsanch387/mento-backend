import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body parsing for tools like Stripe
  });

  const logger = new Logger('Bootstrap');

  // Enable CORS with stricter production settings if needed
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*', // Allow specific origins in production
    credentials: true, // Include credentials if needed
  });

  // Use the port from Render's environment variable or a default value
  const port = process.env.PORT || 8000;

  await app.listen(port);

  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
