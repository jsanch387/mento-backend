import {
  Injectable,
  NestMiddleware,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ErrorHandlingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorHandlingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    try {
      next();
    } catch (error) {
      this.logger.error(`Unhandled error: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        // Handle known HTTP exceptions
        const status = error.getStatus();
        const response = error.getResponse();
        res.status(status).json({
          statusCode: status,
          ...(typeof response === 'string' ? { message: response } : response),
        });
      } else {
        // Handle generic errors
        res.status(500).json({
          statusCode: 500,
          message: 'Internal server error',
        });
      }
    }
  }
}
