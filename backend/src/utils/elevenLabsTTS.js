/**
 * ElevenLabs TTS utility for Devotional Stories
 */

const axios = require('axios');
const crypto = require('crypto');
const { bucket } = require('../config/storage');

// Default ElevenLabs voices for story narration
const ELEVENLABS_VOICES = {
    // Female voices
    'Rachel': '21m00Tcm4TlvDq8ikWAM',
    'Domi': 'AZnzlk1XvdvUeBnXmlld',
    'Bella': 'EXAVITQu4vr4xnSDxMaL',
    'Elli': 'MF3mGyEYCl7XYWbV9V6O',
    'Charlotte': 'XB0fDUnXU5powFXDhCwa',
    'Matilda': 'XrExE9yKIg1WjnnlVkGX',
    'Grace': 'oWAxZDx7w5VEj9dCyTzz',
    
    // Male voices
    'Adam': 'pNInz6obpgDQGcFmaJgB',
    'Antoni': 'ErXwobaYiN019PkySvjV',
    'Arnold': 'VR6AewLTigWG4xSOukaG',
    'Josh': 'TxGEqnHWrfWFTfGW9XjX',
    'Sam': 'yoZ06aMxZJJ28mfd3POQ',
    'Clyde': '2EiwWnXFnvU5JabPnv8n',
    'Daniel': 'onwK4e9ZLuTAKqWW03F9',
    'Bill': 'pqHfZKP75CvOlQylNhV4',
    'George': 'JBFqnCBsd6RMkjVDRZzb',
    'Callum': 'N2lVS1w4EtoT3dr4eOWO',
};

// Voice metadata for the portal
const VOICE_OPTIONS = [
    { id: 'auto', name: 'Auto-select', gender: 'auto' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', description: 'Calm, warm' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', description: 'Soft, friendly' },
    { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', description: 'Expressive, youthful' },
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', description: 'Warm, nurturing' },
    { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', gender: 'female', description: 'Gentle, soothing' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', description: 'Deep, warm' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male', description: 'Young, energetic' },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', description: 'British, clear' },
    { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'male', description: 'Hoarse, storyteller' },
];

/**
 * Generate TTS audio using ElevenLabs API
 * @param {string} text - Text to convert to speech
 * @param {object} options - TTS options
 * @param {string} options.voiceId - ElevenLabs voice ID
 * @param {string} options.voiceName - Voice name (used to look up ID)
 * @param {string} options.storagePath - GCS path prefix for storage
 * @param {string} options.filenamePrefix - Filename prefix
 * @param {number} options.stability - Voice stability (0-1, default 0.5)
 * @param {number} options.similarityBoost - Voice clarity (0-1, default 0.75)
 * @param {number} options.style - Style exaggeration (0-1, default 0)
 * @returns {Promise<{url: string, duration: number}>}
 */
async function generateElevenLabsTTS(text, options = {}) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
        console.error('❌ ELEVENLABS_API_KEY not configured');
        throw new Error('ElevenLabs API key not configured');
    }
    
    // Determine voice ID
    let voiceId = options.voiceId;
    if (!voiceId && options.voiceName) {
        voiceId = ELEVENLABS_VOICES[options.voiceName];
    }
    if (!voiceId || voiceId === 'auto') {
        // Default to Rachel (warm female voice) for story narration
        voiceId = ELEVENLABS_VOICES['Rachel'];
    }
    
    const {
        storagePath = 'devotional-stories/tts',
        filenamePrefix = 'story',
        stability = 0.5,
        similarityBoost = 0.75,
        style = 0.2, // Slight style for more expressive narration
    } = options;
    
    // Clean text for TTS (remove markdown, keep punctuation)
    const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
        .replace(/\*(.*?)\*/g, '$1')       // Remove italic
        .replace(/#{1,6}\s/g, '')          // Remove headers
        .replace(/\[.*?\]\(.*?\)/g, '')    // Remove links
        .trim();
    
    console.log(`🎙️ Generating ElevenLabs TTS (voice: ${voiceId}, text length: ${cleanText.length})`);
    
    try {
        // Use eleven_multilingual_v2 for better quality
        const modelId = 'eleven_multilingual_v2';
        
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text: cleanText,
                model_id: modelId,
                voice_settings: {
                    stability,
                    similarity_boost: similarityBoost,
                    style,
                    use_speaker_boost: true
                }
            },
            {
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                responseType: 'arraybuffer',
                timeout: 120000 // 2 minute timeout for long stories
            }
        );
        
        const audioBuffer = Buffer.from(response.data);
        console.log(`✅ ElevenLabs TTS generated: ${audioBuffer.length} bytes`);
        
        // Estimate duration (rough: ~150 words per minute, ~5 chars per word)
        const wordCount = cleanText.split(/\s+/).length;
        const estimatedDuration = Math.ceil((wordCount / 150) * 60);
        
        // Save to GCS
        if (bucket) {
            const hash = crypto.createHash('md5')
                .update(cleanText + voiceId + Date.now())
                .digest('hex')
                .slice(0, 12);
            const filename = `${storagePath}/${filenamePrefix}_${hash}.mp3`;
            
            const blob = bucket.file(filename);
            await blob.save(audioBuffer, {
                metadata: {
                    contentType: 'audio/mpeg',
                    cacheControl: 'public, max-age=86400'
                }
            });
            await blob.makePublic();
            
            const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
            console.log(`✅ ElevenLabs TTS saved to: ${url}`);
            
            return {
                url,
                duration: estimatedDuration,
                voiceId
            };
        } else {
            throw new Error('GCS bucket not configured');
        }
        
    } catch (error) {
        if (error.response) {
            console.error('❌ ElevenLabs API Error:', error.response.status, error.response.data?.toString());
            
            // Try fallback voice if the specified voice fails
            if (voiceId !== ELEVENLABS_VOICES['Rachel'] && error.response.status === 401) {
                console.log('⚠️ Trying fallback voice (Rachel)...');
                return generateElevenLabsTTS(text, {
                    ...options,
                    voiceId: ELEVENLABS_VOICES['Rachel']
                });
            }
        }
        throw error;
    }
}

/**
 * Get available ElevenLabs voices for the portal
 */
function getVoiceOptions() {
    return VOICE_OPTIONS;
}

/**
 * Get voice ID from voice name
 */
function getVoiceId(voiceName) {
    return ELEVENLABS_VOICES[voiceName] || null;
}

module.exports = {
    generateElevenLabsTTS,
    getVoiceOptions,
    getVoiceId,
    ELEVENLABS_VOICES,
    VOICE_OPTIONS
};
