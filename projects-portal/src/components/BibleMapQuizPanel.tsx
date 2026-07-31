import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react';
import apiClient from '../services/apiClient';

export type QuizLevel = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
}

export type QuizLevelsState = Record<QuizLevel, QuizQuestion[]>;

export const emptyQuestion = (): QuizQuestion => ({
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
});

export const emptyQuizLevels = (): QuizLevelsState => ({
    easy: [],
    medium: [],
    hard: [],
});

const LEVEL_META: Record<QuizLevel, { label: string; hint: string }> = {
    easy: { label: 'Easy', hint: 'Ages ~3–5 · simple who/what' },
    medium: { label: 'Medium', hint: 'Ages ~6–8 · story details' },
    hard: { label: 'Hard', hint: 'Ages ~9–12 · themes & inference' },
};

type ChatMsg = { role: 'user' | 'assistant'; content: string };

interface BibleMapQuizPanelProps {
    quizMode: 'book_quiz' | 'custom' | 'none';
    onQuizModeChange: (mode: 'book_quiz' | 'custom' | 'none') => void;
    hasBook: boolean;
    levels: QuizLevelsState;
    defaultLevel: QuizLevel;
    onLevelsChange: (levels: QuizLevelsState) => void;
    onDefaultLevelChange: (level: QuizLevel) => void;
    packTitle: string;
    scriptureRef: string;
    verse: string;
}

