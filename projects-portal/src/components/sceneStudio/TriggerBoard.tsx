import React, { useMemo, useRef, useState } from 'react';
import { Film, Link2, Plus, Trash2, Upload } from 'lucide-react';
import type {
    SceneActivityId,
    SceneAnimation,
    SceneButton,
    SceneTrigger,
} from './types';
import { SCENE_ACTIVITY_DEFS, newId } from './types';
import { getMediaUrl } from '../../services/apiClient';

interface TriggerBoardProps {
    buttons: SceneButton[];
    animations: SceneAnimation[];
    triggers: SceneTrigger[];
    onChangeAnimations: (next: SceneAnimation[]) => void;
    onChangeTriggers: (next: SceneTrigger[]) => void;
    onUploadAnimationVideo: (file: File) => Promise<string>;
}

const asActivityId = (id: string): SceneActivityId | '' =>
    id === 'read' ||
    id === 'quiz' ||
    id === 'puzzle' ||
    id === 'coloring' ||
    id === 'game'
        ? id
        : '';

/**
 * Lightweight whiteboard: Button → Animation → After action, with SVG connectors.
 */
const TriggerBoard: React.FC<TriggerBoardProps> = ({
    buttons,
    animations,
    triggers,
    onChangeAnimations,
    onChangeTriggers,
    onUploadAnimationVideo,
}) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [pendingAnimId, setPendingAnimId] = useState<string | null>(null);

    const buttonOptions = useMemo(() => {
        const fromLayout = buttons.map((b) => ({
            id: b.id,
            label: b.label || SCENE_ACTIVITY_DEFS.find((d) => d.id === b.id)?.label || b.id,
        }));
        if (fromLayout.length) return fromLayout;
        return SCENE_ACTIVITY_DEFS.map((d) => ({ id: d.id, label: d.label }));
    }, [buttons]);

    const addAnimation = () => {
        const id = newId('anim');
        onChangeAnimations([
            ...animations,
            { id, label: `Animation ${animations.length + 1}`, videoUrl: '' },
        ]);
        setPendingAnimId(id);
        setTimeout(() => fileRef.current?.click(), 0);
    };

    const addTrigger = () => {
        const fromButtonId = buttonOptions[0]?.id || 'read';
        onChangeTriggers([
            ...triggers,
            {
                id: newId('trig'),
                fromButtonId,
                animationId: animations[0]?.id || '',
                after: 'navigate',
                navigateTo: asActivityId(fromButtonId) || 'read',
            },
        ]);
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const url = await onUploadAnimationVideo(file);
            if (pendingAnimId) {
                onChangeAnimations(
                    animations.map((a) =>
                        a.id === pendingAnimId
                            ? { ...a, videoUrl: url, label: a.label || file.name }
                            : a,
                    ),
                );
            } else {
                onChangeAnimations([
                    ...animations,
                    {
                        id: newId('anim'),
                        label: file.name.replace(/\.[^.]+$/, ''),
                        videoUrl: url,
                    },
                ]);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to upload animation video');
        } finally {
            setUploading(false);
            setPendingAnimId(null);
        }
    };

    const patchAnim = (id: string, patch: Partial<SceneAnimation>) => {
        onChangeAnimations(animations.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    };

    const patchTrig = (id: string, patch: Partial<SceneTrigger>) => {
        onChangeTriggers(triggers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-indigo-600" />
                        Trigger board
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Wire a button tap → animation video → navigate or stay.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={addAnimation}
                        disabled={uploading}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-50"
                    >
                        <Film className="w-3.5 h-3.5" />
                        {uploading ? 'Uploading…' : 'Add clip'}
                    </button>
                    <button
                        type="button"
                        onClick={addTrigger}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add wire
                    </button>
                </div>
            </div>

            <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFile}
            />

            {/* Animation clips strip */}
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Animation clips
                </p>
                {animations.length === 0 ? (
                    <p className="text-xs text-gray-400">No clips yet — add one to wire buttons.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {animations.map((anim) => (
                            <div
                                key={anim.id}
                                className="rounded-lg border border-gray-200 bg-slate-50 p-2 space-y-1.5"
                            >
                                <div className="flex items-center gap-2">
                                    <input
                                        value={anim.label}
                                        onChange={(e) =>
                                            patchAnim(anim.id, { label: e.target.value })
                                        }
                                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                                        placeholder="Label"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChangeAnimations(
                                                animations.filter((a) => a.id !== anim.id),
                                            )
                                        }
                                        className="p-1 text-gray-400 hover:text-red-600"
                                        aria-label="Remove clip"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {anim.videoUrl ? (
                                    <video
                                        src={getMediaUrl(anim.videoUrl)}
                                        className="w-full h-20 object-cover rounded bg-black"
                                        muted
                                        playsInline
                                        controls
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPendingAnimId(anim.id);
                                            fileRef.current?.click();
                                        }}
                                        className="w-full h-20 rounded border border-dashed border-gray-300 text-xs text-gray-500 inline-flex items-center justify-center gap-1 hover:bg-white"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        Upload video
                                    </button>
                                )}
                                <p className="text-[10px] text-gray-400 truncate font-mono">
                                    {anim.id}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Wires */}
            <div className="relative rounded-xl border border-indigo-100 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 min-h-[120px]">
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
                    aria-hidden
                >
                    {triggers.map((t, i) => {
                        const y = 40 + i * 72;
                        return (
                            <g key={t.id}>
                                <line
                                    x1="18%"
                                    y1={y}
                                    x2="50%"
                                    y2={y}
                                    stroke="#6366f1"
                                    strokeWidth="2"
                                    strokeDasharray="4 3"
                                />
                                <line
                                    x1="50%"
                                    y1={y}
                                    x2="82%"
                                    y2={y}
                                    stroke="#6366f1"
                                    strokeWidth="2"
                                    strokeDasharray="4 3"
                                />
                            </g>
                        );
                    })}
                </svg>

                {triggers.length === 0 ? (
                    <p className="relative text-xs text-gray-500 text-center py-6">
                        No wires yet. Add a wire to connect a button to an animation.
                    </p>
                ) : (
                    <div className="relative space-y-3">
                        {triggers.map((t) => (
                            <div
                                key={t.id}
                                className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto] gap-2 items-center bg-white/90 border border-indigo-100 rounded-lg p-2 shadow-sm"
                            >
                                <select
                                    value={t.fromButtonId}
                                    onChange={(e) => {
                                        const fromButtonId = e.target.value;
                                        patchTrig(t.id, {
                                            fromButtonId,
                                            navigateTo:
                                                t.after === 'navigate'
                                                    ? asActivityId(fromButtonId)
                                                    : '',
                                        });
                                    }}
                                    className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-amber-50"
                                >
                                    {buttonOptions.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            Button: {b.label}
                                        </option>
                                    ))}
                                </select>
                                <span className="text-[10px] text-indigo-500 font-medium text-center hidden md:block">
                                    →
                                </span>
                                <select
                                    value={t.animationId}
                                    onChange={(e) =>
                                        patchTrig(t.id, { animationId: e.target.value })
                                    }
                                    className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-violet-50"
                                >
                                    <option value="">(no animation)</option>
                                    {animations.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            Clip: {a.label || a.id}
                                        </option>
                                    ))}
                                </select>
                                <span className="text-[10px] text-indigo-500 font-medium text-center hidden md:block">
                                    →
                                </span>
                                <select
                                    value={t.after}
                                    onChange={(e) => {
                                        const after = e.target
                                            .value as SceneTrigger['after'];
                                        patchTrig(t.id, {
                                            after,
                                            navigateTo:
                                                after === 'navigate'
                                                    ? asActivityId(t.fromButtonId)
                                                    : '',
                                        });
                                    }}
                                    className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-emerald-50"
                                >
                                    <option value="navigate">Then navigate</option>
                                    <option value="stay">Then stay</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onChangeTriggers(triggers.filter((x) => x.id !== t.id))
                                    }
                                    className="p-1.5 text-gray-400 hover:text-red-600 justify-self-end"
                                    aria-label="Remove wire"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TriggerBoard;
