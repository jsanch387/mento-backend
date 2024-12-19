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

    return result[0];
  }

  async updateUserProfile(
    userId: string,
    updateData: { firstName?: string; lastName?: string },
  ) {
    const query = `
      UPDATE profiles
      SET first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name)
      WHERE id = $1
      RETURNING first_name, last_name, tier;
    `;

    const result = await this.databaseService.query(query, [
      userId,
      updateData.firstName,
      updateData.lastName,
    ]);

    if (result.length === 0) {
      return null; // Update failed
    }

    return result[0];
  }
}
