export const INSERT_QUIZ = `
  INSERT INTO quizzes (user_id, title, grade_level, subject, topic, number_of_questions, question_types, quiz_content, teaching_insights, custom_instructions)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING *;
`;

export const GET_QUIZ_BY_ID = `
  SELECT id, user_id, title, grade_level, subject, topic, number_of_questions, question_types, 
         quiz_content, teaching_insights, custom_instructions, created_at
  FROM quizzes
  WHERE id = $1;
`;

export const INSERT_LAUNCHED_QUIZ = `
  INSERT INTO launched_quizzes (id, quiz_id, user_id, class_name, created_at)
  VALUES ($1, $2, $3, $4, NOW());
`;

export const GET_LAUNCHED_QUIZ = `
  SELECT q.id AS quiz_id, q.title, q.quiz_content, l.class_name, l.created_at
  FROM launched_quizzes l
  JOIN quizzes q ON l.quiz_id = q.id
  WHERE l.id = $1;
`;
