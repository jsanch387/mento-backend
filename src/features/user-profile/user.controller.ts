import camelcaseKeys from 'camelcase-keys';
import { Controller, Get, Patch, Req, Body, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getUserProfile(@Req() req: any) {
    const userId = req.user?.sub; // Extract userId from middleware

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const profile = await this.userService.getUserProfileById(userId);

      if (!profile) {
        return { error: 'User not found.' };
      }

      const plainProfile = JSON.parse(JSON.stringify(profile));
      return camelcaseKeys(plainProfile, { deep: true });
    } catch (error) {
      console.error('Error retrieving user profile:', error.message);
      return { error: 'An error occurred while retrieving the user profile.' };
    }
  }

  @Patch('profile')
  async updateUserProfile(
    @Req() req: any,
    @Body() updateData: { firstName?: string; lastName?: string },
  ) {
    const userId = req.user?.sub;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const updatedProfile = await this.userService.updateUserProfile(
        userId,
        updateData,
      );

      if (!updatedProfile) {
        return { error: 'Failed to update profile.' };
      }

      const plainProfile = JSON.parse(JSON.stringify(updatedProfile));
      return camelcaseKeys(plainProfile, { deep: true });
    } catch (error) {
      console.error('Error updating user profile:', error.message);
      return { error: 'An error occurred while updating the user profile.' };
    }
  }

  @Get('tokens')
  async getUserTokens(@Req() req: any) {
    const userId = req.user?.sub;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const tokens = await this.userService.getUserTokenBalance(userId);
      return { tokens };
    } catch (error) {
      console.error('Error fetching token balance:', error.message);
      return { error: 'Failed to fetch token balance.' };
    }
  }

  @Post('tokens/consume')
  async consumeToken(@Req() req: any) {
    const userId = req.user?.sub;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const success = await this.userService.consumeToken(userId);
      if (!success) {
        return { error: 'Insufficient tokens. Please upgrade your plan.' };
      }
      return { success: true, message: 'Token consumed successfully.' };
    } catch (error) {
      console.error('Error consuming token:', error.message);
      return { error: 'Failed to consume token.' };
    }
  }

  @Patch('plan')
  async updateUserPlan(
    @Req() req: any,
    @Body() body: { plan: 'free' | 'basic' | 'pro' | 'unlimited' },
  ) {
    const userId = req.user?.sub;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const updated = await this.userService.updateUserPlan(userId, body.plan);
      return { success: true, message: 'Plan updated successfully.', updated };
    } catch (error) {
      console.error('Error updating user plan:', error.message);
      return { error: 'Failed to update plan.' };
    }
  }
}
