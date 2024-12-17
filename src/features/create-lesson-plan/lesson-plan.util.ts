export const generateLessonPlanPrompt = ({
  gradeLevel,
  subject,
  duration,
  additionalDetails,
}: {
  gradeLevel: string;
  subject: string;
  duration: string;
  additionalDetails?: string;
}) => `
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
        "description": "Include an interactive or thought-provoking activity, question, or multimedia resource that captures student interest. Relate the activity to real-world scenarios where possible."
      },
      "explore": {
        "time": "X minutes",
        "description": "Provide a hands-on activity, experiment, or discussion that encourages students to actively explore the topic. Include specific instructions and expected outcomes."
      },
      "explain": {
        "time": "X minutes",
        "description": "Deliver clear and structured content. Include key points, examples, and visuals that teachers can use to guide student understanding."
      },
      "elaborate": {
        "time": "X minutes",
        "description": "Suggest a creative or collaborative activity that allows students to apply what they've learned, such as building models, creating diagrams, or solving real-world problems."
      },
      "evaluate": {
        "time": "X minutes",
        "description": "Include diverse assessment methods, such as quizzes, group discussions, peer reviews, or creative outputs. Ensure the evaluation aligns with the lesson objectives."
      }
    }
  }`;
