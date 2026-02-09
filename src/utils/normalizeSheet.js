import { seedSheet } from '../data/seedSheet';
import { DEFAULT_QUESTION_STATUS, isQuestionStatus } from '../constants/questionStatus';

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return isQuestionStatus(normalized) ? normalized : DEFAULT_QUESTION_STATUS;
};

const normalizeQuestionUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
};

const normalizeQuestion = (question) => {
  if (!question) {
    return {
      id: makeId('q'),
      text: 'Untitled Question',
      url: '',
      status: DEFAULT_QUESTION_STATUS,
      notes: '',
    };
  }

  if (typeof question === 'string') {
    return {
      id: makeId('q'),
      text: question,
      url: '',
      status: DEFAULT_QUESTION_STATUS,
      notes: '',
    };
  }

  return {
    id: String(question.id || makeId('q')),
    text: String(
      question.text ||
        question.question ||
        question.questionName ||
        question.title ||
        question.name ||
        'Untitled Question',
    ),
    url: normalizeQuestionUrl(
      question.url || question.link || question.problemUrl || question.problemLink || '',
    ),
    status: normalizeStatus(question.status || question.state || question.progress),
    notes: String(question.notes || question.note || question.comment || ''),
  };
};

const normalizeSubTopic = (subTopic) => ({
  id: String(subTopic?.id || makeId('sub')),
  title: String(subTopic?.title || subTopic?.name || subTopic?.subTopicName || 'Untitled Sub-topic'),
  questions: Array.isArray(subTopic?.questions)
    ? subTopic.questions.map(normalizeQuestion)
    : [],
});

const normalizeTopic = (topic) => ({
  id: String(topic?.id || makeId('topic')),
  title: String(topic?.title || topic?.name || topic?.topicName || 'Untitled Topic'),
  questions: Array.isArray(topic?.questions) ? topic.questions.map(normalizeQuestion) : [],
  subTopics: Array.isArray(topic?.subTopics)
    ? topic.subTopics.map(normalizeSubTopic)
    : Array.isArray(topic?.subtopics)
      ? topic.subtopics.map(normalizeSubTopic)
      : [],
});

export const normalizeSheetShape = (incomingSheet) => {
  if (!incomingSheet || typeof incomingSheet !== 'object') {
    return clone(seedSheet);
  }

  const topics = Array.isArray(incomingSheet.topics)
    ? incomingSheet.topics.map(normalizeTopic)
    : [];

  return {
    id: String(incomingSheet.id || makeId('sheet')),
    slug: String(incomingSheet.slug || incomingSheet.sheetSlug || 'local-sheet'),
    name: String(incomingSheet.name || incomingSheet.sheetName || 'Question Sheet'),
    description: String(incomingSheet.description || ''),
    updatedAt: new Date().toISOString(),
    topics: topics.length ? topics : clone(seedSheet.topics),
  };
};
