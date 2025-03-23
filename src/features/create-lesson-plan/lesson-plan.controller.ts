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

  @Post('/generate')
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
    const userId = req.user?.sub;

    if (!body.gradeLevel || !body.subject || !body.duration) {
      return { error: 'Please provide gradeLevel, subject, and duration.' };
    }

    const lessonPlan = await this.lessonPlanService.generateLessonPlan(
      userId,
      body,
    );

    return lessonPlan; // 👈 returns the flat object directly (no wrapper)
  }

  @Get('/:id')
  async getLessonPlanById(@Param('id') id: string) {
    const lessonPlan = await this.lessonPlanService.getLessonPlanById(id);

    if (!lessonPlan) {
      throw new NotFoundException(`Lesson plan with ID ${id} not found`);
    }

    // ✅ Remove user_id from response before sending to frontend
    const { ...publicLessonPlan } = lessonPlan;
    return publicLessonPlan;
  }
}
