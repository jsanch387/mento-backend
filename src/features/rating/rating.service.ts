import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/services/database.service';

@Injectable()
export class RatingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async submitFeedback(data: {
    firstName: string;
    lastName: string;
    email: string;
    rating: number;
    comment?: string;
  }) {
    const query = `
      INSERT INTO user_feedback (first_name, last_name, email, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at;
    `;

    const result = await this.databaseService.query(query, [
      data.firstName,
      data.lastName,
      data.email,
      data.rating,
      data.comment || null,
    ]);

    return result[0]; // Return the inserted feedback record
  }
}
