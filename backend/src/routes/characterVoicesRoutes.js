const express = require('express');
const router = express.Router();
const CharacterVoice = require('../models/CharacterVoice');
const { authenticateAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateAdmin);

// List all character voices
router.get('/', async (req, res) => {
  try {
    const { showName, isActive } = req.query;
    
    const query = {};
    if (showName) query.showName = showName;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const voices = await CharacterVoice.find(query)
      .sort({ showName: 1, name: 1 })
      .lean();
      
    res.json(voices);
  } catch (error) {
    console.error('Error fetching character voices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single character voice
router.get('/:id', async (req, res) => {
  try {
    const voice = await CharacterVoice.findById(req.params.id).lean();
    
    if (!voice) {
      return res.status(404).json({ error: 'Character voice not found' });
    }
    
    res.json(voice);
  } catch (error) {
    console.error('Error fetching character voice:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create character voice
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      showName, 
      description, 
      elevenLabsVoiceId, 
      voiceSettings,
      characterInfo,
    } = req.body;
    
    if (!name || !showName || !elevenLabsVoiceId) {
      return res.status(400).json({ 
        error: 'name, showName, and elevenLabsVoiceId are required' 
      });
    }

    // Check for duplicate
    const existing = await CharacterVoice.findOne({ 
      name: name, 
      showName: showName 
    });
    
    if (existing) {
      return res.status(400).json({ 
        error: `Character voice "${name}" already exists for show "${showName}"` 
      });
    }

    const voice = await CharacterVoice.create({
      name,
      showName,
      description: description || '',
      elevenLabsVoiceId,
      voiceSettings: voiceSettings || {},
      characterInfo: characterInfo || {},
      createdBy: req.user?._id,
    });

    res.json(voice);
  } catch (error) {
    console.error('Error creating character voice:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'A character voice with this name already exists for this show' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Update character voice
router.put('/:id', async (req, res) => {
  try {
    const { 
      name, 
      showName, 
      description, 
      elevenLabsVoiceId, 
      voiceSettings,
      characterInfo,
      previewAudioUrl,
      isActive,
    } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (showName !== undefined) updateData.showName = showName;
    if (description !== undefined) updateData.description = description;
    if (elevenLabsVoiceId !== undefined) updateData.elevenLabsVoiceId = elevenLabsVoiceId;
    if (voiceSettings !== undefined) updateData.voiceSettings = voiceSettings;
    if (characterInfo !== undefined) updateData.characterInfo = characterInfo;
    if (previewAudioUrl !== undefined) updateData.previewAudioUrl = previewAudioUrl;
    if (isActive !== undefined) updateData.isActive = isActive;

    const voice = await CharacterVoice.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!voice) {
      return res.status(404).json({ error: 'Character voice not found' });
    }

    res.json(voice);
  } catch (error) {
    console.error('Error updating character voice:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'A character voice with this name already exists for this show' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Delete character voice
router.delete('/:id', async (req, res) => {
  try {
    const voice = await CharacterVoice.findByIdAndDelete(req.params.id);
    
    if (!voice) {
      return res.status(404).json({ error: 'Character voice not found' });
    }
    
    res.json({ message: 'Character voice deleted successfully' });
  } catch (error) {
    console.error('Error deleting character voice:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk import character voices
router.post('/bulk-import', async (req, res) => {
  try {
    const { voices } = req.body;
    
    if (!Array.isArray(voices) || voices.length === 0) {
      return res.status(400).json({ error: 'voices array is required' });
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (const voiceData of voices) {
      try {
        const { name, showName, elevenLabsVoiceId } = voiceData;
        
        if (!name || !showName || !elevenLabsVoiceId) {
          results.errors.push({ 
            voice: voiceData, 
            error: 'Missing required fields' 
          });
          continue;
        }

        // Check if already exists
        const existing = await CharacterVoice.findOne({ name, showName });
        if (existing) {
          results.skipped++;
          continue;
        }

        await CharacterVoice.create({
          ...voiceData,
          createdBy: req.user?._id,
        });
        
        results.created++;
      } catch (error) {
        results.errors.push({ 
          voice: voiceData, 
          error: error.message 
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error bulk importing voices:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
