import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { AnalogiesService } from './analogies.service';

type CreateAnalogyResponse =
  | {
      groupId: number;
      analogies: {
        analogy1: { title: string; analogy: string };
        analogy2: { title: string; analogy: string };
      };
    }
  | { error: string };

@Controller('analogies')
export class AnalogiesController {
  constructor(private readonly analogiesService: AnalogiesService) {}

  @Post()
  async createAnalogy(
    @Body()
    body: {
      gradeLevel: string;
      subject: string;
      context: string;
    },
    @Req() req: any,
  ): Promise<CreateAnalogyResponse> {
    const user = req.user; // Authenticated user from middleware
    const userId = user?.sub; // Use the user's unique ID

    if (!body.gradeLevel || !body.subject || !body.context) {
      return { error: 'Please provide gradeLevel, subject, and context.' };
    }

    return await this.analogiesService.createAnalogy(userId, body);
  }

  @Get('/:id')
  async getAnalogiesByGroup(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<any> {
    const userId = req.user?.sub; // Authenticated user's ID from middleware

    if (!userId) {
      throw new NotFoundException('User not found');
    }

    const analogies = await this.analogiesService.getAnalogiesByGroup(
      userId,
      id,
    );

    if (!analogies || analogies.length === 0) {
      throw new NotFoundException(`No analogies found for group ID: ${id}`);
    }

    return { analogies };
  }
}
