import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { DatabaseService } from './database.service'; // Import the database service

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor(private readonly databaseService: DatabaseService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateLessonPlan(
    userId: string,
    promptDetails: {
      gradeLevel: string;
      subject: string;
      duration: string;
      additionalDetails?: string;
    },
  ): Promise<any> {
    const { gradeLevel, subject, duration, additionalDetails } = promptDetails;

    const prompt = `
You are a professional lesson plan assistant helping teachers create reliable and engaging lesson plans. Use your knowledge of United States curriculum standards to generate a detailed lesson plan in JSON format that follows the structure below. Focus on providing age-appropriate, interactive, and clear guidance.  
Use the following context to refine the lesson plan: ${additionalDetails || 'None provided.'}

Return the response as a JSON object with the following structure:

{
  "title": "A short, concise, engaging title for the lesson",
  "overview": {
    "gradeLevel": "${gradeLevel}",
    "subject": "${subject}",
    "duration": "${duration}",
    "standards": "Relevant U.S. curriculum standards (e.g., NGSS, Common Core, etc.)"
  },
  "materials": [
    "List all materials and resources needed for the lesson"
  ],
  "learningObjectives": [
    "A measurable and clear goal",
    "Another measurable and clear goal",
    "Another measurable and clear goal"
  ],
  "lessonPlanStructure": {
    "engage": {
      "time": "X minutes",
      "description": "Interactive activity to spark student interest"
    },
    "explore": {
      "time": "X minutes",
      "description": "Hands-on activity or discussion to actively explore the topic"
    },
    "explain": {
      "time": "X minutes",
      "description": "Content explanation and guided instruction"
    },
    "elaborate": {
      "time": "X minutes",
      "description": "Creative or collaborative activity to apply learning"
    },
    "evaluate": {
      "time": "X minutes",
      "description": "Assessment methods to check understanding"
    }
  }
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new InternalServerErrorException('No response from OpenAI');
      }

      const lessonPlan = JSON.parse(content);
      console.log('lessonPlan', lessonPlan);

      // Save the lesson plan to the database
      await this.databaseService.query(
        `
        INSERT INTO lesson_plans (user_id, title, overview, materials, learning_objectives, lesson_plan_structure)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
        RETURNING *;
        `,
        [
          userId,
          lessonPlan.title,
          JSON.stringify(lessonPlan.overview), // Serialize to JSON
          JSON.stringify(lessonPlan.materials), // Serialize to JSON
          JSON.stringify(lessonPlan.learningObjectives), // Serialize to JSON
          JSON.stringify(lessonPlan.lessonPlanStructure), // Serialize to JSON
        ],
      );

      return lessonPlan;
    } catch (error) {
      console.error('Error generating lesson plan:', error);
      throw new InternalServerErrorException('Failed to generate lesson plan');
    }
  }
}
