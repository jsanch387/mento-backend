import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to the API! Use the appropriate endpoints to interact.';
  }
}
