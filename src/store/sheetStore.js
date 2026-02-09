import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seedSheet } from '../data/seedSheet';
import { fetchSheetBySlug, normalizeRemoteSheet } from '../api/sheetApi';
import { normalizeSheetShape } from '../utils/normalizeSheet';
import { DEFAULT_QUESTION_STATUS, isQuestionStatus } from '../constants/questionStatus';

const HISTORY_LIMIT = 120;

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const clone = (value) => JSON.parse(JSON.stringify(value));

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

const updateTimestamp = (sheet) => {
  sheet.updatedAt = new Date().toISOString();
  return sheet;
};

const pushHistory = (history, snapshot) => {
  const next = [...history, clone(snapshot)];
  if (next.length > HISTORY_LIMIT) {
    return next.slice(next.length - HISTORY_LIMIT);
  }
  return next;
};

const moveItemById = (list, sourceId, targetId = null) => {
  const fromIndex = list.findIndex((item) => item.id === sourceId);

  if (fromIndex < 0) {
    return list;
  }

  const [source] = list.splice(fromIndex, 1);

  if (!targetId) {
    list.push(source);
    return list;
  }

  const targetIndex = list.findIndex((item) => item.id === targetId);

  if (targetIndex < 0) {
    list.push(source);
    return list;
  }

  list.splice(targetIndex, 0, source);
  return list;
};

const updateSheet = (sheet, updater) => {
  const nextSheet = clone(sheet);
  updater(nextSheet);
  return updateTimestamp(nextSheet);
};

const createLocalPatch = (state, updater) => ({
  sheet: updateSheet(state.sheet, updater),
  dataSource: 'local',
  history: pushHistory(state.history, state.sheet),
  future: [],
});

const createExternalPatch = (sheetPayload, source) => ({
  sheet: normalizeSheetShape(sheetPayload),
  dataSource: source,
  isLoading: false,
  error: '',
  hasBootstrapped: true,
  history: [],
  future: [],
});

const findTopic = (sheet, topicId) => sheet.topics.find((topic) => topic.id === topicId);

const findSubTopic = (topic, subTopicId) =>
  topic?.subTopics.find((subTopic) => subTopic.id === subTopicId);

const findQuestion = ({ topic, subTopicId = null, questionId }) => {
  if (!topic) {
    return null;
  }

  const list = subTopicId ? findSubTopic(topic, subTopicId)?.questions || [] : topic.questions;
  return list.find((item) => item.id === questionId) || null;
};

