export function generateGradingPrompt(submission: {
  studentName: string;
  deploymentId?: string;
  answers: {
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    type: string;
  }[];
}): string {
  return `
  You are an expert AI assistant responsible for grading student quizzes.
  
  You will be given a student's answers, the correct answers, and the type of question. Your job is to grade each answer and explain why it is correct or incorrect.
  
  === GRADING REQUIREMENTS ===
  - Compare the student's answer to the correct answer.
  - Return a boolean field "isCorrect" for each question.
  - Always provide a clear, helpful explanation.
  - Use strict JSON format.
  
  === QUESTION TYPES ===
  - "multiple_choice"
  - "short_answer"
  - "true_false"
  - "fill_in_the_blank"
  
  === OUTPUT FORMAT ===
  The response must be a strict JSON object in the following format:
  
  {
    "gradedAnswers": [
      {
        "question": "string",
        "studentAnswer": "string",
        "correctAnswer": "string",
        "isCorrect": true or false,
        "explanation": "string"
      }
    ]
  }
  
  === RULES ===
  - Only return valid JSON matching the format.
  - No extra text, comments, or explanations outside the JSON object.
  - Make sure explanations are concise, clear, and helpful for the student.
  
  === SUBMISSION TO GRADE ===
  ${JSON.stringify(submission, null, 2)}
  `;
}
