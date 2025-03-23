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
}): string => {
  return `
  You are an expert lesson plan generator.
  
  Create a **very detailed, age-appropriate, and easy-to-follow** lesson plan for a **${gradeLevel} ${subject}** class. The total duration should be **${duration}**.
  
  The teacher provided the following input about the lesson. You **must follow it closely** when generating the plan:  
  ${additionalDetails || 'No additional details provided.'}
  
  ---
  
  **Instructions for formatting the response:**  
  - Format everything in **Markdown**.  
  - Use **bold section titles** (e.g., \`## Overview\`, \`## Objectives\`, etc.)  
  - Use \`---\` to divide major sections.  
  - Use bullet points or numbered lists where appropriate.  
  - Include **time estimates (in minutes)** in parentheses next to each lesson phase.  
  - **Do NOT place quotation marks around the title.**  
  - Make the formatting clean, spaced, and optimized for display in a frontend Markdown viewer.
  - Provide great detail for each step we want to make sure the teacher can follow the lesson plan easily. Use example scenarios or ideas to spark the teachers creativity.
  
  ---
  
  **The generated lesson plan must follow this structure:**
  
  # Insert a creative and engaging lesson title (without quotation marks)
  
  ## Overview  
  **Grade Level:** ${gradeLevel}  
  **Subject:** ${subject}  
  **Duration:** ${duration}  
  **Standards:** Include **one relevant U.S. education standard** that fits the lesson.
  
  ## Materials  
  - [List all materials required for the lesson]
  
  ## Learning Objectives   
  - [List 3–4 measurable objectives]
  
  ## Introduction (X minutes)  
  - [Hook question or story to capture attention]  
  - [Clearly state the lesson goals and importance]
  
  ## Lesson Plan Structure
  
  ### Direct Instruction (X minutes)  
  - [Explain the concept thoroughly with clear examples]  
  - [Use diagrams, stories, or analogies if helpful]
  
  ### Guided Practice (X minutes)  
  - [Group or paired activity to apply the concept]  
  - [Teacher circulates and supports]
  
  ### Independent Practice (X minutes)  
  - [Individual task or worksheet]  
  - [Teacher checks for understanding]
  
  ### Wrap-Up & Assessment (X minutes)  
  - [Class discussion or Q&A to review key points]  
  - [Quick quiz or summary from students]
  
  ## Extension Activity (Optional)  
  - [Enrichment or take-home assignment ideas]
  
  ## Differentiation Strategies  
  - **For Advanced Learners:** [Add challenge, depth, or extension]  
  - **For Students Needing Support:** [Scaffolds like visuals, sentence starters, or peer pairing]
  
  ---
  
  Ensure your response is polished, clear, and optimized for Markdown rendering in a web application.
  `;
};
