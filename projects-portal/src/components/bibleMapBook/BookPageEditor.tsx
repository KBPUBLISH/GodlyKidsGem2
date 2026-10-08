import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Film, ScrollText } from 'lucide-react';
import apiClient from '../../services/apiClient';
import BookPhonePreview from './BookPhonePreview';
import type { ReadingLevelKey, ReadingPageDraft } from './types';
import { READING_LEVELS } from './types';
import { sanitizeInteractiveWordIndices } from '../../utils/interactiveWords';

interface BookPageEditorProps {
    page: ReadingPageDraft;
    bookId: string;
    level: ReadingLevelKey;
    onLevelChange: (level: ReadingLevelKey) => void;
    onChange: (next: ReadingPageDraft) => void;
}

const BookPageEditor: React.FC<BookPageEditorProps> = ({
    page,
    bookId,
    level,
    onLevelChange,
    onChange,
}) => {
    const bgRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<string | null>(null);

    const patch = (partial: Partial<ReadingPageDraft>) => onChange({ ...page, ...partial });

    const patchLevel = (
        key: ReadingLevelKey,
        partial: { text?: string; interactiveWordIndices?: number[] },
    ) => {
        const prev = page.readingLevels[key];
        const text = partial.text !== undefined ? partial.text : prev.text;
        const indices =
            partial.interactiveWordIndices !== undefined
                ? sanitizeInteractiveWordIndices(text, partial.interactiveWordIndices)
                : sanitizeInteractiveWordIndices(text, prev.interactiveWordIndices);
        onChange({
            ...page,
            readingLevels: {
                ...page.readingLevels,
                [key]: { text, interactiveWordIndices: indices },
            },
        });
    };

    const upload = async (file: File, kind: 'background' | 'scroll' | 'video') => {
        setUploading(kind);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const isVideo = kind === 'video' || file.type.startsWith('video/');
            const endpoint = isVideo
                ? `/api/upload/video?bookId=${encodeURIComponent(bookId)}&type=${kind}`
                : `/api/upload/image?bookId=${encodeURIComponent(bookId)}&type=${kind}`;
            const res = await apiClient.post(endpoint, formData);
            const url = res.data.url as string;
            if (kind === 'scroll') {
                patch({ scrollUrl: url });
            } else if (kind === 'video') {
                const backgroundAudioUrl =
                    typeof res.data.backgroundAudioUrl === 'string'
                        ? res.data.backgroundAudioUrl
                        : undefined;
                patch({
                    backgroundUrl: url,
                    backgroundType: 'video',
                    backgroundAudioUrl,
                });
            } else {
                patch({
                    backgroundUrl: url,
                    backgroundType: 'image',
                    backgroundAudioUrl: undefined,
                });
            }
        } catch (err) {
            console.error(err);
            alert(`Failed to upload ${kind}`);
        } finally {
            setUploading(null);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Page {page.pageNumber} · shared media
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        <input
                            ref={bgRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = '';
                                if (f) void upload(f, 'background');
                            }}
                        />
                        <input
                            ref={videoRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = '';
                                if (f) void upload(f, 'video');
                            }}
                        />
                        <input
                            ref={scrollRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = '';
                                if (f) void upload(f, 'scroll');
                            }}
                        />
                        <button
                            type="button"
                            disabled={!!uploading}
                            onClick={() => bgRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ImageIcon className="w-3.5 h-3.5" />
                            {uploading === 'background' ? 'Uploading…' : 'Upload image'}
                        </button>
                        <button
                            type="button"
                            disabled={!!uploading}
                            onClick={() => videoRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Film className="w-3.5 h-3.5" />
                            {uploading === 'video' ? 'Uploading…' : 'Video BG'}
                        </button>
                        <button
                            type="button"
                            disabled={!!uploading}
                            onClick={() => scrollRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ScrollText className="w-3.5 h-3.5" />
                            {uploading === 'scroll' ? 'Uploading…' : 'Upload scroll'}
                        </button>
                    </div>
                    {(page.backgroundUrl || page.scrollUrl) && (
                        <div className="mt-2 flex gap-2 text-[11px] text-gray-500">
                            {page.backgroundUrl && (
                                <span className="truncate">
                                    BG: {page.backgroundType} · {page.backgroundUrl.slice(-32)}
                                </span>
                            )}
                            {page.scrollUrl && (
                                <span className="truncate">Scroll: …{page.scrollUrl.slice(-24)}</span>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs mb-2">
                        {READING_LEVELS.map((l) => (
                            <button
                                key={l.key}
                                type="button"
                                onClick={() => onLevelChange(l.key)}
                                className={`flex-1 px-2 py-1.5 ${
                                    level === l.key
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                } ${l.key !== 'ages_3_5' ? 'border-l border-gray-200' : ''}`}
                            >
                                {l.short}
                            </button>
                        ))}
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Text · {READING_LEVELS.find((l) => l.key === level)?.label}
                    </label>
                    <textarea
                        value={page.readingLevels[level].text}
                        onChange={(e) => patchLevel(level, { text: e.target.value })}
                        rows={6}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Age-appropriate story text for this page…"
                    />
                </div>
            </div>

            <BookPhonePreview
                page={page}
                level={level}
                editTapWords
                onChangeLevelText={patchLevel}
            />
        </div>
    );
};

export default BookPageEditor;
