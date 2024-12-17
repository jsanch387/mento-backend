import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../../services/openai.service';
import { DatabaseService } from '../../services/database.service';
import { generateLessonPlanPrompt } from './lesson-plan.util';

@Injectable()
export class LessonPlanService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly databaseService: DatabaseService,
  ) {}

  async createLessonPlan(
    userId: string,
    promptDetails: {
      gradeLevel: string;
      subject: string;
      duration: string;
      additionalDetails?: string;
    },
  ): Promise<any> {
    // Generate the prompt
    const prompt = generateLessonPlanPrompt(promptDetails);

    // Get the lesson plan from OpenAI
    const lessonPlan = await this.openAIService.generateContent(prompt);

    // Save to database
    await this.databaseService.query(
      `
      INSERT INTO lesson_plans (user_id, title, overview, materials, learning_objectives, lesson_plan_structure)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
      RETURNING *;
      `,
      [
        userId,
        lessonPlan.title,
        JSON.stringify(lessonPlan.overview),
        JSON.stringify(lessonPlan.materials),
        JSON.stringify(lessonPlan.learningObjectives),
        JSON.stringify(lessonPlan.lessonPlanStructure),
      ],
    );

    return lessonPlan;
  }
}
