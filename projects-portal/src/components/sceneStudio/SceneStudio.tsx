import React, { useMemo, useRef, useState } from 'react';
import { Upload, Clapperboard, Music, X } from 'lucide-react';
import DevicePreview from './DevicePreview';
import OverlayCanvas from './OverlayCanvas';
import TriggerBoard from './TriggerBoard';
import {
    ensureDefaultButtons,
    type SceneAnimation,
    type SceneDevice,
    type SceneLayout,
    type ScenePreviewMode,
    type SceneTrigger,
} from './types';
import { getMediaUrl } from '../../services/apiClient';

export interface SceneStudioProps {
    /** Display title on the island scene wood header (MapStory.displayTitle). */
    sceneTitle: string;
    introVideoUrl: string;
    sceneBgVideoUrl: string;
    sceneMusicUrl: string;
    sceneLayout: SceneLayout;
    sceneAnimations: SceneAnimation[];
    sceneTriggers: SceneTrigger[];
    onSceneTitle: (title: string) => void;
    onIntroVideoUrl: (url: string) => void;
    onSceneBgVideoUrl: (url: string) => void;
    onSceneMusicUrl: (url: string) => void;
    onSceneLayout: (layout: SceneLayout) => void;
    onSceneAnimations: (anims: SceneAnimation[]) => void;
    onSceneTriggers: (triggers: SceneTrigger[]) => void;
    onUploadVideo: (file: File, kind: 'intro' | 'scene-bg' | 'scene-anim') => Promise<string>;
    onUploadMusic: (file: File) => Promise<string>;
}

