import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/services/database.service';

interface CountResult {
  count: string; // Postgres COUNT returns a string by default
}

@Injectable()
export class ItemsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserItems(userId: string) {
    // Query lesson_plans table for count
    const lessonPlansResult = await this.databaseService.query<CountResult>(
      `SELECT COUNT(*) as count FROM lesson_plans WHERE user_id = $1;`,
      [userId],
    );

    // Safely parse the count
    const lessonPlansCount = parseInt(lessonPlansResult[0]?.count || '0', 10);

    // Build response
    const items = [];

    // Only include "Lesson Plans" if count > 0
    if (lessonPlansCount > 0) {
      items.push({
        itemType: 'Lesson Plans',
        count: lessonPlansCount,
      });
    }

    return items;
  }

  async getItemPreviews(userId: string, itemType: string): Promise<any[]> {
    switch (itemType) {
      case 'lesson-plans':
        return this.getLessonPlanPreviews(userId);
      // Add more cases later for 'analogies', 'labs', etc.
      default:
        throw new BadRequestException('Invalid item type');
    }
  }

  private async getLessonPlanPreviews(userId: string): Promise<any[]> {
    const query = `
      SELECT id, title, overview->>'gradeLevel' as grade, 
             overview->>'subject' as subject, created_at
      FROM lesson_plans
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await this.databaseService.query(query, [userId]);
    return result;
  }
}