const BibleMapQuizPanel: React.FC<BibleMapQuizPanelProps> = ({
    quizMode,
    onQuizModeChange,
    hasBook,
    levels,
    defaultLevel,
    onLevelsChange,
    onDefaultLevelChange,
    packTitle,
    scriptureRef,
    verse,
}) => {
    const [activeLevel, setActiveLevel] = useState<QuizLevel>(defaultLevel || 'easy');
    const [chatInput, setChatInput] = useState('');
    const [chat, setChat] = useState<ChatMsg[]>([]);
    const [sending, setSending] = useState(false);
    const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
    const [aiStatusMsg, setAiStatusMsg] = useState('');
    const [proposed, setProposed] = useState<QuizQuestion[]>([]);
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    const questions = levels[activeLevel] || [];

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get('/api/bible-map/quiz-assist/status');
                if (cancelled) return;
                setAiConfigured(!!res.data?.configured);
                setAiStatusMsg(res.data?.message || '');
            } catch {
                if (!cancelled) {
                    setAiConfigured(false);
                    setAiStatusMsg('configure ANTHROPIC_API_KEY in backend/.env');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chat, proposed, sending]);

    const counts = useMemo(
        () => ({
            easy: levels.easy.length,
            medium: levels.medium.length,
            hard: levels.hard.length,
        }),
        [levels],
    );

    const updateQuestions = useCallback(
        (next: QuizQuestion[]) => {
            onLevelsChange({ ...levels, [activeLevel]: next });
        },
        [activeLevel, levels, onLevelsChange],
    );

    const addQuestion = () => {
        updateQuestions([...questions, emptyQuestion()]);
    };

    const removeQuestion = (qi: number) => {
        updateQuestions(questions.filter((_, i) => i !== qi));
    };

    const patchQuestion = (qi: number, patch: Partial<QuizQuestion>) => {
        const next = questions.map((q, i) => (i === qi ? { ...q, ...patch } : q));
        updateQuestions(next);
    };

    const acceptProposed = (items: QuizQuestion[]) => {
        if (!items.length) return;
        updateQuestions([...questions, ...items]);
        setProposed([]);
    };

    const sendChat = async () => {
        const text = chatInput.trim();
        if (!text || sending) return;

        if (aiConfigured === false) {
            setChat((prev) => [
                ...prev,
                { role: 'user', content: text },
                {
                    role: 'assistant',
                    content: `AI chat needs configuration: ${aiStatusMsg || 'configure ANTHROPIC_API_KEY in backend/.env'}. You can still add and edit questions manually.`,
                },
            ]);
            setChatInput('');
            return;
        }

        const nextChat: ChatMsg[] = [...chat, { role: 'user', content: text }];
        setChat(nextChat);
        setChatInput('');
        setSending(true);
        setProposed([]);

        try {
            const res = await apiClient.post('/api/bible-map/quiz-assist', {
                messages: nextChat,
                level: activeLevel,
                count: 7,
                title: packTitle,
                scriptureRef,
                verse,
                topic: text,
            });
            const reply =
                res.data?.reply ||
                (res.data?.proposedQuestions?.length
                    ? `Proposed ${res.data.proposedQuestions.length} questions.`
                    : 'Done.');
            setChat((prev) => [...prev, { role: 'assistant', content: reply }]);
            const qs = (res.data?.proposedQuestions || []) as QuizQuestion[];
            setProposed(
                qs.map((q) => ({
                    question: q.question || '',
                    options:
                        Array.isArray(q.options) && q.options.length
                            ? [...q.options, '', '', '', ''].slice(0, 4)
                            : ['', '', '', ''],
                    correctIndex:
                        typeof q.correctIndex === 'number' ? q.correctIndex : 0,
                    explanation: q.explanation || '',
                })),
            );
        } catch (err: unknown) {
            const data = (err as { response?: { data?: { message?: string; error?: string } } })
                ?.response?.data;
            const msg =
                data?.message ||
                data?.error ||
                'Quiz assist failed. Check ANTHROPIC_API_KEY and try again.';
            if (
                String(msg).toLowerCase().includes('anthropic_api_key') ||
                String(msg).toLowerCase().includes('openai_api_key') ||
                data?.message
            ) {
                setAiConfigured(false);
                setAiStatusMsg(msg);
            }
            setChat((prev) => [...prev, { role: 'assistant', content: msg }]);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quiz mode</label>
                <select
                    value={quizMode}
                    onChange={(e) =>
                        onQuizModeChange(e.target.value as 'book_quiz' | 'custom' | 'none')
                    }
                    className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                    <option value="book_quiz">Auto from linked book (AI / BookQuiz)</option>
                    <option value="custom">Custom leveled questions</option>
                    <option value="none">No quiz</option>
                </select>
            </div>

            {quizMode === 'book_quiz' && (
                <p className="text-sm text-gray-500">
                    Uses the existing BookQuiz pipeline for the linked bible_map book.
                    {!hasBook && ' Link a book on the Book tab first.'}
                </p>
            )}

            {quizMode === 'custom' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="space-y-4 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            {(Object.keys(LEVEL_META) as QuizLevel[]).map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setActiveLevel(level)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                                        activeLevel === level
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                                    }`}
                                >
                                    {LEVEL_META[level].label}
                                    <span className="ml-1.5 opacity-80">({counts[level]})</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500">{LEVEL_META[activeLevel].hint} · aim for ~7</p>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Default level in app
                            </label>
                            <select
                                value={defaultLevel}
                                onChange={(e) =>
                                    onDefaultLevelChange(e.target.value as QuizLevel)
                                }
                                className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 bg-white"
                            >
                                {(Object.keys(LEVEL_META) as QuizLevel[]).map((level) => (
                                    <option key={level} value={level}>
                                        {LEVEL_META[level].label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-4">
                            {questions.map((q, qi) => (
                                <div
                                    key={qi}
                                    className="border border-gray-200 rounded-lg p-4 space-y-2 bg-white"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-semibold text-gray-500">
                                            Question {qi + 1}
                                        </span>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                                            onClick={() => removeQuestion(qi)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Remove
                                        </button>
                                    </div>
                                    <input
                                        value={q.question}
                                        onChange={(e) =>
                                            patchQuestion(qi, { question: e.target.value })
                                        }
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                        placeholder="Question text"
                                    />
                                    {q.options.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name={`correct-${activeLevel}-${qi}`}
                                                checked={q.correctIndex === oi}
                                                onChange={() =>
                                                    patchQuestion(qi, { correctIndex: oi })
                                                }
                                            />
                                            <input
                                                value={opt}
                                                onChange={(e) => {
                                                    const nextOpts = [...q.options];
                                                    nextOpts[oi] = e.target.value;
                                                    patchQuestion(qi, { options: nextOpts });
                                                }}
                                                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                                                placeholder={`Option ${oi + 1}`}
                                            />
                                        </div>
                                    ))}
                                    <input
                                        value={q.explanation || ''}
                                        onChange={(e) =>
                                            patchQuestion(qi, { explanation: e.target.value })
                                        }
                                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                                        placeholder="Short explanation (shown after a wrong answer)"
                                    />
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addQuestion}
                                className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
                            >
                                <Plus className="w-4 h-4" />
                                Add question
                            </button>
                        </div>
                    </div>

                    <div className="border border-indigo-100 rounded-xl bg-indigo-50/40 p-4 flex flex-col min-h-[420px]">
                        <div className="flex items-start gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                            <div>
                                <h3 className="text-sm font-semibold text-indigo-900">
                                    AI quiz assist · {LEVEL_META[activeLevel].label}
                                </h3>
                                <p className="text-xs text-indigo-800/80 mt-0.5">
                                    Chat about the topic, then accept proposed questions into this
                                    level.
                                </p>
                            </div>
                        </div>

                        {aiConfigured === false && (
                            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                {aiStatusMsg || 'configure ANTHROPIC_API_KEY in backend/.env'}. Manual
                                editing still works.
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-[280px] pr-1">
                            {chat.length === 0 && (
                                <p className="text-xs text-gray-500 flex items-start gap-2">
                                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    Try: “Generate 7 easy questions about Creation from Genesis 1.”
                                </p>
                            )}
                            {chat.map((m, i) => (
                                <div
                                    key={i}
                                    className={`text-sm rounded-lg px-3 py-2 whitespace-pre-wrap ${
                                        m.role === 'user'
                                            ? 'bg-white border border-gray-200 text-gray-800 ml-6'
                                            : 'bg-indigo-100/80 text-indigo-950 mr-4'
                                    }`}
                                >
                                    {m.content}
                                </div>
                            ))}
                            {sending && (
                                <div className="inline-flex items-center gap-2 text-xs text-indigo-700">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Thinking…
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {proposed.length > 0 && (
                            <div className="mb-3 rounded-lg border border-emerald-200 bg-white p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-emerald-800">
                                        Proposed ({proposed.length}) for {LEVEL_META[activeLevel].label}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => acceptProposed(proposed)}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-md"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        Accept all
                                    </button>
                                </div>
                                <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                                    {proposed.map((q, i) => (
                                        <li
                                            key={i}
                                            className="flex items-start justify-between gap-2 text-xs text-gray-700"
                                        >
                                            <span className="min-w-0">
                                                <span className="font-medium">{i + 1}.</span>{' '}
                                                {q.question}
                                            </span>
                                            <button
                                                type="button"
                                                className="shrink-0 text-emerald-700 hover:underline"
                                                onClick={() => acceptProposed([q])}
                                            >
                                                Add
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex gap-2 mt-auto">
                            <textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void sendChat();
                                    }
                                }}
                                rows={2}
                                placeholder={`Chat about ${packTitle || 'this story'}…`}
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none bg-white"
                            />
                            <button
                                type="button"
                                onClick={() => void sendChat()}
                                disabled={sending || !chatInput.trim()}
                                className="self-end px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BibleMapQuizPanel;
