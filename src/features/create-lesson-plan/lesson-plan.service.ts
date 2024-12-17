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

  /**
   * Creates a new lesson plan using OpenAI and stores it in the database.
   */
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

  /**
   * Retrieves a lesson plan by its ID.
   */
  async getLessonPlanById(id: string) {
    const query = `
      SELECT id, user_id, title, overview, materials, learning_objectives, lesson_plan_structure, created_at
      FROM lesson_plans
      WHERE id = $1
    `;
    const results = await this.databaseService.query(query, [id]);

    return results[0] || null; // Return the lesson plan or null if not found
  }
}
