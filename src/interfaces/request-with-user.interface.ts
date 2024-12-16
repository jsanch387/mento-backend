import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    [key: string]: any; // Add more fields as needed
  };
}
