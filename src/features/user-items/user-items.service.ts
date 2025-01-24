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

    // Query analogy_groups table for count
    const analogiesResult = await this.databaseService.query<CountResult>(
      `SELECT COUNT(*) as count FROM analogy_groups WHERE user_id = $1;`,
      [userId],
    );

    // Safely parse the counts
    const lessonPlansCount = parseInt(lessonPlansResult[0]?.count || '0', 10);
    const analogiesCount = parseInt(analogiesResult[0]?.count || '0', 10);

    // Build response
    const items = [];

    // Only include "Lesson Plans" if count > 0
    if (lessonPlansCount > 0) {
      items.push({
        itemType: 'Lesson Plans',
        count: lessonPlansCount,
      });
    }

    // Only include "Analogies" if count > 0
    if (analogiesCount > 0) {
      items.push({
        itemType: 'Analogies',
        count: analogiesCount,
      });
    }

    return items;
  }

  async getItemPreviews(userId: string, itemType: string): Promise<any[]> {
    switch (itemType) {
      case 'lesson-plans':
        return this.getLessonPlanPreviews(userId);
      case 'analogies':
        return this.getAnalogyPreviews(userId);
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

  private async getAnalogyPreviews(userId: string): Promise<any[]> {
    const query = `
      SELECT 
        ag.id, 
        ag.context, 
        ag.created_at, 
        ag.subject, 
        ag.grade_level, -- Fetch subject and grade level
        COUNT(a.id) as analogy_count
      FROM analogy_groups ag
      LEFT JOIN analogies a ON ag.id = a.group_id
      WHERE ag.user_id = $1
      GROUP BY ag.id, ag.subject, ag.grade_level -- Group by the added columns
      ORDER BY ag.created_at DESC;
    `;

    const result = await this.databaseService.query(query, [userId]);
    return result;
  }
}
