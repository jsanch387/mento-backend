import camelcaseKeys from 'camelcase-keys';
import { Controller, Get, Req } from '@nestjs/common';
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

      // Convert `profile` to a plain object before passing to `camelcaseKeys`
      const plainProfile = JSON.parse(JSON.stringify(profile));

      // Explicitly use `deep: true` if needed for nested objects
      return camelcaseKeys(plainProfile, { deep: true });
    } catch (error) {
      console.error('Error retrieving user profile:', error.message);
      return { error: 'An error occurred while retrieving the user profile.' };
    }
  }
}
