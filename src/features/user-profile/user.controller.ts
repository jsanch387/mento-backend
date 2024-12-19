import camelcaseKeys from 'camelcase-keys';
import { Controller, Get, Patch, Req, Body } from '@nestjs/common';
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
}
