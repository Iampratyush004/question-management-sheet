import { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTION_STATUS_LABELS } from './constants/questionStatus';
import { useSheetStore } from './store/sheetStore';
import { decodeShareTokenToSheet, encodeSheetToShareToken } from './utils/shareSheet';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'todo', label: 'Pending' },
  { value: 'done', label: 'Done' },
  { value: 'revision', label: 'Revision' },
  { value: 'marked', label: 'Marked' },
];

const matchesText = (value, query) =>
  String(value || '')
    .toLowerCase()
    .includes(query.toLowerCase());

const getStatus = (question) => question?.status || 'todo';

const statusMatches = (question, statusFilter) =>
  statusFilter === 'all' || getStatus(question) === statusFilter;

const questionMatches = (question, query) =>
  matchesText(question?.text || '', query) ||
  matchesText(question?.notes || '', query) ||
  matchesText(question?.url || '', query);

const getQuestionCounts = (questions) =>
  questions.reduce(
    (accumulator, question) => {
      accumulator.total += 1;
      const status = getStatus(question);

      if (status === 'done') {
        accumulator.done += 1;
      }

      if (status === 'revision') {
        accumulator.revision += 1;
      }

      if (status === 'marked') {
        accumulator.marked += 1;
      }

      return accumulator;
    },
    { total: 0, done: 0, revision: 0, marked: 0 },
  );

const getTopicQuestions = (topic) => [
  ...topic.questions,
  ...topic.subTopics.flatMap((subTopic) => subTopic.questions),
];

const getSheetCounts = (topics) =>
  getQuestionCounts(
    topics.flatMap((topic) => [
      ...topic.questions,
      ...topic.subTopics.flatMap((subTopic) => subTopic.questions),
    ]),
  );

const getProgressPercent = (done, total) => (total ? Math.round((done / total) * 100) : 0);

const filterSheet = (sheet, searchTerm, statusFilter) => {
  const query = searchTerm.trim().toLowerCase();

  if (!query && statusFilter === 'all') {
    return sheet.topics;
  }

  return sheet.topics
    .map((topic) => {
      const topicMatch = query ? matchesText(topic.title, query) : false;

      const filterQuestions = (questions, nameMatched = false) =>
        questions.filter((question) => {
          if (!statusMatches(question, statusFilter)) {
            return false;
          }

          if (!query) {
            return true;
          }

          if (nameMatched) {
            return true;
          }

          return questionMatches(question, query);
        });

      const topicQuestions = filterQuestions(topic.questions, topicMatch);

      const filteredSubTopics = topic.subTopics
        .map((subTopic) => {
          const subTopicMatch = query ? matchesText(subTopic.title, query) : false;
          const filteredQuestions = filterQuestions(subTopic.questions, topicMatch || subTopicMatch);

          if (topicMatch || subTopicMatch || filteredQuestions.length) {
            return {
              ...subTopic,
              questions: filteredQuestions,
            };
          }

          return null;
        })
        .filter(Boolean);

      if (!query) {
        if (
          topicQuestions.length ||
          filteredSubTopics.some((subTopic) => subTopic.questions.length)
        ) {
          return {
            ...topic,
            questions: topicQuestions,
            subTopics: filteredSubTopics,
          };
        }

        return null;
      }

      if (topicMatch || topicQuestions.length || filteredSubTopics.length) {
        return {
          ...topic,
          questions: topicQuestions,
          subTopics: filteredSubTopics,
        };
      }

      return null;
    })
    .filter(Boolean);
};

