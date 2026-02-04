/**
 * Gemini TTS Utility
 * Shared TTS generation using Vertex AI Gemini 2.5 Flash TTS
 * with fallback to Google Cloud TTS
 */

const crypto = require('crypto');
const fetch = require('node-fetch');
const textToSpeech = require('@google-cloud/text-to-speech');
const { bucket } = require('../config/storage');

// Gemini TTS speakers (from Google's documentation)
const GEMINI_TTS_SPEAKERS = {
    male: ['Charon', 'Fenrir', 'Orus', 'Puck', 'Zephyr'],
    female: ['Kore', 'Aoede', 'Leda']
};

// Initialize Google Cloud TTS client as fallback
let ttsClient = null;
const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (credentialsJson) {
    try {
        const credentials = JSON.parse(credentialsJson);
        ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
        console.log('🎙️ TTS Utility: Google Cloud TTS client initialized');
    } catch (e) {
        console.error('🎙️ TTS Utility: Failed to init TTS client:', e.message);
    }
}

/**
 * Get access token for Vertex AI using service account
 */
const getVertexAccessToken = async () => {
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) return null;
    
    try {
        const { GoogleAuth } = require('google-auth-library');
        const credentials = JSON.parse(credentialsJson);
        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        return token.token;
    } catch (err) {
        console.error('❌ Failed to get Vertex access token:', err.message);
        return null;
    }
};

/**
 * Convert PCM L16 audio to WAV format by adding header
 */
const convertPCMToWAV = (pcmBuffer, mimeType) => {
    // Parse sample rate from mime type (e.g., "audio/L16;codec=pcm;rate=24000")
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
    const numChannels = 1; // Mono
    const bitsPerSample = 16; // L16 = 16-bit
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    
    // Create WAV header (44 bytes)
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4); // File size - 8
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // Subchunk1 size
    wavHeader.writeUInt16LE(1, 20); // Audio format (PCM)
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(pcmBuffer.length, 40);
    
    // Combine header + PCM data
    return Buffer.concat([wavHeader, pcmBuffer]);
};

/**
 * Generate TTS audio using Vertex AI Gemini TTS or Google Cloud TTS fallback
 * 
 * @param {string} text - Text to convert to speech (can include [emotional cues])
 * @param {object} options - TTS options
 * @param {string} options.voice - Preferred voice name (Kore, Charon, etc.)
 * @param {string} options.gender - Voice gender preference ('male' or 'female')
 * @param {string} options.storagePath - GCS path prefix (e.g., 'devotional-stories/tts')
 * @param {string} options.filenamePrefix - Filename prefix (e.g., 'story')
 * @returns {Promise<{url: string, duration: number} | null>}
 */