export const useSheetStore = create(
  persist(
    (set, get) => ({
      sheet: clone(seedSheet),
      isLoading: false,
      error: '',
      searchTerm: '',
      dataSource: 'seed',
      hasBootstrapped: false,
      theme: 'light',
      history: [],
      future: [],

      setSearchTerm: (value) => set({ searchTerm: value }),

      toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
      },

      setSheetName: (name) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            sheet.name = name.trim() || 'Question Sheet';
          }),
        );
      },

      setSheetDescription: (description) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            sheet.description = description;
          }),
        );
      },

      initializeSheet: async (slug = 'striver-sde-sheet') => {
        const { hasBootstrapped, dataSource } = get();

        if (hasBootstrapped) {
          return;
        }

        if (dataSource === 'api' || dataSource === 'local' || dataSource === 'shared') {
          set({ hasBootstrapped: true });
          return;
        }

        set({ hasBootstrapped: true, isLoading: true, error: '' });

        try {
          const payload = await fetchSheetBySlug(slug);
          const normalized = normalizeRemoteSheet(payload);
          set({
            ...createExternalPatch(normalized, 'api'),
          });
        } catch (error) {
          set({
            isLoading: false,
            dataSource: 'fallback',
            error:
              error instanceof Error
                ? `Unable to reach Codolio API (${error.message}). Showing sample data.`
                : 'Unable to reach Codolio API. Showing sample data.',
          });
        }
      },

      loadSharedSheet: (sheetPayload) => {
        set({
          ...createExternalPatch(sheetPayload, 'shared'),
        });
      },

      undo: () => {
        set((state) => {
          if (!state.history.length) {
            return {};
          }

          const previous = state.history[state.history.length - 1];
          return {
            sheet: clone(previous),
            dataSource: 'local',
            history: state.history.slice(0, -1),
            future: [clone(state.sheet), ...state.future].slice(0, HISTORY_LIMIT),
          };
        });
      },

      redo: () => {
        set((state) => {
          if (!state.future.length) {
            return {};
          }

          const [next, ...rest] = state.future;
          return {
            sheet: clone(next),
            dataSource: 'local',
            history: pushHistory(state.history, state.sheet),
            future: rest,
          };
        });
      },

      addTopic: (title) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            sheet.topics.push({
              id: makeId('topic'),
              title: title.trim() || 'Untitled Topic',
              questions: [],
              subTopics: [],
            });
          }),
        );
      },

      updateTopic: (topicId, title) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            if (topic) {
              topic.title = title.trim() || topic.title;
            }
          }),
        );
      },

      deleteTopic: (topicId) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            sheet.topics = sheet.topics.filter((topic) => topic.id !== topicId);
          }),
        );
      },

      addSubTopic: (topicId, title) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            if (!topic) {
              return;
            }

            topic.subTopics.push({
              id: makeId('sub'),
              title: title.trim() || 'Untitled Sub-topic',
              questions: [],
            });
          }),
        );
      },

      updateSubTopic: (topicId, subTopicId, title) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            const subTopic = findSubTopic(topic, subTopicId);
            if (subTopic) {
              subTopic.title = title.trim() || subTopic.title;
            }
          }),
        );
      },

      deleteSubTopic: (topicId, subTopicId) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            if (!topic) {
              return;
            }

            topic.subTopics = topic.subTopics.filter((subTopic) => subTopic.id !== subTopicId);
          }),
        );
      },

      addQuestion: ({ topicId, subTopicId = null, text, url = '' }) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            if (!topic) {
              return;
            }

            const question = {
              id: makeId('q'),
              text: text.trim() || 'Untitled Question',
              url: normalizeQuestionUrl(url),
              status: DEFAULT_QUESTION_STATUS,
              notes: '',
            };

            if (!subTopicId) {
              topic.questions.push(question);
              return;
            }

            const subTopic = findSubTopic(topic, subTopicId);
            if (subTopic) {
              subTopic.questions.push(question);
            }
          }),
        );
      },

      updateQuestion: ({ topicId, subTopicId = null, questionId, text, url }) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            const question = findQuestion({ topic, subTopicId, questionId });
            if (question) {
              question.text = text.trim() || question.text;
              if (url !== undefined) {
                question.url = normalizeQuestionUrl(url);
              }
            }
          }),
        );
      },

      setQuestionStatus: ({ topicId, subTopicId = null, questionId, status }) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            const question = findQuestion({ topic, subTopicId, questionId });
            if (question) {
              question.status = normalizeStatus(status);
            }
          }),
        );
      },

      setQuestionNotes: ({ topicId, subTopicId = null, questionId, notes }) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            const question = findQuestion({ topic, subTopicId, questionId });
            if (question) {
              question.notes = String(notes || '');
            }
          }),
        );
      },

      deleteQuestion: ({ topicId, subTopicId = null, questionId }) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            if (!topic) {
              return;
            }

            if (!subTopicId) {
              topic.questions = topic.questions.filter((question) => question.id !== questionId);
              return;
            }

            const subTopic = findSubTopic(topic, subTopicId);
            if (subTopic) {
              subTopic.questions = subTopic.questions.filter((question) => question.id !== questionId);
            }
          }),
        );
      },

      reorderTopics: (sourceId, targetId = null) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            sheet.topics = moveItemById(sheet.topics, sourceId, targetId);
          }),
        );
      },

      reorderSubTopics: ({ topicId, sourceId, targetId = null }) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            if (topic) {
              topic.subTopics = moveItemById(topic.subTopics, sourceId, targetId);
            }
          }),
        );
      },

      reorderQuestions: ({ topicId, subTopicId = null, sourceId, targetId = null }) => {
        set((state) =>
          createLocalPatch(state, (sheet) => {
            const topic = findTopic(sheet, topicId);
            if (!topic) {
              return;
            }

            if (!subTopicId) {
              topic.questions = moveItemById(topic.questions, sourceId, targetId);
              return;
            }

            const subTopic = findSubTopic(topic, subTopicId);
            if (subTopic) {
              subTopic.questions = moveItemById(subTopic.questions, sourceId, targetId);
            }
          }),
        );
      },
    }),
    {
      name: 'question-management-sheet-v2',
      partialize: (state) => ({
        sheet: state.sheet,
        dataSource: state.dataSource,
        theme: state.theme,
      }),
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState || {}),
        };

        return {
          ...merged,
          sheet: normalizeSheetShape(merged.sheet),
        };
      },
    },
  ),
);
