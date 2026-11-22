/** CMS Try It (video + practice prompts). Not a scored quiz. */

export type TryItPromptType = 'statement' | 'fill_blank' | 'practice_write';

export type TryItPrompt = {
  type: TryItPromptType;
  text: string;
  blanks?: number;
};

export type TryItPayload = {
  videoUrl?: string;
  prompts?: TryItPrompt[];
};

const PROMPT_TYPES: TryItPromptType[] = [
  'statement',
  'fill_blank',
  'practice_write',
];

export const countFillBlanks = (text: string): number => {
  const matches = String(text || '').match(/_{2,}/g);
  return matches ? matches.length : 0;
};

export const storyHasTryIt = (s: { tryIt?: TryItPayload } | null | undefined): boolean => {
  if (!s?.tryIt) return false;
  const url = String(s.tryIt.videoUrl || '').trim();
  if (!url) return false;
  const prompts = Array.isArray(s.tryIt.prompts) ? s.tryIt.prompts : [];
  return prompts.some((p) => p && String(p.text || '').trim());
};

export const normalizeTryItPrompts = (raw: unknown): TryItPrompt[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): TryItPrompt | null => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as { type?: string; text?: string; blanks?: number };
      const type = PROMPT_TYPES.includes(rec.type as TryItPromptType)
        ? (rec.type as TryItPromptType)
        : '';
      const text = String(rec.text || '').trim();
      if (!type || !text) return null;
      const out: TryItPrompt = { type, text };
      if (type === 'fill_blank') {
        const n = Number(rec.blanks);
        const fromText = countFillBlanks(text);
        const blanks = Number.isFinite(n) && n >= 1 ? Math.floor(n) : fromText;
        if (blanks >= 1) out.blanks = blanks;
      }
      return out;
    })
    .filter((p): p is TryItPrompt => Boolean(p));
};

export const fillBlankCount = (prompt: TryItPrompt): number => {
  if (prompt.type !== 'fill_blank') return 0;
  const n = Number(prompt.blanks);
  if (Number.isFinite(n) && n >= 1) return Math.min(8, Math.floor(n));
  return Math.min(8, Math.max(1, countFillBlanks(prompt.text)));
};
