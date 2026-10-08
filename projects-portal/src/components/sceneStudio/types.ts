export type SceneDevice = 'phone' | 'tablet';
export type ScenePreviewMode = 'intro' | 'scene';
export type SceneActivityId = 'read' | 'quiz' | 'puzzle' | 'coloring' | 'game';
export type SceneLockUntil = 'always' | 'content' | 'trigger';
export type SceneAfterAction = 'navigate' | 'stay';

export interface SceneButton {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    iconUrl?: string;
    label?: string;
    lockedUntil?: SceneLockUntil;
}

export interface SceneDeviceLayout {
    showActivitiesBoard: boolean;
    buttons: SceneButton[];
}

export interface SceneLayout {
    phone: SceneDeviceLayout;
    tablet: SceneDeviceLayout;
}

export interface SceneAnimation {
    id: string;
    label: string;
    videoUrl: string;
}

export interface SceneTrigger {
    id: string;
    fromButtonId: string;
    animationId: string;
    after: SceneAfterAction;
    navigateTo: SceneActivityId | '';
}

export const SCENE_ACTIVITY_DEFS: Array<{
    id: SceneActivityId;
    label: string;
}> = [
    { id: 'read', label: 'READ STORY' },
    { id: 'quiz', label: 'QUIZZ' },
    { id: 'puzzle', label: 'PUZZLE' },
    { id: 'coloring', label: 'COLORING' },
    { id: 'game', label: 'GAME' },
];

/** Default % positions roughly matching the in-app ACTIVITIES tray (phone). */
export function defaultPhoneButtons(): SceneButton[] {
    const ids = SCENE_ACTIVITY_DEFS;
    const startX = 8;
    const gap = 1.5;
    const w = 16;
    // Lower on the frame so buttons sit in the main plank (not under the header).
    // Kid app also pins activity icons into the board tray when board chrome is on.
    const y = 84;
    const h = 14;
    return ids.map((d, i) => ({
        id: d.id,
        x: startX + i * (w + gap),
        y,
        w,
        h,
        label: d.label,
        lockedUntil: d.id === 'read' ? 'always' : 'content',
    }));
}

export function defaultTabletButtons(): SceneButton[] {
    const ids = SCENE_ACTIVITY_DEFS;
    const startX = 16;
    const gap = 2;
    const w = 13;
    const y = 85;
    const h = 13;
    return ids.map((d, i) => ({
        id: d.id,
        x: startX + i * (w + gap),
        y,
        w,
        h,
        label: d.label,
        lockedUntil: d.id === 'read' ? 'always' : 'content',
    }));
}

export function emptySceneLayout(): SceneLayout {
    return {
        phone: { showActivitiesBoard: true, buttons: [] },
        tablet: { showActivitiesBoard: true, buttons: [] },
    };
}

export function normalizeLoadedLayout(raw: unknown): SceneLayout {
    const empty = emptySceneLayout();
    if (!raw || typeof raw !== 'object') return empty;
    const obj = raw as Partial<SceneLayout>;
    const normDevice = (d: unknown): SceneDeviceLayout => {
        if (!d || typeof d !== 'object') {
            return { showActivitiesBoard: true, buttons: [] };
        }
        const device = d as Partial<SceneDeviceLayout>;
        const buttons = Array.isArray(device.buttons)
            ? device.buttons
                  .filter((b): b is SceneButton => !!b && typeof b === 'object' && !!b.id)
                  .map((b) => ({
                      id: String(b.id),
                      x: Number(b.x) || 0,
                      y: Number(b.y) || 0,
                      w: Number(b.w) || 14,
                      h: Number(b.h) || 12,
                      iconUrl: b.iconUrl ? String(b.iconUrl) : undefined,
                      label: b.label ? String(b.label) : undefined,
                      lockedUntil:
                          b.lockedUntil === 'always' ||
                          b.lockedUntil === 'content' ||
                          b.lockedUntil === 'trigger'
                              ? b.lockedUntil
                              : 'content',
                  }))
            : [];
        return {
            showActivitiesBoard: device.showActivitiesBoard !== false,
            buttons,
        };
    };
    return {
        phone: normDevice(obj.phone),
        tablet: normDevice(obj.tablet),
    };
}

export function ensureDefaultButtons(layout: SceneLayout): SceneLayout {
    return {
        phone: {
            ...layout.phone,
            buttons:
                layout.phone.buttons.length > 0
                    ? layout.phone.buttons
                    : defaultPhoneButtons(),
        },
        tablet: {
            ...layout.tablet,
            buttons:
                layout.tablet.buttons.length > 0
                    ? layout.tablet.buttons
                    : defaultTabletButtons(),
        },
    };
}

export const DEVICE_FRAME: Record<
    SceneDevice,
    { width: number; height: number; label: string; borderRadius: number }
> = {
    phone: { width: 260, height: 520, label: 'Phone', borderRadius: 28 },
    tablet: { width: 360, height: 480, label: 'Tablet', borderRadius: 22 },
};

export function newId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
