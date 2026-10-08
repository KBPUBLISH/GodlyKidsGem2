const express = require('express');
const router = express.Router();
const EpisodeScript = require('../models/EpisodeScript');
const CharacterVoice = require('../models/CharacterVoice');
const { authenticateAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateAdmin);

// ========== Episode Scripts ==========

// List all episode scripts
router.get('/', async (req, res) => {
  try {
    const { showName, status, limit = 50 } = req.query;
    
    const query = {};
    if (showName) query.showName = showName;
    if (status) query.status = status;
    
    const scripts = await EpisodeScript.find(query)
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .lean();
      
    res.json(scripts);
  } catch (error) {
    console.error('Error fetching episode scripts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single episode script
router.get('/:id', async (req, res) => {
  try {
    const script = await EpisodeScript.findById(req.params.id).lean();
    
    if (!script) {
      return res.status(404).json({ error: 'Episode script not found' });
    }
    
    res.json(script);
  } catch (error) {
    console.error('Error fetching episode script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new episode script
router.post('/', async (req, res) => {
  try {
    const { 
      title, 
      showName, 
      episodeNumber, 
      season,
      description, 
      scriptText 
    } = req.body;
    
    if (!title || !showName) {
      return res.status(400).json({ 
        error: 'title and showName are required' 
      });
    }

    const script = await EpisodeScript.create({
      title,
      showName,
      episodeNumber,
      season,
      description,
      scriptText: scriptText || '',
      lines: [],
      status: 'draft',
      createdBy: req.user?._id,
    });

    res.json(script);
  } catch (error) {
    console.error('Error creating episode script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update episode script
router.put('/:id', async (req, res) => {
  try {
    const { 
      title, 
      showName, 
      episodeNumber, 
      season,
      description, 
      scriptText, 
      lines, 
      status, 
      productionSegments,
      finalAudioUrl,
      totalDuration,
      metadata,
    } = req.body;
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (showName !== undefined) updateData.showName = showName;
    if (episodeNumber !== undefined) updateData.episodeNumber = episodeNumber;
    if (season !== undefined) updateData.season = season;
    if (description !== undefined) updateData.description = description;
    if (scriptText !== undefined) updateData.scriptText = scriptText;
    if (lines !== undefined) updateData.lines = lines;
    if (status !== undefined) updateData.status = status;
    if (productionSegments !== undefined) updateData.productionSegments = productionSegments;
    if (finalAudioUrl !== undefined) updateData.finalAudioUrl = finalAudioUrl;
    if (totalDuration !== undefined) updateData.totalDuration = totalDuration;
    if (metadata !== undefined) updateData.metadata = metadata;

    const script = await EpisodeScript.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!script) {
      return res.status(404).json({ error: 'Episode script not found' });
    }

    res.json(script);
  } catch (error) {
    console.error('Error updating episode script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete episode script
router.delete('/:id', async (req, res) => {
  try {
    const script = await EpisodeScript.findByIdAndDelete(req.params.id);
    
    if (!script) {
      return res.status(404).json({ error: 'Episode script not found' });
    }
    
    res.json({ message: 'Episode script deleted successfully' });
  } catch (error) {
    console.error('Error deleting episode script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Parse script text into lines
router.post('/:id/parse', async (req, res) => {
  try {
    const script = await EpisodeScript.findById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ error: 'Episode script not found' });
    }

    if (!script.scriptText || !script.scriptText.trim()) {
      return res.status(400).json({ error: 'No script text to parse' });
    }

    // Parse the script into lines
    const lines = parseScriptText(script.scriptText);
    
    script.lines = lines;
    script.status = 'parsed';
    await script.save();

    res.json(script);
  } catch (error) {
    console.error('Error parsing script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-assign voices to characters based on existing character voice profiles
router.post('/:id/auto-assign-voices', async (req, res) => {
  try {
    const script = await EpisodeScript.findById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ error: 'Episode script not found' });
    }

    // Get character voices for this show
    const characterVoices = await CharacterVoice.find({ 
      showName: script.showName,
      isActive: true,
    }).lean();

    if (characterVoices.length === 0) {
      return res.status(400).json({ 
        error: 'No character voices found for this show. Please create character voices first.' 
      });
    }

    // Create a map of character names to voices
    const voiceMap = {};
    for (const voice of characterVoices) {
      voiceMap[voice.name.toLowerCase()] = voice;
    }

    // Assign voices to dialogue lines
    let assignedCount = 0;
    script.lines = script.lines.map(line => {
      if (line.type === 'dialogue' && line.characterName) {
        const characterKey = line.characterName.toLowerCase();
        const voice = voiceMap[characterKey];
        
        if (voice) {
          assignedCount++;
          return {
            ...line,
            voiceId: voice.elevenLabsVoiceId,
            elevenLabsSettings: voice.voiceSettings,
          };
        }
      }
      return line;
    });

    if (assignedCount > 0) {
      script.status = 'voice-assigned';
    }

    await script.save();

    res.json({ 
      script,
      assignedCount,
      totalDialogueLines: script.lines.filter(l => l.type === 'dialogue').length,
    });
  } catch (error) {
    console.error('Error auto-assigning voices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate production segments for long episodes
router.post('/:id/create-segments', async (req, res) => {
  try {
    const { segmentDuration = 5 } = req.body; // Default 5 minute segments
    
    const script = await EpisodeScript.findById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ error: 'Episode script not found' });
    }

    if (script.lines.length === 0) {
      return res.status(400).json({ error: 'Script has no lines to segment' });
    }

    // Estimate duration (rough: ~2.5 words per second of speech)
    const segments = [];
    let currentSegment = {
      name: 'Segment 1',
      startLineIndex: 0,
      endLineIndex: 0,
      estimatedDuration: 0,
    };
    let segmentNumber = 1;

    for (let i = 0; i < script.lines.length; i++) {
      const line = script.lines[i];
      let lineDuration = 0;

      if (line.type === 'dialogue' && line.dialogue) {
        const wordCount = line.dialogue.split(/\s+/).length;
        lineDuration = wordCount / 2.5; // ~2.5 words per second
      } else if (line.type === 'sound-effect') {
        lineDuration = 2; // Assume 2 seconds per sound effect
      }

      currentSegment.estimatedDuration += lineDuration;
      currentSegment.endLineIndex = i;

      // If segment is long enough or this is the last line, save it
      if (currentSegment.estimatedDuration >= segmentDuration * 60 || i === script.lines.length - 1) {
        segments.push({
          name: currentSegment.name,
          startLineIndex: currentSegment.startLineIndex,
          endLineIndex: currentSegment.endLineIndex,
          audioUrl: '',
          status: 'pending',
        });

        // Start new segment if not at end
        if (i < script.lines.length - 1) {
          segmentNumber++;
          currentSegment = {
            name: `Segment ${segmentNumber}`,
            startLineIndex: i + 1,
            endLineIndex: i + 1,
            estimatedDuration: 0,
          };
        }
      }
    }

    script.productionSegments = segments;
    await script.save();

    res.json({ 
      script,
      segmentCount: segments.length,
    });
  } catch (error) {
    console.error('Error creating segments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Preview single line (placeholder - needs ElevenLabs integration)
router.post('/:id/preview-line', async (req, res) => {
  try {
    const { lineIndex } = req.body;
    
    if (lineIndex === undefined) {
      return res.status(400).json({ error: 'lineIndex is required' });
    }

    const script = await EpisodeScript.findById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ error: 'Episode script not found' });
    }

    if (lineIndex < 0 || lineIndex >= script.lines.length) {
      return res.status(400).json({ error: 'Invalid lineIndex' });
    }

    const line = script.lines[lineIndex];
    
    if (line.type !== 'dialogue') {
      return res.status(400).json({ error: 'Can only preview dialogue lines' });
    }

    if (!line.voiceId || !line.dialogue) {
      return res.status(400).json({ error: 'Line must have both voice ID and dialogue' });
    }

    // TODO: Implement ElevenLabs audio generation
    // For now, return a placeholder response
    res.status(501).json({ 
      error: 'Audio generation not yet implemented. Integration with ElevenLabs required.',
      voiceId: line.voiceId,
      dialogue: line.dialogue,
    });
  } catch (error) {
    console.error('Error previewing line:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== Helper Functions ==========

/**
 * Parse script text into structured lines
 * Supports format:
 * - CHARACTER NAME: dialogue
 * - [SFX: sound effect description]
 * - Stage directions (any other text)
 */
function parseScriptText(text) {
  const lines = [];
  const scriptLines = text.split('\n');
  
  for (const line of scriptLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect sound effects: [SFX: ...]
    const sfxMatch = trimmed.match(/^\[SFX:\s*(.+?)\]$/i);
    if (sfxMatch) {
      lines.push({
        type: 'sound-effect',
        soundEffect: sfxMatch[1].trim(),
      });
      continue;
    }

    // Detect character dialogue: CHARACTER: dialogue
    const dialogueMatch = trimmed.match(/^([A-Z][A-Za-z\s]+):\s*(.+)$/);
    if (dialogueMatch) {
      const characterName = dialogueMatch[1].trim();
      const dialogue = dialogueMatch[2].trim();
      
      // Extract emotion cues like [excited], [sad], etc.
      const emotionMatch = dialogue.match(/^\[(\w+)\]/);
      const emotion = emotionMatch ? emotionMatch[1] : '';
      const cleanDialogue = emotion ? dialogue.replace(/^\[\w+\]\s*/, '') : dialogue;
      
      lines.push({
        type: 'dialogue',
        characterName,
        dialogue: cleanDialogue,
        emotion,
      });
      continue;
    }

    // Everything else is stage direction
    lines.push({
      type: 'stage-direction',
      dialogue: trimmed,
    });
  }

  return lines;
}

module.exports = router;