const Stats = ({ topics }) => {
  const totals = topics.reduce(
    (accumulator, topic) => {
      accumulator.topics += 1;
      accumulator.subTopics += topic.subTopics.length;
      return accumulator;
    },
    { topics: 0, subTopics: 0 },
  );

  const questionCounts = getSheetCounts(topics);
  const completionPercent = getProgressPercent(questionCounts.done, questionCounts.total);

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Topics</span>
        <strong className="stat-value">{totals.topics}</strong>
      </div>
      <div className="stat-card">
        <span className="stat-label">Sub-topics</span>
        <strong className="stat-value">{totals.subTopics}</strong>
      </div>
      <div className="stat-card">
        <span className="stat-label">Questions</span>
        <strong className="stat-value">{questionCounts.total}</strong>
      </div>
      <div className="stat-card">
        <span className="stat-label">Done</span>
        <strong className="stat-value">{questionCounts.done}</strong>
      </div>
      <div className="stat-card stat-card-wide">
        <span className="stat-label">Completion</span>
        <strong className="stat-value">{completionPercent}%</strong>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${completionPercent}%` }} />
        </div>
        <p className="progress-subtext">
          Revision: {questionCounts.revision} | Marked: {questionCounts.marked}
        </p>
      </div>
    </div>
  );
};

const ActionButton = ({ className = '', ...props }) => (
  <button className={`action-button ${className}`.trim()} type="button" {...props} />
);

const Modal = ({
  isOpen,
  title,
  value,
  onChange,
  onClose,
  onSubmit,
  placeholder,
  urlValue = '',
  onUrlChange = () => {},
  urlPlaceholder = 'Question URL',
  showUrlField = false,
}) => {
  if (!isOpen) {
    return null;
  }

  const handleEnterSave = (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    if (event.target.tagName === 'TEXTAREA' && event.shiftKey) {
      return;
    }

    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={4}
            onKeyDown={handleEnterSave}
            autoFocus
          />
          {showUrlField && (
            <input
              className="modal-input"
              type="url"
              value={urlValue}
              onChange={(event) => onUrlChange(event.target.value)}
              onKeyDown={handleEnterSave}
              placeholder={urlPlaceholder}
            />
          )}
          <div className="modal-actions">
            <ActionButton className="secondary" onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton className="primary" type="submit">
              Save
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};

const DropZone = ({ onDrop }) => (
  <div
    className="drop-zone"
    onDragOver={(event) => {
      event.preventDefault();
      event.stopPropagation();
    }}
    onDrop={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onDrop(event);
    }}
  >
    Drop here
  </div>
);

function App() {
  const {
    sheet,
    isLoading,
    error,
    theme,
    searchTerm,
    setSearchTerm,
    setSheetName,
    toggleTheme,
    loadSharedSheet,
    history,
    future,
    undo,
    redo,
    addTopic,
    updateTopic,
    deleteTopic,
    addSubTopic,
    updateSubTopic,
    deleteSubTopic,
    addQuestion,
    updateQuestion,
    setQuestionStatus,
    setQuestionNotes,
    deleteQuestion,
    reorderTopics,
    reorderSubTopics,
    reorderQuestions,
  } = useSheetStore((state) => state);

  const [statusFilter, setStatusFilter] = useState('all');
  const [topicDraft, setTopicDraft] = useState('');
  const [collapsedTopics, setCollapsedTopics] = useState({});
  const [flashMessage, setFlashMessage] = useState('');

  const searchInputRef = useRef(null);
  const topicInputRef = useRef(null);
  const flashTimeoutRef = useRef(null);

  const topics = useMemo(
    () => filterSheet(sheet, searchTerm, statusFilter),
    [sheet, searchTerm, statusFilter],
  );

  const [dialog, setDialog] = useState({
    open: false,
    title: '',
    value: '',
    placeholder: '',
    showUrlField: false,
    urlValue: '',
    urlPlaceholder: 'Question URL',
    onSave: null,
  });

  const canUndo = history.length > 0;
  const canRedo = future.length > 0;

  const showFlashMessage = (message) => {
    setFlashMessage(message);

    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }

    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashMessage('');
      flashTimeoutRef.current = null;
    }, 2400);
  };

  useEffect(
    () => () => {
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedToken = params.get('sharedSheet');

    if (sharedToken) {
      try {
        const sharedSheet = decodeShareTokenToSheet(sharedToken);
        loadSharedSheet(sharedSheet);
        return;
      } catch {
        showFlashMessage('Invalid shared link. Loaded default sheet.');
      }
    }
  }, [loadSharedSheet]);

  useEffect(() => {
    const handleShortcuts = (event) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.metaKey || event.ctrlKey;
      const activeTag = document.activeElement?.tagName || '';
      const isTypingTarget = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);

      if (event.key === 'Escape' && dialog.open) {
        setDialog((current) => ({ ...current, open: false }));
        return;
      }

      if (!hasModifier) {
        return;
      }

      if (key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        topicInputRef.current?.focus();
        return;
      }

      if (key === 'z' && !isTypingTarget) {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (key === 'y' && !isTypingTarget) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [dialog.open, redo, undo]);

  const openDialog = ({
    title,
    value = '',
    placeholder,
    onSave,
    showUrlField = false,
    urlValue = '',
    urlPlaceholder = 'Question URL (optional)',
  }) => {
    setDialog({
      open: true,
      title,
      value,
      placeholder,
      onSave,
      showUrlField,
      urlValue,
      urlPlaceholder,
    });
  };

  const closeDialog = () => {
    setDialog((current) => ({ ...current, open: false }));
  };

  const submitDialog = () => {
    if (dialog.onSave) {
      dialog.onSave(dialog.value, dialog.urlValue);
    }
    closeDialog();
  };

  const toggleTopic = (topicId) => {
    setCollapsedTopics((state) => ({
      ...state,
      [topicId]: !state[topicId],
    }));
  };

  const addTopicFromDraft = () => {
    if (!topicDraft.trim()) {
      return;
    }

    addTopic(topicDraft);
    setTopicDraft('');
  };

  const getDragMeta = (event) => {
    try {
      return JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch {
      return null;
    }
  };

  const writeDragMeta = (event, meta) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(meta));
  };

  const exportSheet = () => {
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sheet.slug || 'question-sheet'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const shareSheet = async () => {
    try {
      const token = encodeSheetToShareToken(sheet);
      const url = new URL(window.location.href);
      url.searchParams.set('sharedSheet', token);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.toString());
        showFlashMessage('Share link copied to clipboard.');
      } else {
        window.prompt('Copy this share link', url.toString());
      }
    } catch {
      showFlashMessage('Unable to generate share link for this sheet.');
    }
  };

  const renderQuestionItem = ({ topicId, subTopicId = null, question }) => (
    <li
      key={question.id}
      className="question-item"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const meta = getDragMeta(event);
        const sameSubTopic = (meta?.subTopicId || null) === (subTopicId || null);

        if (meta?.type === 'question' && meta.topicId === topicId && sameSubTopic) {
          reorderQuestions({
            topicId,
            subTopicId,
            sourceId: meta.questionId,
            targetId: question.id,
          });
        }
      }}
    >
      <span
        className="drag-handle"
        draggable
        onDragStart={(event) =>
          writeDragMeta(event, {
            type: 'question',
            topicId,
            subTopicId,
            questionId: question.id,
          })
        }
      >
        ::
      </span>

      <div className="question-main">
        {question.url ? (
          <a className="question-link" href={question.url} target="_blank" rel="noreferrer">
            {question.text}
          </a>
        ) : (
          <p>{question.text}</p>
        )}
        {question.notes?.trim() && <p className="question-notes-preview">Notes: {question.notes}</p>}
      </div>

      <div className="row-actions question-actions">
        <select
          className={`status-select status-${getStatus(question)}`}
          value={getStatus(question)}
          onChange={(event) =>
            setQuestionStatus({
              topicId,
              subTopicId,
              questionId: question.id,
              status: event.target.value,
            })
          }
        >
          {Object.entries(QUESTION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <ActionButton
          className={`ghost ${question.notes?.trim() ? 'has-notes' : ''}`}
          onClick={() =>
            openDialog({
              title: 'Question Notes',
              value: question.notes || '',
              placeholder: 'Add your notes, hints, edge cases, or revision points',
              onSave: (value) =>
                setQuestionNotes({
                  topicId,
                  subTopicId,
                  questionId: question.id,
                  notes: value,
                }),
            })
          }
        >
          {question.notes?.trim() ? 'Edit Notes' : 'Add Notes'}
        </ActionButton>

        <ActionButton
          className="ghost"
          onClick={() =>
            openDialog({
              title: 'Edit Question',
              value: question.text,
              placeholder: 'Question text',
              showUrlField: true,
              urlValue: question.url || '',
              urlPlaceholder: 'Question URL',
              onSave: (value, url) =>
                updateQuestion({
                  topicId,
                  subTopicId,
                  questionId: question.id,
                  text: value,
                  url,
                }),
            })
          }
        >
          Edit
        </ActionButton>

        <ActionButton
          className="danger"
          onClick={() =>
            deleteQuestion({
              topicId,
              subTopicId,
              questionId: question.id,
            })
          }
        >
          Delete
        </ActionButton>
      </div>
    </li>
  );

  return (
    <main className="page-shell">
      <section className="header-panel">
        <div className="header-meta">
          <span className="eyebrow">Interactive Sheet</span>
          <input
            className="sheet-title-input"
            value={sheet.name}
            onChange={(event) => setSheetName(event.target.value)}
            placeholder="Sheet Name"
          />
          <p className="updated-at">Last updated: {new Date(sheet.updatedAt).toLocaleString()}</p>
        </div>

        <div className="header-actions">
          <div className="header-button-row">
            <ActionButton className="ghost" disabled={!canUndo} onClick={undo}>
              Undo
            </ActionButton>
            <ActionButton className="ghost" disabled={!canRedo} onClick={redo}>
              Redo
            </ActionButton>
            <ActionButton className="ghost" onClick={toggleTheme}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </ActionButton>
            <ActionButton className="secondary" onClick={exportSheet}>
              Export
            </ActionButton>
            <ActionButton className="secondary" onClick={shareSheet}>
              Share
            </ActionButton>
          </div>

          <p className="shortcut-hint">
            Shortcuts: Ctrl/Cmd+F search, Ctrl/Cmd+N new topic, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo
          </p>

          {flashMessage && <p className="flash-note">{flashMessage}</p>}
        </div>
      </section>

      <Stats topics={sheet.topics} />

      <section className="toolbar">
        <div className="toolbar-main-row">
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by question text, notes, topic, or sub-topic"
          />

          <select
            className="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="topic-create-row">
          <input
            ref={topicInputRef}
            value={topicDraft}
            onChange={(event) => setTopicDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addTopicFromDraft();
              }
            }}
            placeholder="New topic name"
          />
          <ActionButton
            className="primary"
            onClick={addTopicFromDraft}
          >
            Add Topic
          </ActionButton>
        </div>
      </section>

      {isLoading && <p className="feedback">Syncing with Codolio API...</p>}
      {error && <p className="feedback error">{error}</p>}

      <section className="topics-list">
        {topics.map((topic) => {
          const isCollapsed = collapsedTopics[topic.id];
          const sourceTopic = sheet.topics.find((item) => item.id === topic.id) || topic;
          const topicCounts = getQuestionCounts(getTopicQuestions(sourceTopic));
          const topicCompletion = getProgressPercent(topicCounts.done, topicCounts.total);

          return (
            <article
              className="topic-card"
              key={topic.id}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const meta = getDragMeta(event);
                if (meta?.type === 'topic') {
                  reorderTopics(meta.topicId, topic.id);
                }
              }}
            >
              <header className="topic-header">
                <span
                  className="drag-handle"
                  draggable
                  onDragStart={(event) => writeDragMeta(event, { type: 'topic', topicId: topic.id })}
                  title="Drag to reorder topic"
                >
                  ::
                </span>

                <div className="topic-title-block">
                  <h2>{topic.title}</h2>
                  <div className="topic-progress-row">
                    <span>
                      {topicCounts.done}/{topicCounts.total} done
                    </span>
                    <div className="progress-track progress-track-small">
                      <div className="progress-fill" style={{ width: `${topicCompletion}%` }} />
                    </div>
                  </div>
                </div>

                <div className="row-actions">
                  <ActionButton className="ghost" onClick={() => toggleTopic(topic.id)}>
                    {isCollapsed ? 'Expand' : 'Collapse'}
                  </ActionButton>
                  <ActionButton
                    className="ghost"
                    onClick={() =>
                      openDialog({
                        title: 'Edit Topic',
                        value: topic.title,
                        placeholder: 'Topic name',
                        onSave: (value) => updateTopic(topic.id, value),
                      })
                    }
                  >
                    Edit
                  </ActionButton>
                  <ActionButton
                    className="danger"
                    onClick={() => {
                      if (window.confirm('Delete this topic and all nested content?')) {
                        deleteTopic(topic.id);
                      }
                    }}
                  >
                    Delete
                  </ActionButton>
                </div>
              </header>

              {!isCollapsed && (
                <div className="topic-body">
                  <div className="section-header">
                    <h3>Topic Questions</h3>
                    <ActionButton
                      className="secondary"
                      onClick={() =>
                        openDialog({
                          title: 'Add Question',
                          value: '',
                          placeholder: 'Question text',
                          showUrlField: true,
                          urlValue: '',
                          urlPlaceholder: 'Question URL',
                          onSave: (value, url) => addQuestion({ topicId: topic.id, text: value, url }),
                        })
                      }
                    >
                      Add Question
                    </ActionButton>
                  </div>

                  <ul className="question-list">
                    {topic.questions.map((question) =>
                      renderQuestionItem({
                        topicId: topic.id,
                        subTopicId: null,
                        question,
                      }),
                    )}
                  </ul>

                  {topic.questions.length > 0 && (
                    <DropZone
                      onDrop={(event) => {
                        const meta = getDragMeta(event);
                        if (
                          meta?.type === 'question' &&
                          meta.topicId === topic.id &&
                          !meta.subTopicId
                        ) {
                          reorderQuestions({
                            topicId: topic.id,
                            sourceId: meta.questionId,
                            targetId: null,
                          });
                        }
                      }}
                    />
                  )}

                  <div className="section-header">
                    <h3>Sub-topics</h3>
                    <ActionButton
                      className="secondary"
                      onClick={() =>
                        openDialog({
                          title: 'Add Sub-topic',
                          value: '',
                          placeholder: 'Sub-topic name',
                          onSave: (value) => addSubTopic(topic.id, value),
                        })
                      }
                    >
                      Add Sub-topic
                    </ActionButton>
                  </div>

                  <div className="subtopic-list">
                    {topic.subTopics.map((subTopic) => (
                      <section
                        key={subTopic.id}
                        className="subtopic-card"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const meta = getDragMeta(event);
                          if (meta?.type === 'subtopic' && meta.topicId === topic.id) {
                            reorderSubTopics({
                              topicId: topic.id,
                              sourceId: meta.subTopicId,
                              targetId: subTopic.id,
                            });
                          }
                        }}
                      >
                        <header className="subtopic-header">
                          <span
                            className="drag-handle"
                            draggable
                            onDragStart={(event) =>
                              writeDragMeta(event, {
                                type: 'subtopic',
                                topicId: topic.id,
                                subTopicId: subTopic.id,
                              })
                            }
                          >
                            ::
                          </span>
                          <h4>{subTopic.title}</h4>
                          <div className="row-actions">
                            <ActionButton
                              className="ghost"
                              onClick={() =>
                                openDialog({
                                  title: 'Edit Sub-topic',
                                  value: subTopic.title,
                                  placeholder: 'Sub-topic name',
                                  onSave: (value) => updateSubTopic(topic.id, subTopic.id, value),
                                })
                              }
                            >
                              Edit
                            </ActionButton>
                            <ActionButton
                              className="danger"
                              onClick={() => {
                                if (window.confirm('Delete this sub-topic and all nested questions?')) {
                                  deleteSubTopic(topic.id, subTopic.id);
                                }
                              }}
                            >
                              Delete
                            </ActionButton>
                          </div>
                        </header>

                        <div className="section-header">
                          <h5>Questions</h5>
                          <ActionButton
                            className="secondary"
                            onClick={() =>
                              openDialog({
                                title: 'Add Question',
                                value: '',
                                placeholder: 'Question text',
                                showUrlField: true,
                                urlValue: '',
                                urlPlaceholder: 'Question URL',
                                onSave: (value, url) =>
                                  addQuestion({
                                    topicId: topic.id,
                                    subTopicId: subTopic.id,
                                    text: value,
                                    url,
                                  }),
                              })
                            }
                          >
                            Add Question
                          </ActionButton>
                        </div>

                        <ul className="question-list compact">
                          {subTopic.questions.map((question) =>
                            renderQuestionItem({
                              topicId: topic.id,
                              subTopicId: subTopic.id,
                              question,
                            }),
                          )}
                        </ul>

                        {subTopic.questions.length > 0 && (
                          <DropZone
                            onDrop={(event) => {
                              const meta = getDragMeta(event);
                              if (
                                meta?.type === 'question' &&
                                meta.topicId === topic.id &&
                                meta.subTopicId === subTopic.id
                              ) {
                                reorderQuestions({
                                  topicId: topic.id,
                                  subTopicId: subTopic.id,
                                  sourceId: meta.questionId,
                                  targetId: null,
                                });
                              }
                            }}
                          />
                        )}
                      </section>
                    ))}
                  </div>

                  {topic.subTopics.length > 0 && (
                    <DropZone
                      onDrop={(event) => {
                        const meta = getDragMeta(event);
                        if (meta?.type === 'subtopic' && meta.topicId === topic.id) {
                          reorderSubTopics({
                            topicId: topic.id,
                            sourceId: meta.subTopicId,
                            targetId: null,
                          });
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </article>
          );
        })}

        {topics.length > 0 && (
          <DropZone
            onDrop={(event) => {
              const meta = getDragMeta(event);
              if (meta?.type === 'topic') {
                reorderTopics(meta.topicId, null);
              }
            }}
          />
        )}
      </section>

      <Modal
        isOpen={dialog.open}
        title={dialog.title}
        value={dialog.value}
        urlValue={dialog.urlValue}
        showUrlField={dialog.showUrlField}
        urlPlaceholder={dialog.urlPlaceholder}
        placeholder={dialog.placeholder}
        onChange={(value) => setDialog((current) => ({ ...current, value }))}
        onUrlChange={(urlValue) => setDialog((current) => ({ ...current, urlValue }))}
        onClose={closeDialog}
        onSubmit={submitDialog}
      />
    </main>
  );
}

export default App;
