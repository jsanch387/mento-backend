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

  // Convert question types to a strict JSON-friendly format
  const allowedTypes = questionTypes.map((t) =>
    t.toLowerCase().replace(/\s/g, '_'),
  );

  return `
You are an expert AI quiz generator. Your job is to generate a STRICTLY FORMATTED JSON quiz.

=== QUIZ REQUIREMENTS ===
- Subject: **${subject}**
- Topic: **${topic}**
- Grade Level: **${gradeLevel}**
- Number of Questions: **${numberOfQuestions}**
- **MUST use only these question types: ${allowedTypes.join(', ')}**
- **DO NOT generate any other question types** outside of this list.

=== QUESTION TYPES ===
You are strictly allowed to use ONLY the following types:
${allowedTypes.map((type) => `- "${type}"`).join('\n')}

❌ **Do NOT generate short_answer, fill_in_the_blank, or any other type unless explicitly listed above.**
❌ **If multiple_choice is selected, every question of that type MUST have exactly 4 answer choices.**
❌ **If true_false is selected, it MUST have exactly "True" and "False" as answer options.**
✅ **Questions must match the selected types EXACTLY.**

=== QUESTION FORMAT ===
Each question must include these fields:
- "question" (string)
- "type" (string, one of: ${allowedTypes.map((t) => `"${t}"`).join(', ')})
- "correct_answer" (string)
- "explanation" (string)
${includeHints ? '- "hint" (string) - Required if hints are enabled.' : ''}
${allowedTypes.includes('multiple_choice') ? '- If "type" is "multiple_choice", add "options" (array of exactly 4 strings, prefixed with A., B., C., D.)' : ''}
${allowedTypes.includes('true_false') ? '- If "type" is "true_false", the correct answer must be "True" or "False" only.' : ''}

=== OUTPUT FORMAT ===
Return only valid JSON in this structure:
{
  "title": "Quiz on ${topic}",
  "grade_level": "${gradeLevel}",
  "subject": "${subject}",
  "topic": "${topic}",
  "number_of_questions": ${numberOfQuestions},
  "question_types": ${JSON.stringify(allowedTypes)},
  "quiz_content": [
    {
      "question": "Sample question",
      "type": "${allowedTypes[0]}",
      "correct_answer": "A. Sample answer",
      "explanation": "Explanation here",
      ${allowedTypes.includes('multiple_choice') ? '"options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],' : ''}
      ${includeHints ? '"hint": "Sample hint here",' : ''}
    }
  ],
  "teaching_insights": "Short teaching insight here"
}

=== STRICT RULES ===
- Output must be 100% valid JSON.
- No extra commentary, preamble, or formatting.
- "type" must **EXACTLY match** the allowed types.
- **DO NOT generate questions outside the selected types.**
- **Invalid responses will be rejected.**
- ${includeHints ? 'Every question must have a "hint" field if hints are enabled.' : ''}

${customInstructions ? `- Additional instructions: ${customInstructions}` : ''}
`;
}
