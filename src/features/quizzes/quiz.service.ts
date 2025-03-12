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
import { GradedAnswer, GradedQuizResponse, QuizData } from './types/quiz.types'; // ✅ Use extracted types
import { generateQRCode } from './utils/qr.utils';
import { generateGradingPrompt } from './utils/quizGrading.utils';
// import { parseStrictJSON } from './utils/json.utls';

// Define types for database results
interface QuizOverview {
  id: string;
  quiz_id: string;
  class_name: string;
  launch_date: Date;
  title: string;
  total_questions: number;
  students_taken: number;
  average_score: number;
  ai_insights: any;
  launch_url: string;
  status: string;
}

interface StudentResult {
  student_id: string;
  student_name: string;
  score: number;
  graded_answers: string; // Stored as JSON string, needs parsing
}

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

      // ✅ Save the launch record to the database, including deployment_url
      const query = `
        INSERT INTO launched_quizzes (id, quiz_id, user_id, class_name, notes, deployment_url)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

      const values = [
        launchId,
        quizId,
        userId,
        className,
        notes,
        deploymentLink,
      ];

      await this.databaseService.query(query, values);
      console.log(`📥 Launch record saved to DB with deployment URL`);

      return { launchId, deploymentLink, qrCodeData };
    } catch (error) {
      console.error(`❌ Error launching quiz:`, error);
      throw new InternalServerErrorException('Failed to launch quiz.');
    }
  }

  // ✅ Fetch launched quiz details for student to take
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

  async getLaunchedQuizzes(userId: string) {
    try {
      console.log(`🔍 Fetching launched quizzes for userId: ${userId}`);

      const query = `
        SELECT 
          l.id, 
          l.quiz_id, 
          l.class_name, 
          l.created_at AS launch_date,
          q.title, 
          l.status, -- ✅ Fetch the quiz status from launched_quizzes
          COALESCE(l.students_completed, 0) AS students_completed,
          COALESCE(l.average_score, 0) AS average_score,
          COALESCE(l.smart_insights, '{}'::jsonb) AS smart_insights,
          COALESCE(l.deployment_url, '') AS deployment_url
        FROM launched_quizzes l
        JOIN quizzes q ON l.quiz_id = q.id
        WHERE l.user_id = $1
        ORDER BY l.created_at DESC;
      `;

      const results = await this.databaseService.query(query, [userId]);

      if (results.length === 0) {
        console.warn(`⚠️ No launched quizzes found for userId: ${userId}`);
        return [];
      }

      console.log(
        `✅ Fetched ${results.length} launched quizzes for userId: ${userId}`,
      );
      return results;
    } catch (error) {
      console.error('❌ Error fetching launched quizzes:', error);
      throw new InternalServerErrorException(
        'Failed to fetch launched quizzes.',
      );
    }
  }

  // async getExistingLaunchForQuiz(quizId: string) {
  //   const query = `
  //     SELECT id, quiz_id, user_id, class_name, created_at
  //     FROM launched_quizzes
  //     WHERE quiz_id = $1
  //     ORDER BY created_at DESC
  //     LIMIT 1;
  //   `;

  //   const results = await this.databaseService.query(query, [quizId]);

  //   if (results.length > 0) {
  //     const launch = results[0] as LaunchedQuiz;

  //     const link = `${process.env.FRONTEND_URL}/quiz/${launch.id}`;
  //     const qrCodeData = await generateQRCode(link);

  //     return {
  //       exists: true,
  //       launchId: launch.id,
  //       deploymentLink: link,
  //       qrCodeData,
  //       className: launch.class_name,
  //       createdAt: launch.created_at,
  //     };
  //   } else {
  //     return { exists: false };
  //   }
  // }

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
      VALUES ($1::UUID, $2, $3, $4);
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

          // ✅ Save Student's Graded Quiz
          await this.saveGradedQuizToDatabase(
            submission.deploymentId,
            submission.studentName,
            gradedResult.gradedAnswers,
          );

          // ✅ After Saving, Update Launched Quiz Stats
          await this.updateLaunchedQuizStats(submission.deploymentId);

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

  //* ✅ Updates students_completed & average_score in launched_quizzes
  async updateLaunchedQuizStats(deploymentId: string) {
    console.log(`📊 Updating stats for launched quiz: ${deploymentId}`);

    const updateQuery = `
      UPDATE launched_quizzes
      SET 
        students_completed = (
          SELECT COUNT(*) FROM student_quiz_results WHERE deployment_id = $1
        ),
        average_score = (
          SELECT COALESCE(AVG(score_percentage), 0) 
          FROM student_quiz_results 
          WHERE deployment_id = $1
        )
      WHERE id = $1::UUID; -- Ensure it's treated as a UUID
    `;

    try {
      await this.databaseService.query(updateQuery, [deploymentId]);
      console.log(`✅ Successfully updated launched quiz stats.`);
    } catch (error) {
      console.error(`❌ Failed to update launched quiz stats:`, error);
    }
  }

  async getLaunchedQuizOverview(launchId: string): Promise<{
    id: string;
    title: string;
    className: string;
    launchDate: Date;
    studentsTaken: number;
    averageScore: number;
    status: string;
    launchUrl: string;
    qrCodeData?: string; // ✅ Add QR Code field
    totalQuestions: number;
    aiInsights: any;
    students: {
      id: string;
      name: string;
      score: number;
      correct: number;
      incorrect: number;
      status: string;
    }[];
  }> {
    try {
      console.log(
        `📊 Fetching launched quiz overview for launchId: ${launchId}`,
      );

      // Query to fetch quiz overview
      const quizQuery = `
        SELECT 
          l.id, 
          l.quiz_id, 
          l.class_name, 
          l.created_at AS launch_date,
          q.title, 
          q.number_of_questions AS total_questions,
          COALESCE(l.students_completed, 0) AS students_taken,
          COALESCE(l.average_score, 0) AS average_score,
          COALESCE(l.smart_insights, '{}'::jsonb) AS ai_insights, 
          COALESCE(l.deployment_url, '') AS launch_url,
          l.status
        FROM launched_quizzes l
        JOIN quizzes q ON l.quiz_id = q.id
        WHERE l.id = $1;
      `;

      // Query to fetch student results
      const studentResultsQuery = `
        SELECT 
          id AS student_id, 
          student_name, 
          score_percentage AS score, 
          graded_answers
        FROM student_quiz_results
        WHERE deployment_id = $1;
      `;

      // Fetch quiz overview
      const quizOverviewResult: QuizOverview[] =
        await this.databaseService.query(quizQuery, [launchId]);

      if (quizOverviewResult.length === 0) {
        throw new NotFoundException(
          `❌ No quiz found for launchId: ${launchId}`,
        );
      }
      const quizOverview = quizOverviewResult[0];

      // Fetch student results
      const studentResults: StudentResult[] = await this.databaseService.query(
        studentResultsQuery,
        [launchId],
      );

      // Process student results
      const formattedStudents = studentResults.map((student) => {
        let answers: { isCorrect: boolean }[] = [];

        try {
          answers =
            typeof student.graded_answers === 'string'
              ? JSON.parse(student.graded_answers)
              : student.graded_answers;
        } catch (error) {
          console.error(
            `❌ Failed to parse graded_answers for student ${student.student_name}:`,
            error,
          );
          answers = [];
        }

        return {
          id: student.student_id,
          name: student.student_name,
          score: student.score,
          correct: answers.filter((a) => a.isCorrect).length,
          incorrect: answers.filter((a) => !a.isCorrect).length,
          status: 'Completed',
        };
      });

      // ✅ Generate QR Code dynamically for the launch URL
      const qrCodeData = await generateQRCode(quizOverview.launch_url);

      return {
        id: quizOverview.id,
        title: quizOverview.title,
        className: quizOverview.class_name,
        launchDate: quizOverview.launch_date,
        studentsTaken: quizOverview.students_taken,
        averageScore: quizOverview.average_score,
        status: quizOverview.status,
        launchUrl: quizOverview.launch_url,
        qrCodeData, // ✅ Include the QR Code in the response
        totalQuestions: quizOverview.total_questions,
        aiInsights: quizOverview.ai_insights,
        students: formattedStudents,
      };
    } catch (error) {
      console.error('❌ Error fetching launched quiz overview:', error);
      throw new InternalServerErrorException(
        'Failed to fetch launched quiz overview.',
      );
    }
  }
}
