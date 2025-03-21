import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * 🔹 Existing function (kept for compatibility) - Returns JSON content
   */
  async generateContent(prompt: string): Promise<any> {
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

      return JSON.parse(content);
    } catch (error) {
      console.error('Error generating content:', error);
      throw new InternalServerErrorException('Failed to generate content');
    }
  }

  /**
   * 🔹 New reusable function - Returns AI response as plain text
   */
  async generateTextContent(prompt: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new InternalServerErrorException('No response from OpenAI');
      }

      return content; // ✅ Returns raw text (no JSON parsing)
    } catch (error) {
      console.error('Error generating text content:', error);
      throw new InternalServerErrorException('Failed to generate AI response');
    }
  }
}
