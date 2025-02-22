import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/services/database.service';

interface CountResult {
  count: string; // Postgres COUNT returns a string by default
}

interface ResourceConfig {
  table: string;
  previewQuery: string;
  displayName: string;
}

const RESOURCE_CONFIG: Record<string, ResourceConfig> = {
  'lesson-plans': {
    table: 'lesson_plans',
    previewQuery: `
      SELECT id, title, overview->>'gradeLevel' as grade, 
             overview->>'subject' as subject, created_at
      FROM lesson_plans
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `,
    displayName: 'Lesson Plans',
  },
  analogies: {
    table: 'analogy_groups',
    previewQuery: `
      SELECT 
        ag.id, 
        ag.context, 
        ag.created_at, 
        ag.subject, 
        ag.grade_level,
        COUNT(a.id) as analogy_count
      FROM analogy_groups ag
      LEFT JOIN analogies a ON ag.id = a.group_id
      WHERE ag.user_id = $1
      GROUP BY ag.id, ag.subject, ag.grade_level
      ORDER BY ag.created_at DESC;
    `,
    displayName: 'Analogies',
  },
  labs: {
    table: 'labs',
    previewQuery: `
      SELECT id, title, subject, grade_level, created_at
      FROM labs
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `,
    displayName: 'Labs',
  },
  quizzes: {
    // 🔥 Updated to include 'topic' field
    table: 'quizzes',
    previewQuery: `
      SELECT id, title, subject, topic, grade_level, number_of_questions, created_at
      FROM quizzes
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `,
    displayName: 'Quizzes',
  },
};

@Injectable()
export class ItemsService {
  constructor(private readonly databaseService: DatabaseService) {}

  // 🔥 Get user items count for all resources including quizzes
  async getUserItems(userId: string) {
    const items = [];

    // Dynamically query and count resources
    for (const [, config] of Object.entries(RESOURCE_CONFIG)) {
      const result = await this.databaseService.query<CountResult>(
        `SELECT COUNT(*) as count FROM ${config.table} WHERE user_id = $1;`,
        [userId],
      );

      const count = parseInt(result[0]?.count || '0', 10);
      if (count > 0) {
        items.push({
          itemType: config.displayName,
          count,
        });
      }
    }

    return items;
  }

  // 🔥 Get item previews (now includes topic for quizzes)
  async getItemPreviews(userId: string, itemType: string): Promise<any[]> {
    const config = RESOURCE_CONFIG[itemType];
    if (!config) {
      throw new BadRequestException('Invalid item type');
    }

    return this.databaseService.query(config.previewQuery, [userId]);
  }
}
