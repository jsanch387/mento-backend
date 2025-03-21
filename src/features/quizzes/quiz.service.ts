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
// interface QuizOverview {
//   id: string;
//   quiz_id: string;
//   class_name: string;
//   launch_date: Date;
//   title: string;
//   total_questions: number;
//   students_taken: number;
//   average_score: number;
//   ai_insights: any;
//   launch_url: string;
//   status: string;
// }

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

    const prompt = generateQuizPrompt(input);

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
      const launchId = uuidv4();

      const deploymentLink = `${process.env.FRONTEND_URL}/quiz/${launchId}`;

      // ✅ Generate QR code data for the deployment link
      const qrCodeData = await generateQRCode(deploymentLink);

      // ✅ Generate a secure 6-digit numeric access code
      const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

      // ✅ Save the launch record to the database, including access code
      const query = `
      INSERT INTO launched_quizzes (id, quiz_id, user_id, class_name, notes, deployment_url, access_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

      const values = [
        launchId,
        quizId,
        userId,
        className,
        notes,
        deploymentLink,
        accessCode,
      ];
      await this.databaseService.query(query, values);

      // ✅ Return access code along with other data
      return {
        message: 'Quiz launched successfully!',
        launchId,
        deploymentLink,
        qrCodeData,
        accessCode, // ✅ Include access code
      };
    } catch (error) {
      console.error(`❌ Error launching quiz:`, error);
      throw new InternalServerErrorException('Failed to launch quiz.');
    }
  }

  // ✅ Fetch launched quiz details for student to take
  async getLaunchedQuiz(launchId: string) {
    try {
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

      return results[0];
    } catch (error) {
      console.error('❌ Error fetching launched quiz:', error);
      throw new InternalServerErrorException('Failed to fetch launched quiz.');
    }
  }

  async getLaunchedQuizzes(userId: string) {
    try {
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
    } catch (error) {
      console.error(`❌ Failed to save graded quiz for ${studentName}:`, error);
      throw new InternalServerErrorException(
        'Failed to save graded quiz result',
      );
    }
  }

  async gradeStudentQuiz(submission: any): Promise<GradedQuizResponse> {
    const prompt = generateGradingPrompt(submission);

    let gradedResult: GradedQuizResponse | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const aiResponse = await this.openAIService.generateContent(prompt);

        if (aiResponse && Array.isArray(aiResponse.gradedAnswers)) {
          gradedResult = aiResponse;

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
    const updateQuery = `
    UPDATE launched_quizzes
    SET 
      students_completed = (
        SELECT COUNT(*) FROM student_quiz_results WHERE deployment_id = $1
      ),
      average_score = (
        SELECT COALESCE(ROUND(AVG(score_percentage)), 0)  -- ✅ Round to whole number
        FROM student_quiz_results 
        WHERE deployment_id = $1
      )
    WHERE id = $1::UUID; -- Ensure it's treated as a UUID
  `;

    try {
      await this.databaseService.query(updateQuery, [deploymentId]);
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
    qrCodeData?: string; // ✅ QR Code field
    accessCode: string; // ✅ Include Access Code
    totalQuestions: number;
    smartInsights: string | null; // ✅ Updated type from JSONB to TEXT
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
      // ✅ Query to fetch quiz overview including access code
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
          COALESCE(l.smart_insights, '') AS smart_insights, -- ✅ Updated to handle TEXT type
          COALESCE(l.deployment_url, '') AS launch_url,
          l.status,
          l.access_code AS access_code -- ✅ Include Access Code
        FROM launched_quizzes l
        JOIN quizzes q ON l.quiz_id = q.id
        WHERE l.id = $1;
      `;

      // ✅ Query to fetch student results
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
      const quizOverviewResult = await this.databaseService.query(quizQuery, [
        launchId,
      ]);

      if (quizOverviewResult.length === 0) {
        throw new NotFoundException(
          `❌ No quiz found for launchId: ${launchId}`,
        );
      }

      const quizOverview = quizOverviewResult[0] as {
        id: string;
        title: string;
        class_name: string;
        launch_date: Date;
        students_taken: number;
        average_score: number;
        status: string;
        launch_url: string;
        smart_insights: string | null;
        total_questions: number;
        access_code: string; // ✅ Store Access Code
      };

      // Fetch student results
      const studentResults = await this.databaseService.query(
        studentResultsQuery,
        [launchId],
      );

      // ✅ Process student results
      const formattedStudents = (studentResults as StudentResult[]).map(
        (student) => {
          let answers: { isCorrect: boolean }[] = [];

          try {
            answers =
              typeof student.graded_answers === 'string'
                ? JSON.parse(student.graded_answers)
                : (student.graded_answers as { isCorrect: boolean }[]);
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
        },
      );

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
        accessCode: quizOverview.access_code, // ✅ Include Access Code
        totalQuestions: quizOverview.total_questions,
        smartInsights: quizOverview.smart_insights || null, // ✅ Ensure correct type
        students: formattedStudents,
      };
    } catch (error) {
      console.error('❌ Error fetching launched quiz overview:', error);
      throw new InternalServerErrorException(
        'Failed to fetch launched quiz overview.',
      );
    }
  }

  async updateQuizStatus(
    quizId: string,
    status: string,
    smartInsights: string | null,
  ) {
    try {
      const query = `
        UPDATE launched_quizzes
        SET status = $1, smart_insights = $2
        WHERE id = $3
      `;

      await this.databaseService.query(query, [status, smartInsights, quizId]);
    } catch (error) {
      console.error('❌ Error updating quiz status and insights:', error);
      throw new InternalServerErrorException(
        'Failed to update quiz status and save insights.',
      );
    }
  }

  async generateSmartInsights(quizId: string): Promise<string | null> {
    try {
      // Fetch quiz metadata (average score, etc.)
      const quizQuery = `
        SELECT average_score 
        FROM launched_quizzes 
        WHERE id = $1
      `;
      const quizData = await this.databaseService.query(quizQuery, [quizId]);

      if (!quizData.length) {
        console.warn(`⚠ No quiz found for ID: ${quizId}.`);
        return 'No quiz data available.';
      }

      const averageScore = (quizData[0] as { average_score: number })
        .average_score; // ✅ Use pre-calculated average score

      // Fetch student results
      const resultsQuery = `
        SELECT student_name, score_percentage, graded_answers
        FROM student_quiz_results
        WHERE deployment_id = $1
      `;

      const studentResults = await this.databaseService.query(resultsQuery, [
        quizId,
      ]);

      if (!studentResults.length) {
        console.warn(`⚠ No student results found for quiz ${quizId}.`);
        return 'There are no student responses yet. Please wait for more students to submit the quiz.';
      }

      // ✅ Ensure we send all needed data to AI
      const processedData = this.prepareQuizDataForAI(
        studentResults,
        averageScore,
      );

      const prompt = this.generateInsightsPrompt(processedData);

      const aiResponse = await this.openAIService.generateTextContent(prompt);

      if (!aiResponse) {
        console.error('❌ AI response missing.');
        return 'Smart insights could not be generated at this time. Please try again later.';
      }

      return aiResponse;
    } catch (error) {
      console.error('❌ Error generating Smart Insights:', error);
      return 'Smart insights could not be generated due to an error.';
    }
  }

  private prepareQuizDataForAI(studentResults: any[], averageScore: number) {
    const questionMissCount: Record<string, number> = {};
    const strugglingStudents: string[] = [];
    const topStudents: string[] = [];
    const middleTier: string[] = [];

    studentResults.forEach((student) => {
      let correctCount = 0;

      student.graded_answers.forEach((answer: any) => {
        if (!answer.isCorrect) {
          // Track most-missed questions
          questionMissCount[answer.question] =
            (questionMissCount[answer.question] || 0) + 1;
        } else {
          correctCount++;
        }
      });

      const percentage = (correctCount / student.graded_answers.length) * 100;
      if (percentage < 50) strugglingStudents.push(student.student_name);
      else if (percentage >= 50 && percentage < 80)
        middleTier.push(student.student_name);
      else topStudents.push(student.student_name);
    });

    const mostMissedQuestions = Object.entries(questionMissCount)
      .sort((a, b) => b[1] - a[1])
      .map(([question, timesMissed]) => ({
        question,
        timesMissed,
        reason:
          'This question was commonly missed, indicating a need for further explanation or practice.',
      }));

    return {
      totalStudents: studentResults.length,
      averageScore, // ✅ Using the database value instead of recalculating
      mostMissedQuestions,
      topStruggle:
        mostMissedQuestions.length > 0
          ? mostMissedQuestions[0].question
          : 'No major struggles identified',
      strugglingStudents,
      middleTier,
      topStudents,
    };
  }

  private generateInsightsPrompt(quizData: any) {
    return `
    You are an **AI Teaching Assistant** helping a fellow teacher analyze their class quiz results.  
    Your goal is to **highlight patterns, identify struggles, and provide creative, practical recommendations** to help improve student understanding.  
  
    🎯 **How to respond:**  
    - Be **friendly and conversational**, like a teacher talking to another teacher.  
    - Use **plain, simple English** and make it **fun, modern, and engaging**.  
    - Structure insights **clearly using Markdown** for easy scanning.  
    - Give **data-driven teaching suggestions** based on real struggles in this quiz.  
    - Avoid generic advice—**be specific and insightful** based on student performance.  
  
    ---
    ## 📌 Quick Overview  
    - **Class Average Score:** ${quizData.averageScore ?? 'N/A'}%.  
    - **Biggest Challenge:** ${
      quizData.topStruggle?.length
        ? quizData.topStruggle
        : 'No major struggles detected.'
    }  
  
    ---
    ## ❌ What Students Struggled With  
    ${
      quizData.mostMissedQuestions?.length > 0
        ? quizData.mostMissedQuestions
            .map(
              (q) =>
                `- **${q.question}** (Missed ${q.timesMissed} times)  
                💡 Why? ${q.reason}`,
            )
            .join('\n')
        : "Students didn't seem to struggle significantly with any specific question."
    }
  
    ---
    ## 🎯 Student Performance Breakdown  
    - **High Performers (80%+ Score):** ${
      quizData.topStudents?.length > 0
        ? quizData.topStudents.join(', ')
        : 'None'
    }  
    - **Middle Performers (50-79% Score):** ${
      quizData.middleTier?.length > 0 ? quizData.middleTier.join(', ') : 'None'
    }  
    - **Struggling Students (<50% Score):** ${
      quizData.strugglingStudents?.length > 0
        ? quizData.strugglingStudents.join(', ')
        : 'None'
    }  
  
    ---
    ## 📝 Smart Teaching Suggestions  
    Based on the quiz results, here’s what **you can do next** to reinforce learning in a fun and effective way:  
  
    ${
      quizData.mostMissedQuestions?.length > 0
        ? quizData.mostMissedQuestions
            .map(
              (q) =>
                `### **🔹 Reinforce: "${q.question}"**  
                **Why students struggled:** ${q.reason}  
                **Try this approach:** [Let AI suggest an engaging way to teach this topic]`,
            )
            .join('\n\n')
        : 'No extra reinforcement needed this time—great job!'
    }
  
    ---
    ## 📢 Final Thoughts  
    ${quizData.averageScore < 60 ? '📉 This was a tough quiz! Consider a quick review session to clear up confusion.' : '✅ The class did well! A small recap might help reinforce key concepts.'}  
  
    🔹 Keep the feedback **friendly, useful, and insightful**—make it feel like a fellow teacher sharing their best advice!  
    `.trim();
  }

  async verifyAccessCode(
    launchId: string,
    accessCode: string,
  ): Promise<boolean> {
    try {
      const query = `SELECT access_code FROM launched_quizzes WHERE id = $1`;
      const result: { access_code: string }[] =
        await this.databaseService.query(query, [launchId]);

      if (result.length === 0) {
        console.error(`❌ No quiz found for launch ID: ${launchId}`);
        throw new NotFoundException(`Quiz with ID ${launchId} not found.`);
      }

      const storedAccessCode = result[0].access_code;

      if (!storedAccessCode) {
        throw new InternalServerErrorException(
          `Access code is missing for quiz ${launchId}`,
        );
      }

      // Ensure both are strings and trim spaces before comparing
      const storedCode = storedAccessCode.trim();
      const receivedCode = accessCode.trim();

      if (storedCode !== receivedCode) {
        console.warn(`❌ Access code mismatch!`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Error verifying access code:`, error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Failed to verify access code.');
    }
  }
}
