/**
 * Voice Cloning Service
 * Manages custom cloned voices stored locally
 */

export interface ClonedVoice {
  id: string;
  name: string;
  description?: string;
  voiceId: string; // ElevenLabs voice ID
  createdAt: number;
}

const STORAGE_KEY = 'godlykids_cloned_voices';

/**
 * Get all cloned voices from localStorage
 */
function getClonedVoices(): ClonedVoice[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading cloned voices:', error);
    return [];
  }
}

/**
 * Save a new cloned voice
 */
function saveClonedVoice(voice: ClonedVoice): void {
  try {
    const voices = getClonedVoices();
    voices.push(voice);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(voices));
  } catch (error) {
    console.error('Error saving cloned voice:', error);
    throw error;
  }
}

/**
 * Remove a cloned voice by ID
 */
function removeClonedVoice(voiceId: string): void {
  try {
    const voices = getClonedVoices();
    const filtered = voices.filter(v => v.voiceId !== voiceId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing cloned voice:', error);
    throw error;
  }
}

/**
 * Check if a voice ID is a cloned voice
 */
function isClonedVoice(voiceId: string): boolean {
  const voices = getClonedVoices();
  return voices.some(v => v.voiceId === voiceId);
}

/**
 * Get a specific cloned voice by ID
 */
function getClonedVoice(voiceId: string): ClonedVoice | undefined {
  const voices = getClonedVoices();
  return voices.find(v => v.voiceId === voiceId);
}

export const voiceCloningService = {
  getClonedVoices,
  saveClonedVoice,
  removeClonedVoice,
  isClonedVoice,
  getClonedVoice,
};

