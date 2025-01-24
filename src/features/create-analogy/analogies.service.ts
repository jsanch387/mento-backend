import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../../services/openai.service';
import { DatabaseService } from '../../services/database.service';
import { generateAnalogyPrompt } from './analgoies.utils';

interface Analogy {
  title: string;
  analogy: string;
}

interface AnalogiesResponse {
  analogy1: Analogy;
  analogy2: Analogy;
}

interface AnalogyGroupInsertResult {
  id: number; // Matches the column type in your database
}

@Injectable()
export class AnalogiesService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Generates analogies using OpenAI and saves them to the database.
   */
  async createAnalogy(
    userId: string,
    details: {
      gradeLevel: string;
      subject: string;
      context: string;
    },
  ): Promise<{ groupId: number; analogies: AnalogiesResponse }> {
    // Generate the prompt
    const prompt = generateAnalogyPrompt(details);

    // Fetch analogies from OpenAI
    const analogies: AnalogiesResponse =
      await this.openAIService.generateContent(prompt);

    // Insert into analogy_groups and get the group_id
    const groupIdResult: AnalogyGroupInsertResult[] =
      await this.databaseService.query(
        `
      INSERT INTO analogy_groups (user_id, context, grade_level, subject, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id;
      `,
        [userId, details.context, details.gradeLevel, details.subject],
      );

    const groupId = groupIdResult[0]?.id;
    if (!groupId) {
      throw new Error('Failed to create analogy group.');
    }

    // Insert both analogies into the analogies table
    const analogyKeys = ['analogy1', 'analogy2'] as const;
    for (const key of analogyKeys) {
      const analogy = analogies[key];
      if (analogy) {
        await this.databaseService.query(
          `
          INSERT INTO analogies (group_id, title, analogy, created_at)
          VALUES ($1, $2, $3, NOW());
          `,
          [groupId, analogy.title, analogy.analogy],
        );
      }
    }

    return { groupId, analogies };
  }

  /**
   * Retrieves an analogy by its ID.
   */
  /**
   * Retrieves all analogies for a specific group ID.
   */
  async getAnalogiesByGroup(userId: string, groupId: string): Promise<any[]> {
    const query = `
    SELECT a.id, a.title, a.analogy, ag.context, ag.grade_level, ag.subject, a.created_at
    FROM analogies a
    JOIN analogy_groups ag ON a.group_id = ag.id
    WHERE ag.user_id = $1 AND ag.id = $2
    ORDER BY a.created_at DESC;
  `;

    const result = await this.databaseService.query(query, [userId, groupId]);
    return result;
  }
}
