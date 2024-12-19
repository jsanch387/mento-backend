import { Controller, Post, Body } from '@nestjs/common';
import { RatingService } from './rating.service';

@Controller('rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post()
  async submitRating(
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      rating: number;
      comment?: string;
    },
  ) {
    // Validate input
    if (
      !body.firstName ||
      !body.lastName ||
      !body.email ||
      !body.rating ||
      body.rating < 1 ||
      body.rating > 5
    ) {
      return { error: 'Invalid input. Please provide valid feedback.' };
    }

    // Save feedback and return success
    const result = await this.ratingService.submitFeedback(body);
    return { message: 'Thank you for your feedback!', result };
  }
}
