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
    '/',
  ];

  private isIgnoredRoute(path: string): boolean {
    return this.ignoredRoutes.some((ignoredRoute) =>
      path.startsWith(ignoredRoute),
    );
  }

  use(req: Request, res: Response, next: NextFunction) {
    const fullPath = req.originalUrl; // Get the full path of the request
    console.log(`AuthMiddleware triggered for path: ${fullPath}`);

    // Skip authentication if the route is in the ignoredRoutes list
    if (this.isIgnoredRoute(fullPath)) {
      console.log(`Skipping authentication for path: ${fullPath}`);
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.error('Authorization header is missing');
      throw new UnauthorizedException('Authorization header is missing');
    }

    const token = authHeader.split(' ')[1]; // Expecting 'Bearer <token>'
    if (!token) {
      console.error('Token is missing');
      throw new UnauthorizedException('Token is missing');
    }

    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      req['user'] = decoded; // Attach decoded user data to request object
      next();
    } catch (error) {
      console.error('Invalid or expired token:', error.message);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
