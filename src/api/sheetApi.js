import { normalizeSheetShape } from '../utils/normalizeSheet';
import { DEFAULT_QUESTION_STATUS, isQuestionStatus } from '../constants/questionStatus';

const ENDPOINT =
  'https://node.codolio.com/api/question-tracker/v1/sheet/public/get-sheet-by-slug';

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const pickQuestionText = (item) =>
  item?.text ||
  item?.question ||
  item?.questionName ||
  item?.problemName ||
  item?.name ||
  item?.title ||
  'Untitled Question';

const pickTopicName = (item) => item?.topic || item?.topicName || item?.category || 'General';

const pickSubTopicName = (item) =>
  item?.subTopic || item?.subTopicName || item?.subtopic || item?.sub_category || '';

const pickStatus = (item) => item?.status || item?.state || item?.progress || '';
const pickQuestionUrl = (item) =>
  item?.url || item?.link || item?.problemUrl || item?.problemLink || item?.questionUrl || '';

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

const normalizeQuestionEntries = (sheet) => {
  const questionData = sheet?.questionData || sheet?.questions || sheet?.questionList || [];

  if (Array.isArray(questionData)) {
    return questionData;
  }

  if (questionData && typeof questionData === 'object') {
    return Object.values(questionData);
  }

  return [];
};

export const normalizeRemoteSheet = (payload) => {
  const rawSheet = payload?.data?.sheet || payload?.sheet || payload;

  if (!rawSheet || typeof rawSheet !== 'object') {
    throw new Error('Invalid API response shape');
  }

  const entries = normalizeQuestionEntries(rawSheet);

  if (!entries.length) {
    return normalizeSheetShape({
      id: rawSheet.id || rawSheet._id,
      slug: rawSheet.sheetSlug || rawSheet.slug,
      name: rawSheet.sheetName || rawSheet.name,
      description: rawSheet.description || '',
      topics: rawSheet.topics || [],
    });
  }

  const topicMap = new Map();

  entries.forEach((entry) => {
    const topicTitle = String(pickTopicName(entry));
    const subTopicTitle = String(pickSubTopicName(entry)).trim();
    const questionText = String(pickQuestionText(entry));

    if (!topicMap.has(topicTitle)) {
      topicMap.set(topicTitle, {
        id: `topic-${topicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || makeId('topic')}`,
        title: topicTitle,
        questions: [],
        subTopics: [],
      });
    }

    const topic = topicMap.get(topicTitle);
    const question = {
      id: String(entry.id || entry._id || makeId('q')),
      text: questionText,
      url: normalizeQuestionUrl(pickQuestionUrl(entry)),
      status: normalizeStatus(pickStatus(entry)),
      notes: String(entry?.notes || entry?.note || entry?.comment || ''),
    };

    if (!subTopicTitle || subTopicTitle === 'None') {
      topic.questions.push(question);
      return;
    }

    let subTopic = topic.subTopics.find((item) => item.title === subTopicTitle);

    if (!subTopic) {
      subTopic = {
        id: `sub-${subTopicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || makeId('sub')}`,
        title: subTopicTitle,
        questions: [],
      };
      topic.subTopics.push(subTopic);
    }

    subTopic.questions.push(question);
  });

  const topicOrder = rawSheet?.config?.topicOrder;
  const questionOrder = rawSheet?.config?.questionOrder;

  let topics = Array.from(topicMap.values());

  if (Array.isArray(topicOrder) && topicOrder.length) {
    const ranked = new Map(topicOrder.map((name, index) => [String(name), index]));
    topics.sort((a, b) => {
      const rankA = ranked.has(a.title) ? ranked.get(a.title) : Number.MAX_SAFE_INTEGER;
      const rankB = ranked.has(b.title) ? ranked.get(b.title) : Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });
  }

  if (Array.isArray(questionOrder) && questionOrder.length) {
    const rank = new Map(questionOrder.map((id, index) => [String(id), index]));
    const sortQuestions = (questions) =>
      questions.sort((a, b) => {
        const rankA = rank.has(String(a.id)) ? rank.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
        const rankB = rank.has(String(b.id)) ? rank.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });

    topics = topics.map((topic) => ({
      ...topic,
      questions: sortQuestions(topic.questions),
      subTopics: topic.subTopics.map((subTopic) => ({
        ...subTopic,
        questions: sortQuestions(subTopic.questions),
      })),
    }));
  }

  return normalizeSheetShape({
    id: rawSheet.id || rawSheet._id,
    slug: rawSheet.sheetSlug || rawSheet.slug,
    name: rawSheet.sheetName || rawSheet.name,
    description: rawSheet.description || '',
    topics,
  });
};

export const fetchSheetBySlug = async (slug) => {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(slug)}`);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
};
