import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { OpenAIService } from './services/openai.service';
import { DatabaseService } from './services/database.service';
import { LessonPlanController } from './features/create-lesson-plan/lesson-plan.controller';
import { LessonPlanService } from './features/create-lesson-plan/lesson-plan.service';
import { ItemsController } from './features/user-items/user-items.controller';
import { ItemsService } from './features/user-items/user-items.service';
import { RatingController } from './features/rating/rating.controller';
import { RatingService } from './features/rating/rating.service';
import { UserController } from './features/user-profile/user.controller';
import { UserService } from './features/user-profile/user.service';
import { ContactController } from './features/contact/contact.controller';
import { ContactService } from './features/contact/contact.service';
import { StripeController } from './features/stripe/stripe.controller';
import { StripeService } from './features/stripe/stripe.service';
import * as bodyParser from 'body-parser';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Load environment variables
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60 * 1000, // Time-to-live in milliseconds
          limit: 50, // Maximum number of requests per `ttl` window
        },
      ],
    }),
  ],
  controllers: [
    LessonPlanController, // Add LessonPlanController here
    ItemsController,
    RatingController,
    UserController,
    ContactController,
    StripeController,
    AppController,
  ],
  providers: [
    DatabaseService,
    OpenAIService,
    LessonPlanService,
    ItemsService,
    RatingService,
    UserService,
    ContactService,
    StripeService,
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(bodyParser.raw({ type: 'application/json' })) // Apply raw body parsing for webhook
      .forRoutes('/stripe/webhook');

    consumer.apply(LoggingMiddleware, AuthMiddleware).forRoutes('*'); // Apply other middleware
  }
}
