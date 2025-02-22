import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { QuizService } from './quiz.service';

@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post()
  async generateQuiz(
    @Body()
    body: {
      subject: string; // ✅ Added subject field
      topic: string;
      gradeLevel: string;
      numberOfQuestions: number;
      questionTypes: string[];
      customInstructions?: string;
    },
    @Req() req: any,
  ) {
    const user = req.user;
    const userId = user.sub;

    try {
      console.log(
        `Generating quiz for user: ${userId} | Topic: ${body.topic} | Subject: ${body.subject}`,
      );

      // ✅ Pass the complete body including subject to QuizService
      const quiz = await this.quizService.generateQuiz(userId, body);
      return { quiz };
    } catch (error) {
      console.error('Error generating quiz:', error);
      throw new InternalServerErrorException('Failed to generate quiz');
    }
  }

  @Get('/:id')
  async getQuizById(@Param('id') id: string) {
    try {
      console.log(`Fetching quiz ID: ${id}`);

      const quiz = await this.quizService.getQuizById(id);
      return { quiz };
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
  }
}
