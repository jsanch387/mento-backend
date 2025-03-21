import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { GradedQuizResponse } from './types/quiz.types';

@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  //gets all quizzes that the user has launched
  @Get('/launched')
  async getLaunchedQuizzes(@Req() req) {
    // console.log('🔍 Incoming request user:', req.user);

    if (!req.user || !req.user.sub) {
      console.error('❌ User ID (sub) is missing from request.');
      throw new InternalServerErrorException('User ID is required.');
    }

    const userId = req.user.sub; // ✅ Use `sub` instead of `id`
    return this.quizService.getLaunchedQuizzes(userId);
  }

  //generates a quiz based on the parameters provided
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
      // console.log(
      //   `Generating quiz for user: ${userId} | Topic: ${body.topic} | Subject: ${body.subject}`,
      // );

      // ✅ Pass the complete body including subject to QuizService
      const quiz = await this.quizService.generateQuiz(userId, body);
      return { quiz };
    } catch (error) {
      console.error('Error generating quiz:', error);
      throw new InternalServerErrorException('Failed to generate quiz');
    }
  }

  //gets a quiz by id
  @Get('/:id')
  async getQuizById(@Param('id') id: string) {
    try {
      // console.log(`Fetching quiz ID: ${id}`);

      const quiz = await this.quizService.getQuizById(id);
      return { quiz };
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
  }

  // ✅ Launches a quiz and creates a DB entry for it
  @Post('/:id/launch')
  async launchQuiz(
    @Param('id') quizId: string,
    @Body() body: { className: string; notes?: string },
    @Req() req: any,
  ) {
    const user = req.user;
    const userId = user.sub;

    try {
      // console.log(
      //   `🔹 Teacher [User ID: ${userId}] launching Quiz ID: ${quizId}`,
      // );
      // console.log(`🔹 Class: ${body.className}`);
      if (body.notes) {
        // console.log(`📝 Notes: ${body.notes}`);
      }

      // ✅ Call service method to launch quiz
      const launchData = await this.quizService.launchQuiz(
        userId,
        quizId,
        body.className,
        body.notes || '',
      );

      return {
        message: '🎉 Quiz launched successfully!',
        launchId: launchData.launchId,
        deploymentLink: launchData.deploymentLink,
        qrCodeData: launchData.qrCodeData,
        accessCode: launchData.accessCode, // ✅ Ensure access code is returned
      };
    } catch (error) {
      console.error('❌ Error launching quiz:', error);
      throw new InternalServerErrorException('Failed to launch quiz.');
    }
  }

  //this is for students to access the quiz
  @Get('/launched/:launchId')
  async getLaunchedQuiz(@Param('launchId') launchId: string) {
    try {
      // console.log(`📢 Student accessing quiz with launchId: ${launchId}`);

      const quiz = await this.quizService.getLaunchedQuiz(launchId);

      return { message: 'Quiz retrieved successfully', quiz };
    } catch (error) {
      console.error('❌ Error fetching quiz:', error);
      throw error instanceof NotFoundException
        ? new NotFoundException(error.message)
        : new InternalServerErrorException('Failed to retrieve quiz.');
    }
  }

  // @Get('/:id/existing-launch')
  // async checkExistingLaunch(@Param('id') quizId: string) {
  //   const result = await this.quizService.getExistingLaunchForQuiz(quizId);
  //   return result;
  // }

  //grades the student quiz stores in new row, updates launched_quizzes db entry - count and average
  @Post('/grade')
  async gradeQuiz(
    @Body() submission: any,
  ): Promise<{ gradedAnswers: GradedQuizResponse['gradedAnswers'] }> {
    // console.log('📥 Incoming submission:', JSON.stringify(submission, null, 2));

    try {
      const gradedQuiz = await this.quizService.gradeStudentQuiz(submission);
      return { gradedAnswers: gradedQuiz.gradedAnswers };
    } catch (error) {
      console.error('❌ Failed to grade quiz:', error.message);
      throw new InternalServerErrorException('Failed to grade quiz.');
    }
  }

  //gets the overview of the launched quiz - stats, average, count, etc
  @Get('/launched/:id/overview')
  async getLaunchedQuizOverview(@Param('id') launchId: string) {
    try {
      // console.log(`🔍 Fetching overview for launched quiz: ${launchId}`);
      const quizOverview =
        await this.quizService.getLaunchedQuizOverview(launchId);
      return { quiz: quizOverview };
    } catch (error) {
      console.error('❌ Error fetching launched quiz overview:', error);
      throw new InternalServerErrorException(
        'Failed to fetch launched quiz overview.',
      );
    }
  }

  @Post('/:id/status')
  async updateQuizStatus(
    @Param('id') quizId: string,
    @Body() body: { status: 'active' | 'closed' },
    // @Req() req: any,
  ) {
    // const userId = req.user.sub; // Teacher's ID

    try {
      // console.log(
      //   `🔹 Teacher ${userId} updating Quiz ${quizId} to ${body.status}`,
      // );

      // Validate status
      if (!['active', 'closed'].includes(body.status)) {
        throw new BadRequestException('Invalid quiz status.');
      }

      let smartInsights: string | null = null;

      // ✅ If closing the quiz, generate AI insights
      if (body.status === 'closed') {
        // console.log('📊 Quiz is being closed. Running Smart Insights...');
        smartInsights = await this.quizService.generateSmartInsights(quizId);

        if (!smartInsights) {
          console.warn('⚠ Smart Insights could not be generated.');
          smartInsights = 'Smart insights could not be generated at this time.';
        }
      }

      // ✅ Update quiz status & save insights in the database
      await this.quizService.updateQuizStatus(
        quizId,
        body.status,
        smartInsights,
      );

      // console.log(
      //   `✅ Quiz ${quizId} updated to ${body.status}. Insights saved.`,
      // );

      return {
        message: `✅ Quiz successfully updated to ${body.status}`,
        status: body.status,
        smartInsights,
      };
    } catch (error) {
      console.error('❌ Error updating quiz status:', error);
      throw new InternalServerErrorException('Failed to update quiz status.');
    }
  }

  @Get('/verify-access/:launchId/:accessCode')
  async verifyQuizAccess(
    @Param('launchId') launchId: string,
    @Param('accessCode') accessCode: string,
  ): Promise<{ message: string }> {
    try {
      console.log(`🔑 Verifying access code for quiz: ${launchId}`);

      const isValid = await this.quizService.verifyAccessCode(
        launchId,
        accessCode,
      );

      if (!isValid) {
        throw new UnauthorizedException(`Invalid access code.`);
      }

      return { message: 'Access code verified successfully' };
    } catch (error) {
      console.error(`❌ Error verifying access code:`, error);
      throw error instanceof NotFoundException ||
        error instanceof UnauthorizedException
        ? error
        : new InternalServerErrorException('Failed to verify access code.');
    }
  }
}
