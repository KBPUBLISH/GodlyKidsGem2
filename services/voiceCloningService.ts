// Voice Cloning Service - Manages cloned voices in local storage
const CLONED_VOICES_KEY = 'godlykids_cloned_voices';
const MAX_CLONES = 5;

export interface ClonedVoice {
  voice_id: string;
  name: string;
  description?: string;
  category: 'cloned';
  preview_url?: string;
  createdAt: number;
}

class VoiceCloningService {
  // Get all cloned voices from local storage
  getClonedVoices(): ClonedVoice[] {
    try {
      const stored = localStorage.getItem(CLONED_VOICES_KEY);
      if (!stored) return [];
      const voices = JSON.parse(stored) as ClonedVoice[];
      // Sort by creation date (newest first)
      return voices.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error reading cloned voices:', error);
      return [];
    }
  }

  // Add a cloned voice to local storage
  addClonedVoice(voice: Omit<ClonedVoice, 'createdAt'>): boolean {
    try {
      const voices = this.getClonedVoices();
      
      // Check limit
      if (voices.length >= MAX_CLONES) {
        return false;
      }

      // Check if voice already exists
      if (voices.some(v => v.voice_id === voice.voice_id)) {
        return false;
      }

      // Add new voice
      const newVoice: ClonedVoice = {
        ...voice,
        createdAt: Date.now()
      };

      voices.push(newVoice);
      localStorage.setItem(CLONED_VOICES_KEY, JSON.stringify(voices));
      return true;
    } catch (error) {
      console.error('Error saving cloned voice:', error);
      return false;
    }
  }

  // Remove a cloned voice from local storage
  removeClonedVoice(voiceId: string): boolean {
    try {
      const voices = this.getClonedVoices();
      const filtered = voices.filter(v => v.voice_id !== voiceId);
      localStorage.setItem(CLONED_VOICES_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error removing cloned voice:', error);
      return false;
    }
  }

  // Check if user can add more clones
  canAddMore(): boolean {
    return this.getClonedVoices().length < MAX_CLONES;
  }

  // Get remaining clone slots
  getRemainingSlots(): number {
    return Math.max(0, MAX_CLONES - this.getClonedVoices().length);
  }
}

export const voiceCloningService = new VoiceCloningService();


