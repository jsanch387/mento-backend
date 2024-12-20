import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/services/database.service';

export interface UserProfile {
  first_name: string;
  last_name: string;
  tier: string;
  tokens: number | null; // Null for unlimited plan
}

@Injectable()
export class UserService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserProfileById(userId: string): Promise<UserProfile | null> {
    const query = `
      SELECT profiles.first_name, profiles.last_name, profiles.tier, profiles.tokens
      FROM profiles
      WHERE profiles.id = $1;
    `;

    const result = await this.databaseService.query<UserProfile>(query, [
      userId,
    ]);

    if (result.length === 0) {
      return null; // User not found
    }

    return result[0];
  }

  async updateUserProfile(
    userId: string,
    updateData: { firstName?: string; lastName?: string },
  ): Promise<UserProfile | null> {
    const query = `
      UPDATE profiles
      SET first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name)
      WHERE id = $1
      RETURNING first_name, last_name, tier, tokens;
    `;

    const result = await this.databaseService.query<UserProfile>(query, [
      userId,
      updateData.firstName,
      updateData.lastName,
    ]);

    if (result.length === 0) {
      return null; // Update failed
    }

    return result[0];
  }

  async getUserTokenBalance(userId: string): Promise<number | null> {
    const query = `SELECT tokens FROM profiles WHERE id = $1;`;
    const result = await this.databaseService.query<
      Pick<UserProfile, 'tokens'>
    >(query, [userId]);
    return result.length > 0 ? result[0].tokens : null;
  }

  async consumeToken(userId: string): Promise<boolean> {
    const query = `
      UPDATE profiles
      SET tokens = tokens - 1
      WHERE id = $1 AND tokens > 0
      RETURNING tokens;
    `;
    const result = await this.databaseService.query<
      Pick<UserProfile, 'tokens'>
    >(query, [userId]);
    return result.length > 0; // Token successfully consumed
  }

  async updateUserPlan(
    userId: string,
    plan: 'free' | 'basic' | 'pro' | 'unlimited',
  ): Promise<UserProfile | null> {
    const tokenLimits = { free: 4, basic: 30, pro: 100, unlimited: null };

    const query = `
      UPDATE profiles
      SET tier = $1,
          tokens = CASE 
            WHEN $1 = 'unlimited' THEN NULL
            ELSE COALESCE(tokens, 0) + $2
          END
      WHERE id = $3
      RETURNING tier, tokens;
    `;
    const result = await this.databaseService.query<UserProfile>(query, [
      plan,
      tokenLimits[plan],
      userId,
    ]);

    if (result.length === 0) {
      return null; // Update failed
    }

    return result[0];
  }
}
