export interface QuizData {
  id: string;
  user_id: string;
  title: string;
  grade_level: string;
  subject: string;
  topic: string;
  number_of_questions: number;
  question_types: string[];
  quiz_content: QuizQuestion[];
  teaching_insights: string;
  custom_instructions?: string;
  created_at: string;
}

export interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'short_answer' | 'true_false' | 'fill_in_the_blank';
  options?: string[];
  correct_answer: string;
  explanation: string;
  hint?: string;
}

export interface LaunchedQuiz {
  id: string;
  quiz_id: string;
  user_id: string;
  class_name: string;
  created_at: string;
}

export interface GradedAnswer {
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

export interface GradedQuizResponse {
  gradedAnswers: GradedAnswer[];
}

export interface StudentQuizSubmission {
  studentName: string;
  deploymentId?: string; // Optional if you want to track deployment
  answers: {
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    type:
      | 'short_answer'
      | 'multiple_choice'
      | 'true_false'
      | 'fill_in_the_blank';
  }[];
}
