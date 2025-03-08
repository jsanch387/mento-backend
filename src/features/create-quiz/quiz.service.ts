import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { OpenAIService } from '../../services/openai.service';
import { DatabaseService } from '../../services/database.service';
import { generateQuizPrompt } from './utils/quiz.utils';
import { v4 as uuidv4 } from 'uuid';
import { INSERT_QUIZ, GET_QUIZ_BY_ID } from './queries/quiz.queries';
import {
  GradedAnswer,
  GradedQuizResponse,
  LaunchedQuiz,
  QuizData,
} from './types/quiz.types'; // ✅ Use extracted types
import { generateQRCode } from './utils/qr.utils';
import { generateGradingPrompt } from './utils/quizGrading.utils';
// import { parseStrictJSON } from './utils/json.utls';

@Injectable()
export class QuizService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly databaseService: DatabaseService,
  ) {}

  // ✅ Generate a new quiz
  async generateQuiz(
    userId: string,
    input: {
      subject: string;
      topic: string;
      gradeLevel: string;
      numberOfQuestions: number;
      questionTypes: string[];
      customInstructions?: string;
    },
  ): Promise<QuizData> {
    if (
      !input.subject ||
      !input.topic ||
      !input.gradeLevel ||
      !input.numberOfQuestions ||
      !input.questionTypes.length
    ) {
      throw new InternalServerErrorException('Missing required fields.');
    }

    console.log('🚀 Generating AI prompt...');
    const prompt = generateQuizPrompt(input);
    console.log('🔍 Sending request to OpenAI...');
    const aiResponse = await this.openAIService.generateContent(prompt);

    if (
      !aiResponse ||
      !Array.isArray(aiResponse.quiz_content) ||
      typeof aiResponse.teaching_insights !== 'string'
    ) {
      console.error('❌ AI response missing expected fields:', aiResponse);
      throw new InternalServerErrorException(
        'AI response is missing expected fields.',
      );
    }

    console.log('✅ AI response validated successfully.');

    // ✅ Ensure quizData includes all required fields
    const quizData: Omit<QuizData, 'id' | 'created_at'> = {
      user_id: userId,
      title: `Quiz on ${input.topic}`,
      grade_level: input.gradeLevel,
      subject: input.subject,
      topic: input.topic,
      number_of_questions: input.numberOfQuestions,
      question_types: input.questionTypes,
      quiz_content: aiResponse.quiz_content,
      teaching_insights: aiResponse.teaching_insights,
      custom_instructions: input.customInstructions || null,
    };

    try {
      const values = [
        quizData.user_id,
        quizData.title,
        quizData.grade_level,
        quizData.subject,
        quizData.topic,
        quizData.number_of_questions,
        quizData.question_types,
        JSON.stringify(quizData.quiz_content),
        quizData.teaching_insights,
        quizData.custom_instructions,
      ];

      // ✅ Explicitly define `savedQuiz` as `QuizData[]`
      const savedQuiz: QuizData[] = await this.databaseService.query(
        INSERT_QUIZ,
        values,
      );

      // ✅ Ensure the database returned a valid result
      if (!savedQuiz || savedQuiz.length === 0) {
        throw new InternalServerErrorException(
          'Database did not return saved quiz.',
        );
      }

      console.log('📥 Quiz saved successfully:', savedQuiz[0]);

      return savedQuiz[0]; // ✅ Return only the first quiz entry
    } catch (error) {
      console.error('❌ Error saving quiz:', error);
      throw new InternalServerErrorException('Failed to save quiz.');
    }
  }

  // ✅ Get quiz by ID
  async getQuizById(id: string): Promise<QuizData> {
    try {
      const results: QuizData[] = await this.databaseService.query(
        GET_QUIZ_BY_ID,
        [id],
      );

      // ✅ Ensure the query actually returned a result
      if (!results || results.length === 0) {
        throw new NotFoundException(`❌ Quiz with ID ${id} not found`);
      }

      console.log(`✅ Fetched Quiz:`, results[0]);

      return results[0]; // ✅ Now TypeScript knows it is `QuizData`
    } catch (error) {
      console.error('❌ Error fetching quiz:', error);
      throw new InternalServerErrorException('Failed to fetch quiz.');
    }
  }

  // ✅ Launch a quiz (save it as launched and generate QR code)
  async launchQuiz(
    userId: string,
    quizId: string,
    className: string,
    notes: string = '',
  ) {
    try {
      console.log(`🚀 Launching Quiz ID: ${quizId} for User ID: ${userId}`);
      console.log(`📚 Class Name: ${className}`);
      if (notes) {
        console.log(`📝 Notes: ${notes}`);
      }

      const launchId = uuidv4();
      console.log(`🆕 Generated Launch ID: ${launchId}`);

      const deploymentLink = `${process.env.FRONTEND_URL}/quiz/${launchId}`;
      console.log(`🔗 Deployment Link: ${deploymentLink}`);

      // ✅ Generate QR code data for the deployment link
      const qrCodeData = await generateQRCode(deploymentLink);
      console.log(`✅ QR Code Generated`);

      // ✅ Save the launch record to the database
      const query = `
        INSERT INTO launched_quizzes (id, quiz_id, user_id, class_name, notes)
        VALUES ($1, $2, $3, $4, $5)
      `;

      const values = [launchId, quizId, userId, className, notes];

      await this.databaseService.query(query, values);
      console.log(`📥 Launch record saved to DB`);

      return { launchId, deploymentLink, qrCodeData };
    } catch (error) {
      console.error(`❌ Error launching quiz:`, error);
      throw new InternalServerErrorException('Failed to launch quiz.');
    }
  }

  // ✅ Fetch launched quiz details
  async getLaunchedQuiz(launchId: string) {
    try {
      console.log(`🔍 Fetching launched quiz for launchId: ${launchId}`);

      const query = `
        SELECT l.id, l.quiz_id, l.class_name, l.notes, l.created_at, q.title, q.quiz_content
        FROM launched_quizzes l
        JOIN quizzes q ON l.quiz_id = q.id
        WHERE l.id = $1
      `;

      const results = await this.databaseService.query(query, [launchId]);

      if (results.length === 0) {
        throw new NotFoundException(
          `❌ Quiz not found for launchId: ${launchId}`,
        );
      }

      console.log(`✅ Quiz fetched successfully for launchId: ${launchId}`);
      return results[0];
    } catch (error) {
      console.error('❌ Error fetching launched quiz:', error);
      throw new InternalServerErrorException('Failed to fetch launched quiz.');
    }
  }

  async getExistingLaunchForQuiz(quizId: string) {
    const query = `
      SELECT id, quiz_id, user_id, class_name, created_at
      FROM launched_quizzes
      WHERE quiz_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const results = await this.databaseService.query(query, [quizId]);

    if (results.length > 0) {
      const launch = results[0] as LaunchedQuiz;

      const link = `${process.env.FRONTEND_URL}/quiz/${launch.id}`;
      const qrCodeData = await generateQRCode(link);

      return {
        exists: true,
        launchId: launch.id,
        deploymentLink: link,
        qrCodeData,
        className: launch.class_name,
        createdAt: launch.created_at,
      };
    } else {
      return { exists: false };
    }
  }

  async saveGradedQuizToDatabase(
    deploymentId: string,
    studentName: string,
    gradedAnswers: GradedAnswer[],
  ) {
    const totalQuestions = gradedAnswers.length;
    const totalCorrect = gradedAnswers.filter((a) => a.isCorrect).length;
    const scorePercentage = (totalCorrect / totalQuestions) * 100;

    const query = `
      INSERT INTO student_quiz_results (deployment_id, student_name, graded_answers, score_percentage)
      VALUES ($1, $2, $3, $4);
    `;

    const values = [
      deploymentId,
      studentName,
      JSON.stringify(gradedAnswers),
      scorePercentage,
    ];

    try {
      await this.databaseService.query(query, values);
      console.log(`✅ Saved graded quiz for ${studentName}`);
    } catch (error) {
      console.error(`❌ Failed to save graded quiz for ${studentName}:`, error);
      throw new InternalServerErrorException(
        'Failed to save graded quiz result',
      );
    }
  }

  async gradeStudentQuiz(submission: any): Promise<GradedQuizResponse> {
    console.log(
      '🚀 Received submission for grading:',
      JSON.stringify(submission, null, 2),
    );
    console.log(`📎 Deployment ID Received: ${submission.deploymentId}`);

    const prompt = generateGradingPrompt(submission);
    console.log('🚀 Sending quiz for AI grading...');

    let gradedResult: GradedQuizResponse | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      console.log(`🔄 Grading attempt ${attempt}...`);

      try {
        const aiResponse = await this.openAIService.generateContent(prompt);

        console.log(
          '🔎 Parsed AI Response:',
          JSON.stringify(aiResponse, null, 2),
        );

        if (aiResponse && Array.isArray(aiResponse.gradedAnswers)) {
          gradedResult = aiResponse;
          console.log(`✅ Quiz graded successfully on attempt ${attempt}`);

          console.log(
            `💾 Saving graded quiz to database - Deployment ID: ${submission.deploymentId}`,
          );

          // ✅ After successful grading, save to Supabase
          await this.saveGradedQuizToDatabase(
            submission.deploymentId,
            submission.studentName,
            gradedResult.gradedAnswers,
          );

          return gradedResult;
        } else {
          console.warn(
            `⚠️ AI response did not match expected format (Attempt ${attempt}):`,
            aiResponse,
          );
        }
      } catch (error: any) {
        console.error(
          `❌ Error grading quiz (Attempt ${attempt}): ${error.message}`,
        );
      }
    }

    throw new InternalServerErrorException(
      'AI failed to grade the quiz after multiple attempts. Please try again later.',
    );
  }
}
