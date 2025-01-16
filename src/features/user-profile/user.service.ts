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

  //gets the user profile f name, l name, teir, token by id
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

  //update user info
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
    const tokenLimits = { free: 4, basic: 20, pro: 50, unlimited: null };

    try {
      // Fetch current token balance and plan
      const queryGet = `SELECT tokens, tier FROM profiles WHERE id = $1;`;
      const result = await this.databaseService.query<{
        tokens: number | null;
        tier: string;
      }>(queryGet, [userId]);

      if (result.length === 0) {
        console.error(`User with ID ${userId} not found.`);
        return null;
      }

      const currentTokens = result[0].tokens || 0;
      const currentTier = result[0].tier;

      console.log(
        `User ${userId} current plan: ${currentTier}, current tokens: ${currentTokens}`,
      );

      // Determine the new token balance based on the plan
      let newTokens: number | null = null;

      if (plan === 'free') {
        if (currentTier !== 'free') {
          // If switching back to the free plan, keep the existing tokens
          newTokens = currentTokens;
          console.log(
            `Switching user ${userId} to free plan. Keeping tokens: ${newTokens}`,
          );
        } else {
          // For new users signing up for the free plan, assign free tokens
          newTokens = tokenLimits.free || 0;
          console.log(
            `Assigning free plan tokens (${newTokens}) to new user ${userId}.`,
          );
        }
      } else if (plan === 'unlimited') {
        // For unlimited plan, set tokens to null
        newTokens = null;
        console.log(`Switching user ${userId} to unlimited plan.`);
      } else {
        // For paid plans, add the plan's token allocation to the current balance
        const planTokens = tokenLimits[plan] || 0;
        newTokens = currentTokens + planTokens;
        console.log(
          `Switching user ${userId} to ${plan} plan. Adding ${planTokens} tokens.`,
        );
      }

      console.log(
        `Updating user ${userId} plan to ${plan}. Final token balance: ${newTokens}`,
      );

      // Update the profile in the database
      const queryUpdate = `
        UPDATE profiles
        SET tier = $1,
            tokens = $2
        WHERE id = $3
        RETURNING tier, tokens;
      `;
      const updateResult = await this.databaseService.query<UserProfile>(
        queryUpdate,
        [plan, newTokens, userId],
      );

      if (updateResult.length === 0) {
        console.error(`Failed to update user plan for user: ${userId}`);
        return null;
      }

      console.log(
        `Plan updated successfully for user ${userId}. New tier: ${plan}, Tokens: ${newTokens}`,
      );

      return updateResult[0];
    } catch (error) {
      console.error('Error updating user plan:', error.message);
      throw new Error('Failed to update user plan.');
    }
  }
}
