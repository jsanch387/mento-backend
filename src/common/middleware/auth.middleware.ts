import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  // List of routes to ignore for authentication
  private readonly ignoredRoutes: string[] = [
    '/stripe/webhook',
    '/contact',
    '/rating',
  ];

  private isIgnoredRoute(path: string): boolean {
    return this.ignoredRoutes.some((ignoredRoute) =>
      path.startsWith(ignoredRoute),
    );
  }

  use(req: Request, res: Response, next: NextFunction) {
    const fullPath = req.originalUrl;

    // Log headers to check if the Authorization header is present

    if (this.isIgnoredRoute(fullPath)) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.error('Token is missing');
      throw new UnauthorizedException('Token is missing');
    }

    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      req['user'] = decoded;
      next();
    } catch (error) {
      console.error('Invalid or expired token:', error.message);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
