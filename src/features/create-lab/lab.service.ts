import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { OpenAIService } from '../../services/openai.service';
import { DatabaseService } from '../../services/database.service';
import { generateLabPrompt } from './lab.utils';

export interface LabData {
  id: string;
  user_id: string;
  title: string;
  overview: string;
  grade_level: string;
  subject: string;
  materials: string[];
  learning_objectives: string[];
  procedure: string[];
  discussion_questions: {
    question: string;
    answer: string;
    explanation: string;
  }[];
  extensions: string[];
  safety_notes: string;
  standards_alignment: string;
  duration: string;
  context: string;
  created_at: string;
}

@Injectable()
export class LabGeneratorService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly databaseService: DatabaseService,
  ) {}

  async createLab(
    userId: string,
    promptDetails: {
      gradeLevel: string;
      subject: string;
      duration: string;
      context: string;
      standards?: string | null;
    },
  ): Promise<any> {
    if (
      !promptDetails.gradeLevel ||
      !promptDetails.subject ||
      !promptDetails.duration ||
      !promptDetails.context
    ) {
      throw new InternalServerErrorException(
        'Missing required fields: gradeLevel, subject, duration, context',
      );
    }

    const standards = promptDetails.standards || null;

    // Generate the prompt with all necessary details
    const prompt = generateLabPrompt({
      ...promptDetails,
      standards,
    });

    // Get the lab response from OpenAI
    const lab = await this.openAIService.generateContent(prompt);

    // Use the subject provided in the prompt details instead of relying on the AI response
    const subject = promptDetails.subject;

    // Handle missing or empty fields in the AI response
    if (!lab.standardAlignment || lab.standardAlignment.trim() === '') {
      lab.standardAlignment = 'No suggested standard available.';
    }

    if (!lab.duration) {
      lab.duration = promptDetails.duration;
    }

    if (!lab.gradeLevel) {
      lab.gradeLevel = promptDetails.gradeLevel;
    }

    // Save the lab to the database
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO labs (
            user_id, title, overview, grade_level, subject, materials, learning_objectives,
            procedure, discussion_questions, extensions, safety_notes, standards_alignment,
            duration, context
          )
          VALUES (
            $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb,
            $11::jsonb, $12, $13, $14
          )
          RETURNING *;
        `,
        [
          userId,
          lab.title,
          lab.overview,
          lab.gradeLevel,
          subject, // Always use the user-provided subject
          JSON.stringify(lab.materials),
          JSON.stringify(lab.learningObjectives),
          JSON.stringify(lab.procedure),
          JSON.stringify(lab.discussionQuestions),
          JSON.stringify(lab.extensions),
          JSON.stringify(lab.safetyNotes),
          lab.standardAlignment,
          lab.duration,
          promptDetails.context,
        ],
      );

      return result[0]; // Return the saved lab
    } catch (error) {
      console.error('Error saving lab to database:', error);
      throw new InternalServerErrorException('Failed to save lab to database');
    }
  }

  async getLabById(id: string): Promise<LabData> {
    try {
      const query = `
        SELECT id, user_id, title, overview, grade_level, subject, materials, 
               learning_objectives, procedure, discussion_questions, extensions, 
               safety_notes, standards_alignment, duration, context, created_at
        FROM labs
        WHERE id = $1
      `;

      // Execute query with type casting
      const results: LabData[] = await this.databaseService.query(query, [id]);

      if (results.length === 0) {
        throw new NotFoundException(`Lab with ID ${id} not found`);
      }

      return results[0]; // Return the typed lab data
    } catch (error) {
      console.error('Error fetching lab:', error);
      throw new InternalServerErrorException('Failed to fetch lab');
    }
  }
}
