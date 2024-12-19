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
          limit: 10, // Maximum number of requests per `ttl` window
        },
      ],
    }),
  ],
  controllers: [
    LessonPlanController, // Add LessonPlanController here
    ItemsController,
    RatingController,
    UserController,
  ],
  providers: [
    DatabaseService,
    OpenAIService,
    LessonPlanService,
    ItemsService,
    RatingService,
    UserService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    this.registerMiddlewares(consumer);
  }

  private registerMiddlewares(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware, AuthMiddleware) // Apply middleware globally
      .forRoutes('*'); // Apply middleware to all routes
  }
}
