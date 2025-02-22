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
      You are an expert quiz generator. Create a **strict JSON-formatted** quiz for **${gradeLevel}** students on the subject "**${subject}**" focused on the topic "**${topic}**" with exactly **${numberOfQuestions}** questions.
  
      ✅ **Question Types & Rules**:
      - **Use ONLY** these question types: ${questionTypes
        .map((t) => `"${t.toLowerCase().replace(/\s/g, '_')}"`)
        .join(', ')}.
        
      - **Each question** must include:
        - **"question"**: The question text.
        - **"type"**: One of "multiple_choice", "short_answer", "true_false", "fill_in_the_blank".
        - **"correct_answer"**: The correct answer.
        - **"explanation"**: A short explanation of why the answer is correct.
        ${includeHints ? '- **"hint"**: Include a helpful hint for each question.' : ''}
  
      ✅ **Specific Rules per Question Type**:
      1. **Multiple Choice**:
        - Must have **exactly four options** in an **"options"** array.
        - Format options with letter prefixes: ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"].
  
      2. **Short Answer**:
        - Do **NOT** include an "options" field.
        - The **"correct_answer"** should be a short textual answer.
  
      3. **True/False**:
        - Do **NOT** include an "options" field.
        - The **"correct_answer"** must be either **"True"** or **"False"**.
  
      4. **Fill in the Blank**:
        - Do **NOT** include an "options" field.
        - Provide the **"correct_answer"** for the blank.
  
      ✅ **Teaching Insights**:
      - Add a short **"teaching_insights"** field (max 3 sentences) explaining how this quiz benefits students.
  
      ${customInstructions ? `- Additional teacher instructions: ${customInstructions}` : ''}
  
      ✅ **Strict JSON Response Format (No extra text or comments):**
      {
        "title": "Quiz on ${topic}",
        "grade_level": "${gradeLevel}",
        "subject": "${subject}",
        "topic": "${topic}",
        "number_of_questions": ${numberOfQuestions},
        "question_types": ${JSON.stringify(
          questionTypes.map((t) => t.toLowerCase().replace(/\s/g, '_')),
        )},
        "quiz_content": [],
        "teaching_insights": ""
      }
    `;
}
