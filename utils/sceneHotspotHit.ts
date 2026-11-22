/** Percent-of-scene box (top-left origin, same as Scene Studio). */
export type ScenePctBox = { x: number; y: number; w: number; h: number };

/**
 * Hit-slop around a scene "!" / dialogue hotspot.
 *
 * The badge itself is often ~8–12% of the frame and floats above the animal.
 * Extra pad is mostly downward so the character the ! points at is tappable,
 * without turning the full-bleed background into a button.
 */
export const SCENE_HOTSPOT_HIT = {
  /** Extra % of the scene frame on each horizontal side. */
  padX: 8,
  /** Extra % above the badge. */
  padUp: 4,
  /** Extra % below the badge — covers the animal/character. */
  padDown: 18,
  minW: 22,
  minH: 28,
  /** Keep the expanded box above the ACTIVITIES board. */
  boardTop: 78,
} as const;

export type ExpandedHotspotHit = {
  /** Expanded tappable box, still in % of the scene frame. */
  hit: ScenePctBox;
  /**
   * Badge position inside the hit box, as % of the hit box
   * (so the ! stays visually where CMS placed it).
   */
  icon: ScenePctBox;
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Expand a CMS hotspot so kids can tap the subject under the !, not only the badge.
 * Visual icon stays at the original (x, y, w, h).
 */
export function expandSceneHotspotHit(
  box: ScenePctBox,
  opts?: { clampBottom?: number },
): ExpandedHotspotHit {
  const w = Math.max(box.w, 0.5);
  const h = Math.max(box.h, 0.5);
  const padX = Math.max(SCENE_HOTSPOT_HIT.padX, w * 0.75);
  const padUp = Math.max(SCENE_HOTSPOT_HIT.padUp, h * 0.4);
  const padDown = Math.max(SCENE_HOTSPOT_HIT.padDown, h * 2);
  const bottomLimit = opts?.clampBottom ?? 100;

  let hitX = box.x - padX;
  let hitY = box.y - padUp;
  let hitW = Math.max(w + padX * 2, SCENE_HOTSPOT_HIT.minW);
  let hitH = Math.max(h + padUp + padDown, SCENE_HOTSPOT_HIT.minH);

  if (hitX < 0) {
    hitW += hitX;
    hitX = 0;
  }
  if (hitY < 0) {
    hitH += hitY;
    hitY = 0;
  }
  if (hitX + hitW > 100) hitW = 100 - hitX;
  if (hitY + hitH > bottomLimit) hitH = Math.max(h, bottomLimit - hitY);

  hitW = clamp(hitW, w, 100);
  hitH = clamp(hitH, h, 100);
  hitX = clamp(hitX, 0, 100 - hitW);
  hitY = clamp(hitY, 0, Math.max(0, bottomLimit - hitH));

  const icon: ScenePctBox = {
    x: hitW > 0 ? ((box.x - hitX) / hitW) * 100 : 0,
    y: hitH > 0 ? ((box.y - hitY) / hitH) * 100 : 0,
    w: hitW > 0 ? (w / hitW) * 100 : 100,
    h: hitH > 0 ? (h / hitH) * 100 : 100,
  };

  return { hit: { x: hitX, y: hitY, w: hitW, h: hitH }, icon };
}

/** Dialogue / tap-to-talk ids from Scene Studio. */
export function isDialogueHotspotId(id: string): boolean {
  return id === 'dialogue' || id.startsWith('dialogue_');
}
