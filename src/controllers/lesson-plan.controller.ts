import { Controller, Post, Body, Req } from '@nestjs/common';
import { OpenAIService } from '../services/openai.service';

@Controller('lesson-plan')
export class LessonPlanController {
  constructor(private readonly openAIService: OpenAIService) {}

  @Post()
  async createLessonPlan(
    @Body()
    body: {
      gradeLevel: string;
      subject: string;
      duration: string;
      additionalDetails?: string;
    },
    @Req() req: any,
  ) {
    const user = req.user; // Authenticated user from middleware
    const userId = user.sub; // Use the user's unique ID

    if (!body.gradeLevel || !body.subject || !body.duration) {
      return {
        error: 'Please provide gradeLevel, subject, and duration.',
      };
    }

    const lessonPlan = await this.openAIService.generateLessonPlan(
      userId,
      body,
    );
    return { lessonPlan };
  }
}
