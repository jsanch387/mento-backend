export function generateLabPrompt(promptDetails: {
  gradeLevel: string;
  subject: string;
  duration: string;
  context: string;
  standards?: string;
}): string {
  const { gradeLevel, subject, duration, context, standards } = promptDetails;

  return `
        Create a detailed lab for ${gradeLevel} grade students studying ${subject}. The lab should take approximately ${duration} to complete.
    
        Teacher's Context:
        ${context}
    
        Requirements:
        - Include a title, overview, materials list, learning objectives, step-by-step procedure, discussion questions, extensions/modifications, safety notes, **one standards alignment**, and **grade level**.
        - Materials: Suggest a detailed list of appropriate materials based on the context and lab requirements.
        - Duration: A string (e.g., "60 minutes").
        - Grade Level: Include the grade level specified in the prompt.
        - Standards alignment: ${
          standards
            ? `Use this exact standard: ${standards}`
            : 'Suggest one appropriate US standard (e.g., NGSS or Common Core) for this lab.'
        }
        - The procedure must be formatted as an array of strings, where each step starts with a number (e.g., "1. Pour water into the large bowl.").

        Format the response as a JSON object with the following keys:
        - title
        - overview
        - subject (string representing the subject of the lab)
        - standardAlignment (a single string)
        - materials (array of strings)
        - learningObjectives (array of strings)
        - procedure (array of numbered strings)
        - discussionQuestions (array of objects with "question", "answer", and "explanation")
        - extensions (array of strings)
        - safetyNotes (array of strings)
        - gradeLevel (a string representing the grade level, e.g., "5th Grade")
    `;
}
