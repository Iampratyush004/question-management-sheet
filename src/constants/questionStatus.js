export const QUESTION_STATUSES = ['todo', 'done', 'revision', 'marked'];

export const DEFAULT_QUESTION_STATUS = 'todo';

export const QUESTION_STATUS_LABELS = {
  todo: 'Pending',
  done: 'Done',
  revision: 'Revision',
  marked: 'Marked',
};

export const isQuestionStatus = (value) => QUESTION_STATUSES.includes(value);
