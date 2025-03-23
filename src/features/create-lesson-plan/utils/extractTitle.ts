//Extracts the title from the markdown content
//Example input: `# "My Lesson Plan Title"`
export const extractTitle = (markdown: string): string => {
  const match = markdown.match(/^# ["']?(.*?)["']?$/m);
  return match ? match[1].trim() : 'Untitled Lesson';
};
