export function generateLabPrompt(promptDetails: {
  gradeLevel: string;
  subject: string;
  duration: string;
  materials?: string;
  context: string;
  standards?: string;
}): string {
  const { gradeLevel, subject, duration, materials, context, standards } =
    promptDetails;

  return `
        Create a detailed lab for ${gradeLevel} grade students studying ${subject}. The lab should take approximately ${duration} to complete.
    
        Teacher's Context:
        ${context}
    
        Requirements:
        - Include a title, overview, materials list, learning objectives, step-by-step procedure, discussion questions, extensions/modifications, safety notes, and **one standards alignment**.
        - Materials: ${materials || 'Not specified. Suggest appropriate materials based on the context.'}
        - Standards alignment: ${
          standards
            ? `Use this exact standard: ${standards}`
            : 'Suggest one appropriate US standard (e.g., NGSS or Common Core) for this lab.'
        }
        - For each discussion question, include an answer and a detailed explanation to help teachers guide students.
    
        Format the response as a JSON object with the following keys:
        - title
        - overview
        - standardAlignment (a single string, e.g., "NGSS: 5-ESS2-1. Develop a model to describe geosphere interactions.")
        - materials
        - learningObjectives
        - procedure
        - discussionQuestions (array of objects with "question", "answer", and "explanation")
        - extensions
        - safetyNotes
    `;
}
