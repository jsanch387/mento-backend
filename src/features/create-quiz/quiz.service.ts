import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { OpenAIService } from '../../services/openai.service';
import { DatabaseService } from '../../services/database.service';
import { generateQuizPrompt } from './quiz.utils';

export interface QuizData {
  id: string;
  user_id: string;
  title: string;
  grade_level: string;
  subject: string; // Teacher-selected subject
  topic: string; // Quiz topic
  number_of_questions: number;
  question_types: string[];
  quiz_content: QuizQuestion[];
  teaching_insights: string;
  custom_instructions?: string;
  created_at: string;
}

export interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'short_answer' | 'true_false' | 'fill_in_the_blank';
  options?: string[]; // For multiple_choice
  correct_answer: string;
  explanation: string;
  hint?: string;
}

@Injectable()
export class QuizService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly databaseService: DatabaseService,
  ) {}

  async generateQuiz(
    userId: string,
    input: {
      subject: string; // <-- Added subject field from teacher input
      topic: string;
      gradeLevel: string;
      numberOfQuestions: number;
      questionTypes: string[];
      customInstructions?: string;
    },
  ): Promise<QuizData> {
    // ✅ Input Validation
    if (
      !input.subject ||
      !input.topic ||
      !input.gradeLevel ||
      !input.numberOfQuestions ||
      !input.questionTypes.length
    ) {
      throw new InternalServerErrorException('Missing required fields.');
    }

    console.log('Generating AI prompt...');
    const prompt = generateQuizPrompt(input);

    console.log('Sending request to OpenAI...');
    const aiResponse = await this.openAIService.generateContent(prompt);

    console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

    // ✅ Validate AI response structure
    if (
      !aiResponse ||
      !Array.isArray(aiResponse.quiz_content) ||
      typeof aiResponse.teaching_insights !== 'string'
    ) {
      console.error('AI response missing expected fields:', aiResponse);
      throw new InternalServerErrorException(
        'AI response is missing expected fields.',
      );
    }

    // ✅ Validate quiz questions
    aiResponse.quiz_content.forEach((question, index) => {
      const {
        question: qText,
        type,
        correct_answer,
        explanation,
        options,
      } = question;

      if (!qText || !type || !correct_answer || !explanation) {
        throw new InternalServerErrorException(
          `Quiz question at index ${index} is missing required fields.`,
        );
      }

      // Check multiple choice options
      if (
        type === 'multiple_choice' &&
        (!Array.isArray(options) || options.length !== 4)
      ) {
        throw new InternalServerErrorException(
          `Multiple-choice question at index ${index} must have exactly four options.`,
        );
      }
    });

    console.log('AI response validated successfully.');

    // ✅ Prepare quiz data
    const quizData: Omit<QuizData, 'id' | 'created_at'> = {
      user_id: userId,
      title: `Quiz on ${input.topic}`,
      grade_level: input.gradeLevel,
      subject: input.subject, // Save the teacher-selected subject
      topic: input.topic, // Save the quiz topic
      number_of_questions: input.numberOfQuestions,
      question_types: input.questionTypes,
      quiz_content: aiResponse.quiz_content,
      teaching_insights: aiResponse.teaching_insights,
      custom_instructions: input.customInstructions || null, // Save custom instructions if provided
    };

    // ✅ Save to Supabase
    try {
      const insertQuery = `
          INSERT INTO quizzes (user_id, title, grade_level, subject, topic, number_of_questions, question_types, quiz_content, teaching_insights, custom_instructions)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *;
        `;

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

      const [savedQuiz]: QuizData[] = await this.databaseService.query(
        insertQuery,
        values,
      );

      console.log('Quiz saved successfully:', savedQuiz);

      return savedQuiz;
    } catch (error) {
      console.error('Error saving quiz to the database:', error);
      throw new InternalServerErrorException('Failed to save quiz.');
    }
  }

  async getQuizById(id: string): Promise<QuizData> {
    try {
      const query = `
          SELECT id, user_id, title, grade_level, subject, topic, number_of_questions, question_types, 
                 quiz_content, teaching_insights, custom_instructions, created_at
          FROM quizzes
          WHERE id = $1
        `;

      const results: QuizData[] = await this.databaseService.query(query, [id]);

      if (results.length === 0) {
        throw new NotFoundException(`Quiz with ID ${id} not found`);
      }

      return results[0];
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw new InternalServerErrorException('Failed to fetch quiz');
    }
  }
}
