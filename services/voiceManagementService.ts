/**
 * Voice Management Service
 * Manages which voices are hidden/visible to the user
 */

const HIDDEN_VOICES_KEY = 'godlykids_hidden_voices';

export interface VoiceVisibility {
  voiceId: string;
  hidden: boolean;
}

/**
 * Get all hidden voice IDs
 */
export const getHiddenVoices = (): string[] => {
  try {
    const stored = localStorage.getItem(HIDDEN_VOICES_KEY);
    if (!stored) return [];
    const data = JSON.parse(stored);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error reading hidden voices:', error);
    return [];
  }
};

/**
 * Check if a voice is hidden
 */
export const isVoiceHidden = (voiceId: string): boolean => {
  const hidden = getHiddenVoices();
  return hidden.includes(voiceId);
};

/**
 * Hide a voice
 */
export const hideVoice = (voiceId: string): void => {
  try {
    const hidden = getHiddenVoices();
    if (!hidden.includes(voiceId)) {
      hidden.push(voiceId);
      localStorage.setItem(HIDDEN_VOICES_KEY, JSON.stringify(hidden));
    }
  } catch (error) {
    console.error('Error hiding voice:', error);
  }
};

/**
 * Show a voice (unhide)
 */
export const showVoice = (voiceId: string): void => {
  try {
    const hidden = getHiddenVoices();
    const filtered = hidden.filter(id => id !== voiceId);
    localStorage.setItem(HIDDEN_VOICES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error showing voice:', error);
  }
};

/**
 * Toggle voice visibility
 */
export const toggleVoiceVisibility = (voiceId: string): void => {
  if (isVoiceHidden(voiceId)) {
    showVoice(voiceId);
  } else {
    hideVoice(voiceId);
  }
};

/**
 * Filter voices to only show visible ones
 */
export const filterVisibleVoices = <T extends { voice_id: string }>(voices: T[]): T[] => {
  const hidden = getHiddenVoices();
  return voices.filter(voice => !hidden.includes(voice.voice_id));
};

