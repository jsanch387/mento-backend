import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { LessonPlanService } from './lesson-plan.service';

@Controller('lesson-plans')
export class LessonPlanController {
  constructor(private readonly lessonPlanService: LessonPlanService) {}

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

    const lessonPlan = await this.lessonPlanService.createLessonPlan(
      userId,
      body,
    );
    return { lessonPlan };
  }

  @Get('/:id')
  async getLessonPlanById(@Param('id') id: string) {
    const lessonPlan = await this.lessonPlanService.getLessonPlanById(id);

    if (!lessonPlan) {
      throw new NotFoundException(`Lesson plan with ID ${id} not found`);
    }

    return lessonPlan;
  }
}