const SceneStudio: React.FC<SceneStudioProps> = ({
    sceneTitle,
    introVideoUrl,
    sceneBgVideoUrl,
    sceneMusicUrl,
    sceneLayout,
    sceneAnimations,
    sceneTriggers,
    onSceneTitle,
    onIntroVideoUrl,
    onSceneBgVideoUrl,
    onSceneMusicUrl,
    onSceneLayout,
    onSceneAnimations,
    onSceneTriggers,
    onUploadVideo,
    onUploadMusic,
}) => {
    const [device, setDevice] = useState<SceneDevice>('phone');
    const [previewMode, setPreviewMode] = useState<ScenePreviewMode>('scene');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [uploadingIntro, setUploadingIntro] = useState(false);
    const [uploadingBg, setUploadingBg] = useState(false);
    const [uploadingMusic, setUploadingMusic] = useState(false);
    const introRef = useRef<HTMLInputElement>(null);
    const bgRef = useRef<HTMLInputElement>(null);
    const musicRef = useRef<HTMLInputElement>(null);

    const layoutWithDefaults = useMemo(
        () => ensureDefaultButtons(sceneLayout),
        [sceneLayout],
    );
    const deviceLayout = layoutWithDefaults[device];

    const previewUrl = getMediaUrl(
        previewMode === 'intro' ? introVideoUrl : sceneBgVideoUrl,
    );

    const setDeviceButtons = (buttons: typeof deviceLayout.buttons) => {
        onSceneLayout({
            ...layoutWithDefaults,
            [device]: { ...deviceLayout, buttons },
        });
    };

    const setShowBoard = (show: boolean) => {
        onSceneLayout({
            ...layoutWithDefaults,
            [device]: { ...deviceLayout, showActivitiesBoard: show },
        });
    };

    const seedDefaultsIfEmpty = () => {
        if (
            sceneLayout.phone.buttons.length === 0 &&
            sceneLayout.tablet.buttons.length === 0
        ) {
            onSceneLayout(layoutWithDefaults);
        }
    };

    const handleIntroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingIntro(true);
        try {
            const url = await onUploadVideo(file, 'intro');
            onIntroVideoUrl(url);
            setPreviewMode('intro');
        } catch (err) {
            console.error(err);
            alert('Failed to upload intro video');
        } finally {
            setUploadingIntro(false);
        }
    };

    const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingBg(true);
        try {
            const url = await onUploadVideo(file, 'scene-bg');
            onSceneBgVideoUrl(url);
            setPreviewMode('scene');
        } catch (err) {
            console.error(err);
            alert('Failed to upload scene background video');
        } finally {
            setUploadingBg(false);
        }
    };

    const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingMusic(true);
        try {
            const url = await onUploadMusic(file);
            onSceneMusicUrl(url);
        } catch (err) {
            console.error(err);
            alert('Failed to upload scene music');
        } finally {
            setUploadingMusic(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
                <div className="flex items-start gap-2">
                    <Clapperboard className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium">Scene Studio</p>
                        <p className="text-emerald-800/90 text-xs mt-1">
                            Upload the intro animation, looping garden BG, and scene music; drag
                            activity buttons for phone/tablet; then wire tap → animation video →
                            navigate.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Scene title
                        </label>
                        <input
                            value={sceneTitle}
                            onChange={(e) => onSceneTitle(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
                            placeholder="e.g. 1. THE BEGINNING"
                        />
                        <p className="text-xs text-gray-500">
                            Shown in the wood header on the kid app island scene. Same as Display
                            title on Overview.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Intro animation video
                        </label>
                        <input
                            value={introVideoUrl}
                            onChange={(e) => onIntroVideoUrl(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="https://… or upload"
                        />
                        <input
                            ref={introRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handleIntroUpload}
                        />
                        <button
                            type="button"
                            disabled={uploadingIntro}
                            onClick={() => introRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4" />
                            {uploadingIntro
                                ? 'Uploading…'
                                : introVideoUrl
                                  ? 'Replace intro'
                                  : 'Upload intro'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Scene background (loop) video
                        </label>
                        <input
                            value={sceneBgVideoUrl}
                            onChange={(e) => onSceneBgVideoUrl(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="https://… or upload"
                        />
                        <input
                            ref={bgRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handleBgUpload}
                        />
                        <button
                            type="button"
                            disabled={uploadingBg}
                            onClick={() => bgRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4" />
                            {uploadingBg
                                ? 'Uploading…'
                                : sceneBgVideoUrl
                                  ? 'Replace BG'
                                  : 'Upload BG'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Scene background music
                        </label>
                        <input
                            value={sceneMusicUrl}
                            onChange={(e) => onSceneMusicUrl(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="https://… or upload MP3"
                        />
                        <input
                            ref={musicRef}
                            type="file"
                            accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                            className="hidden"
                            onChange={handleMusicUpload}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                disabled={uploadingMusic}
                                onClick={() => musicRef.current?.click()}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                <Music className="w-4 h-4" />
                                {uploadingMusic
                                    ? 'Uploading…'
                                    : sceneMusicUrl
                                      ? 'Replace music'
                                      : 'Upload music'}
                            </button>
                            {sceneMusicUrl ? (
                                <>
                                    <audio
                                        key={sceneMusicUrl}
                                        src={getMediaUrl(sceneMusicUrl)}
                                        controls
                                        className="h-9 max-w-[220px]"
                                        preload="metadata"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onSceneMusicUrl('')}
                                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                                        title="Clear scene music"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Clear
                                    </button>
                                </>
                            ) : null}
                        </div>
                        <p className="text-xs text-gray-500">
                            Loops on the kid app scene after the intro (separate from book reader
                            music).
                        </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={deviceLayout.showActivitiesBoard}
                            onChange={(e) => setShowBoard(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        Show ACTIVITIES board chrome in preview
                    </label>

                    <button
                        type="button"
                        onClick={seedDefaultsIfEmpty}
                        className="text-xs text-indigo-600 hover:underline"
                    >
                        Reset / seed default button positions for empty layouts
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">Device preview</h3>
                        <div className="flex gap-2">
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                                {(['phone', 'tablet'] as SceneDevice[]).map((d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => {
                                            setDevice(d);
                                            setSelectedId(null);
                                        }}
                                        className={`px-2.5 py-1.5 capitalize ${
                                            device === d
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                        } ${d === 'tablet' ? 'border-l border-gray-200' : ''}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('scene')}
                                    className={`px-2.5 py-1.5 ${
                                        previewMode === 'scene'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    Loop BG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('intro')}
                                    className={`px-2.5 py-1.5 border-l border-gray-200 ${
                                        previewMode === 'intro'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    Intro
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        Drag buttons to position · select + corner handle to resize · positions
                        saved as % of frame.
                    </p>
                    <DevicePreview
                        device={device}
                        mode={previewMode}
                        videoUrl={previewUrl}
                        sceneTitle={sceneTitle}
                    >
                        <OverlayCanvas
                            buttons={deviceLayout.buttons}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onChangeButtons={setDeviceButtons}
                            showActivitiesBoard={deviceLayout.showActivitiesBoard}
                        />
                    </DevicePreview>
                </div>
            </div>

            <TriggerBoard
                buttons={deviceLayout.buttons}
                animations={sceneAnimations}
                triggers={sceneTriggers}
                onChangeAnimations={onSceneAnimations}
                onChangeTriggers={onSceneTriggers}
                onUploadAnimationVideo={(file) => onUploadVideo(file, 'scene-anim')}
            />
        </div>
    );
};

export default SceneStudio;
