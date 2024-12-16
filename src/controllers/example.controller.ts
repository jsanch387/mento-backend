import { Controller, Get, Req } from '@nestjs/common';

@Controller('example')
export class ExampleController {
  @Get()
  getExample(@Req() req: any) {
    const user = req.user; // Access the authenticated user
    return {
      message: 'This is a protected route.',
      user,
    };
  }
}
