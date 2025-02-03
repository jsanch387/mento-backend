import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { OpenAIService } from '../../services/openai.service';
import { DatabaseService } from '../../services/database.service';
import { generateLabPrompt } from './lab.utils';

@Injectable()
export class LabGeneratorService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Creates a new lab using OpenAI and saves it to the database.
   */
  async createLab(
    userId: string,
    promptDetails: {
      gradeLevel: string;
      subject: string;
      duration: string;
      materials?: string;
      context: string;
      standards?: string | null; // Standards can now be null
    },
  ): Promise<any> {
    // Validate required fields
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

    // Handle standards input - normalize empty string to null
    const standards = promptDetails.standards || null;

    // Generate the prompt
    const prompt = generateLabPrompt({
      ...promptDetails,
      standards,
    });

    // Get the lab from OpenAI
    const lab = await this.openAIService.generateContent(prompt);

    // Ensure the AI provides a standardAlignment field
    if (!lab.standardAlignment || lab.standardAlignment.trim() === '') {
      lab.standardAlignment = 'No suggested standard available.';
    }

    // Save to the database
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO labs (
            user_id, title, overview, materials, learning_objectives, procedure,
            discussion_questions, extensions, safety_notes, standards_alignment,
            context
          )
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
          RETURNING *;
        `,
        [
          userId,
          lab.title,
          lab.overview,
          JSON.stringify(lab.materials),
          JSON.stringify(lab.learningObjectives),
          JSON.stringify(lab.procedure),
          JSON.stringify(lab.discussionQuestions),
          JSON.stringify(lab.extensions),
          JSON.stringify(lab.safetyNotes),
          lab.standardAlignment, // Store the single standard as a string
          promptDetails.context,
        ],
      );

      return result[0]; // Return the saved lab
    } catch (error) {
      console.error('Error saving lab to database:', error);
      throw new InternalServerErrorException('Failed to save lab to database');
    }
  }

  /**
   * Retrieves a lab by its ID.
   */
  async getLabById(id: string) {
    try {
      const query = `
        SELECT id, user_id, title, overview, materials, learning_objectives, procedure,
               discussion_questions, extensions, safety_notes, standards_alignment,
               context, created_at
        FROM labs
        WHERE id = $1
      `;

      const results = await this.databaseService.query(query, [id]);

      if (!results.length) {
        throw new NotFoundException(`Lab with ID ${id} not found`);
      }

      return results[0]; // Return the lab
    } catch (error) {
      console.error('Error fetching lab:', error);
      throw new InternalServerErrorException('Failed to fetch lab');
    }
  }
}