const generateTTS = async (text, options = {}) => {
    const {
        voice,
        gender = 'female',
        storagePath = 'tts',
        filenamePrefix = 'audio'
    } = options;
    
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    
    // Try Vertex AI Gemini 2.5 Flash TTS first (supports emotional cues)
    if (credentialsJson) {
        try {
            console.log('🎙️ Generating TTS with Vertex AI Gemini 2.5 Flash...');
            
            const credentials = JSON.parse(credentialsJson);
            const projectId = credentials.project_id;
            
            const accessToken = await getVertexAccessToken();
            if (!accessToken) {
                throw new Error('Could not get access token');
            }
            
            // Determine speaker
            let speaker = voice;
            if (!speaker) {
                const voices = gender === 'male' ? GEMINI_TTS_SPEAKERS.male : GEMINI_TTS_SPEAKERS.female;
                speaker = voices[Math.floor(Math.random() * voices.length)];
            }
            console.log(`🎭 Using Gemini voice: ${speaker}`);
            
            const response = await fetch(
                `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash-preview-tts:generateContent`,
                {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [{ text }]
                        }],
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: speaker
                                    }
                                }
                            }
                        }
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                
                if (audioData) {
                    let audioBuffer = Buffer.from(audioData, 'base64');
                    const mimeType = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';
                    console.log(`🎵 Vertex AI TTS audio format: ${mimeType}, size: ${audioBuffer.length} bytes`);
                    
                    // Determine file extension and handle format conversion
                    let extension = 'wav';
                    let contentType = 'audio/wav';
                    
                    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
                        extension = 'mp3';
                        contentType = 'audio/mpeg';
                    } else if (mimeType.includes('ogg')) {
                        extension = 'ogg';
                        contentType = 'audio/ogg';
                    } else if (mimeType.includes('L16') || mimeType.includes('pcm')) {
                        // Convert PCM to WAV
                        console.log('🔄 Converting PCM to WAV...');
                        audioBuffer = convertPCMToWAV(audioBuffer, mimeType);
                        extension = 'wav';
                        contentType = 'audio/wav';
                    }
                    
                    // Save to GCS
                    const hash = crypto.createHash('md5').update(text + Date.now()).digest('hex').slice(0, 12);
                    const filename = `${storagePath}/${filenamePrefix}_${hash}.${extension}`;
                    
                    if (bucket) {
                        const blob = bucket.file(filename);
                        await new Promise((resolve, reject) => {
                            const stream = blob.createWriteStream({ 
                                metadata: { 
                                    contentType,
                                    cacheControl: 'public, max-age=86400' // Cache for 24 hours
                                } 
                            });
                            stream.on('error', reject);
                            stream.on('finish', resolve);
                            stream.end(audioBuffer);
                        });
                        
                        // Make file public
                        await blob.makePublic();
                        
                        const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
                        console.log(`✅ TTS audio saved: ${url}`);
                        
                        // Estimate duration (rough: ~150 words per minute)
                        const wordCount = text.split(/\s+/).length;
                        const estimatedDuration = Math.ceil((wordCount / 150) * 60);
                        
                        return { url, duration: estimatedDuration };
                    }
                }
            } else {
                const errorText = await response.text();
                console.log('⚠️ Vertex AI TTS error, falling back:', errorText);
            }
        } catch (err) {
            console.log('⚠️ Vertex AI TTS error, falling back:', err.message);
        }
    }
    
    // Fallback to Google Cloud TTS
    if (!ttsClient) {
        console.error('❌ No TTS client available');
        return null;
    }

    try {
        console.log('🎙️ Using Google Cloud TTS fallback...');
        
        // Strip emotional cues for Google Cloud TTS (it doesn't support them)
        const cleanText = text.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
        
        const request = {
            input: { text: cleanText },
            voice: {
                languageCode: 'en-US',
                name: 'en-US-Chirp3-HD-Enceladus',
            },
            audioConfig: {
                audioEncoding: 'MP3',
                pitch: 0,
                speakingRate: 1.0,
            },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        
        if (!response.audioContent) {
            throw new Error('No audio content');
        }

        // Save to GCS
        const hash = crypto.createHash('md5').update(text + Date.now()).digest('hex').slice(0, 12);
        const filename = `${storagePath}/${filenamePrefix}_${hash}.mp3`;
        
        if (bucket) {
            const blob = bucket.file(filename);
            await new Promise((resolve, reject) => {
                const stream = blob.createWriteStream({ 
                    metadata: { 
                        contentType: 'audio/mpeg',
                        cacheControl: 'public, max-age=86400'
                    } 
                });
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(response.audioContent);
            });
            
            await blob.makePublic();
            
            const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
            console.log(`✅ Google Cloud TTS saved: ${url}`);
            
            // Estimate duration
            const wordCount = cleanText.split(/\s+/).length;
            const estimatedDuration = Math.ceil((wordCount / 150) * 60);
            
            return { url, duration: estimatedDuration };
        }
    } catch (err) {
        console.error('❌ Google Cloud TTS error:', err.message);
    }
    
    return null;
};

/**
 * Add emotional cues to text for more expressive TTS
 * 
 * @param {string} text - Plain text content
 * @param {string} mood - Overall mood ('warm', 'excited', 'gentle', 'reverent')
 * @returns {string} Text with emotional cues
 */
const addEmotionalCues = (text, mood = 'warm') => {
    // Add opening cue based on mood
    const openingCues = {
        warm: '[warm]',
        excited: '[excited]',
        gentle: '[gentle]',
        reverent: '[reverent]',
        joyful: '[joyful]',
        upbeat: '[upbeat]'
    };
    
    const cue = openingCues[mood] || '[warm]';
    return `${cue} ${text}`;
};

module.exports = {
    generateTTS,
    addEmotionalCues,
    GEMINI_TTS_SPEAKERS
};
