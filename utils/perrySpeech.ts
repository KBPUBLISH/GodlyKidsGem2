import { fetchTtsAudioUrl } from '../services/characterChatService';
import { ONBOARDING_GUIDE_DEFAULT_NAME, ONBOARDING_GUIDE_VOICE_ID } from './onboardingJourney';

const cache = new Map<string, string>();

export const PERRY_VOICE_ID = ONBOARDING_GUIDE_VOICE_ID;

export const PERRY_HELLO_LINE = 'Woah... hello! (squawk)';
export const PERRY_HELLO_TTS = '[startled] Woah! [happily] Hello! [pause] Squawk!';
export const PERRY_ASK_LINE = "My name is Perry, what is your Child's name?";
export const PERRY_ASK_TTS =
  "[happily] My name is Perry, [warmly] what is your child's name?";
export const PERRY_WOOHOO_LINE = 'Woohoo!';
export const PERRY_WOOHOO_TTS = '[excitedly] Woohoo!';

export function perryFirstName(kidName?: string | null): string {
  const first = String(kidName || '')
    .trim()
    .split(/\s+/)[0];
  return first || ONBOARDING_GUIDE_DEFAULT_NAME;
}

export function buildPerryAvatarAskCopy(kidName: string): { line: string; tts: string } {
  const name = perryFirstName(kidName);
  return {
    line: `${name}, what a great name! Would you like to try out our selfie to avatar?`,
    tts: `[happily] ${name}, [excitedly] what a great name! [warmly] Would you like to try out our selfie to avatar?`,
  };
}

export function buildPerryReadyCopy(kidName: string): { line: string; tts: string } {
  const name = perryFirstName(kidName);
  return {
    line: `Hi ${name}, are you ready to start your adventure!`,
    tts: `[happily] Hi ${name}, [excitedly] are you ready to start your adventure!`,
  };
}

export function buildPerryIslandCopy(kidName?: string | null): { line: string; tts: string } {
  const name = perryFirstName(kidName);
  return {
    line: `${name}! We found our first island! Lets Fly! Oh wait, you can't haha… sorry. Lets get on the Godly Ship and set sail!`,
    tts: `[excitedly] ${name}! [happily] We found our first island! [excitedly] Let's fly! [giggles] Oh wait, you can't! Haha! [pause] Squawk! [warmly] Sorry. [happily] Let's get on the Godly Ship and set sail!`,
  };
}

export function fetchPerrySpeech(text: string): Promise<string | null> {
  const key = text.trim();
  if (!key) return Promise.resolve(null);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return fetchTtsAudioUrl(PERRY_VOICE_ID, key).then((url) => {
    if (url) cache.set(key, url);
    return url;
  });
}

export function preloadPerrySpeech(text: string): void {
  void fetchPerrySpeech(text);
}
