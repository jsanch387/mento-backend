import { InternalServerErrorException } from '@nestjs/common';
import { OpenAIService } from 'src/services/openai.service';
import { z } from 'zod';

// Define schema for a single question
const questionSchema = z.object({
  question: z.string(),
  type: z.enum([
    'multiple_choice',
    'short_answer',
    'true_false',
    'fill_in_the_blank',
  ]),
  correct_answer: z.string(),
  explanation: z.string(),
  hint: z.optional(z.string()),
  options: z.optional(z.array(z.string())),
});

// Define schema for the whole quiz
const quizSchema = z.object({
  title: z.string(),
  grade_level: z.string(),
  subject: z.string(),
  topic: z.string(),
  number_of_questions: z.number(),
  question_types: z.array(z.string()),
  quiz_content: z.array(questionSchema),
  teaching_insights: z.string(),
});

// Utility function to validate the AI response
export function validateQuizResponse(response: any): boolean {
  try {
    quizSchema.parse(response);
    return true;
  } catch (error) {
    console.error('❌ Quiz validation failed:', error.errors);
    return false;
  }
}

// Utility function to request AI and retry if needed
export async function generateQuizWithRetries(
  openAIService: OpenAIService,
  prompt: string,
  maxRetries = 2,
): Promise<any> {
  let attempt = 0;
  let lastError: any;

  while (attempt <= maxRetries) {
    console.log(`🔄 Attempt ${attempt + 1} of ${maxRetries + 1}`);
    const aiResponse = await openAIService.generateContent(prompt);

    if (validateQuizResponse(aiResponse)) {
      console.log('✅ AI response validated successfully.');
      return aiResponse;
    } else {
      console.warn(`⚠️ AI response validation failed (attempt ${attempt + 1})`);
      lastError = aiResponse;
    }

    attempt++;
  }

  console.error(
    '❌ All retries failed. Last AI response:',
    JSON.stringify(lastError, null, 2),
  );
  throw new InternalServerErrorException(
    'AI failed to generate a valid quiz after multiple attempts.',
  );
}
