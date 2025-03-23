import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../../services/openai.service';
import { DatabaseService } from '../../services/database.service';
import { extractTitle } from './utils/extractTitle';
import { generateLessonPlanPrompt } from './utils/generateLessonPlanPrompt';

@Injectable()
export class LessonPlanService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly databaseService: DatabaseService,
  ) {}

  async generateLessonPlan(
    userId: string,
    promptDetails: {
      gradeLevel: string;
      subject: string;
      duration: string;
      additionalDetails?: string;
    },
  ): Promise<any> {
    const prompt = generateLessonPlanPrompt(promptDetails);
    const markdownContent =
      await this.openAIService.generateTextContent(prompt);

    const title = extractTitle(markdownContent);

    const result = await this.databaseService.query(
      `
      INSERT INTO markdown_lesson_plans 
      (user_id, grade_level, subject, duration, additional_details, content, title)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, title, grade_level, subject, duration, additional_details, content, created_at;
      `,
      [
        userId,
        promptDetails.gradeLevel,
        promptDetails.subject,
        promptDetails.duration,
        promptDetails.additionalDetails || null,
        markdownContent,
        title,
      ],
    );

    return result[0];
  }

  async getLessonPlanById(id: string): Promise<any> {
    const result = await this.databaseService.query(
      `
      SELECT * FROM markdown_lesson_plans
      WHERE id = $1
      LIMIT 1;
      `,
      [id],
    );

    return result[0] || null;
  }
}
