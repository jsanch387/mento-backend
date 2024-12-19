import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/services/database.service';

@Injectable()
export class UserService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserProfileById(userId: string) {
    const query = `
      SELECT profiles.first_name, profiles.last_name, profiles.tier
      FROM profiles
      WHERE profiles.id = $1;
    `;

    const result = await this.databaseService.query(query, [userId]);

    if (result.length === 0) {
      return null; // User not found
    }

    return result[0]; // Return the first matching profile
  }
}
