export function generateQuizPrompt(input: {
  subject: string;
  topic: string;
  gradeLevel: string;
  numberOfQuestions: number;
  questionTypes: string[];
  includeHints?: boolean;
  customInstructions?: string;
}): string {
  const {
    subject,
    topic,
    gradeLevel,
    numberOfQuestions,
    questionTypes,
    includeHints,
    customInstructions,
  } = input;

  return `
You are an expert quiz generator AI. Your job is to generate a STRICTLY FORMATTED JSON quiz.

=== QUIZ REQUIREMENTS ===
- Subject: **${subject}**
- Topic: **${topic}**
- Grade Level: **${gradeLevel}**
- Number of Questions: **${numberOfQuestions}**

=== QUESTION TYPES ===
Use only these types, with exact spelling and casing (no variations):
- "multiple_choice"
- "short_answer"
- "true_false"
- "fill_in_the_blank"

=== QUESTION FORMAT ===
Each question must have these fields:
- "question" (string)
- "type" (string, one of: "multiple_choice", "short_answer", "true_false", "fill_in_the_blank")
- "correct_answer" (string)
- "explanation" (string)
${includeHints ? '- "hint" (string) - Required in every question if hints are enabled.' : ''}
- If type = "multiple_choice", add "options" (array of exactly 4 strings, each prefixed with A., B., C., D.)

=== OUTPUT FORMAT ===
Return only valid JSON in this structure:
{
  "title": "Quiz on ${topic}",
  "grade_level": "${gradeLevel}",
  "subject": "${subject}",
  "topic": "${topic}",
  "number_of_questions": ${numberOfQuestions},
  "question_types": ${JSON.stringify(questionTypes.map((t) => t.toLowerCase().replace(/\s/g, '_')))},
  "quiz_content": [
    {
      "question": "Sample question",
      "type": "multiple_choice",
      "correct_answer": "A. Sample answer",
      "explanation": "Explanation here",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      ${includeHints ? '"hint": "Sample hint here",' : ''}
    }
  ],
  "teaching_insights": "Short teaching insight here"
}

=== STRICT RULES ===
- Output must be 100% valid JSON.
- No extra commentary, preamble, or formatting.
- "type" must exactly match allowed types.
- Incorrectly formatted responses will cause system failure.
- ${includeHints ? 'Every question must have a "hint" field if hints are enabled. Hints must be helpful and related to the question topic.' : ''}

${customInstructions ? `- Additional instructions: ${customInstructions}` : ''}
`;
}
