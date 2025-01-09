import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body parsing for tools like Stripe
  });

  const logger = new Logger('Bootstrap');

  // Configure allowed origins for CORS
  const allowedOrigins = [
    'http://localhost:3000', // Local development
    'https://mento-frontend-orcin.vercel.app/', // Production domain
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        // Allow requests from allowed origins or non-browser clients
        callback(null, true);
      } else {
        // Block other origins
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true, // Include credentials if needed (e.g., cookies, Authorization headers)
  });

  // Use the port from Render's environment variable or a default value
  const port = process.env.PORT || 8000;

  await app.listen(port);

  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
