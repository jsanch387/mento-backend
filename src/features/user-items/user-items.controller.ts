import { Controller, Get, Param, Req } from '@nestjs/common';
import { ItemsService } from './user-items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async getUserItems(@Req() req: any) {
    const userId = req.user.sub; // Get user ID from auth middleware
    const items = await this.itemsService.getUserItems(userId);
    return items;
  }

  @Get('preview/:itemType')
  async getItemPreviews(@Param('itemType') itemType: string, @Req() req: any) {
    const userId = req.user.sub; // User ID from middleware

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const previews = await this.itemsService.getItemPreviews(userId, itemType);
    return { previews };
  }
}
