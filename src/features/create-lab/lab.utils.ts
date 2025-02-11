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
        - Include a title, overview, materials list, learning objectives, step-by-step procedure, discussion questions, extensions/modifications, safety notes, and **one standards alignment**.
        - Materials: Suggest a detailed list of appropriate materials based on the context and lab requirements.
        - duration (a string, e.g., "60 minutes")
        - Standards alignment: ${
          standards
            ? `Use this exact standard: ${standards}`
            : 'Suggest one appropriate US standard (e.g., NGSS or Common Core) for this lab.'
        }
        - The procedure must be formatted as an array of strings, where each step starts with a number (e.g., "1. Pour water into the large bowl.").

        Format the response as a JSON object with the following keys:
        - title
        - overview
        - standardAlignment (a single string, e.g., "NGSS: 5-ESS2-1. Develop a model to describe geosphere interactions.")
        - materials (array of strings)
        - learningObjectives
        - procedure (an array of numbered strings as described above)
        - discussionQuestions (array of objects with "question", "answer", and "explanation")
        - extensions
        - safetyNotes
    `;
}
