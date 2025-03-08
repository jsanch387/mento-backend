// src/utils/json.utils.ts

export function parseStrictJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON response from AI');
  }
}
