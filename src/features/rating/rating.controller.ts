import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
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
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid input. Please provide valid feedback.',
        error: 'Bad Request',
      });
    }

    try {
      const result = await this.ratingService.submitFeedback(body);
      return { message: 'Thank you for your feedback!', result };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error; // Return user-friendly error message
      }
      throw new Error('Something went wrong. Please try again later.'); // Generic fallback for unexpected errors
    }
  }
}
