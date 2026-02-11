/**
 * Seed 12 Bible characters and 12 monthly book templates for development.
 * Run: node seed-monthly-book.js (from backend dir, with MONGO_URI set)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SavedCharacter = require('./src/models/SavedCharacter');
const MonthlyBookTemplate = require('./src/models/MonthlyBookTemplate');

const BIBLE_CHARACTERS = [
  { internalTag: 'bible_noah', displayName: 'Noah', scriptureReference: 'Genesis 6-9', stylePrompt: 'Noah, biblical patriarch, bearded man in ancient robe, building the ark, animals nearby, storybook illustration style' },
  { internalTag: 'bible_david', displayName: 'David', scriptureReference: '1 Samuel 17', stylePrompt: 'Young David, shepherd boy with sling and stones, biblical Israel attire, courageous expression, storybook illustration style' },
  { internalTag: 'bible_moses', displayName: 'Moses', scriptureReference: 'Exodus 3-14', stylePrompt: 'Moses, wise leader with staff, parting the Red Sea, biblical desert setting, storybook illustration style' },
  { internalTag: 'bible_daniel', displayName: 'Daniel', scriptureReference: 'Daniel 6', stylePrompt: 'Daniel in the lions den, faithful young man, ancient Babylon, storybook illustration style' },
  { internalTag: 'bible_esther', displayName: 'Esther', scriptureReference: 'Esther 1-7', stylePrompt: 'Queen Esther, brave and kind, royal attire, Persian palace, storybook illustration style' },
  { internalTag: 'bible_joseph', displayName: 'Joseph', scriptureReference: 'Genesis 37-50', stylePrompt: 'Joseph with coat of many colors, dreamer, ancient Egypt, storybook illustration style' },
  { internalTag: 'bible_ruth', displayName: 'Ruth', scriptureReference: 'Ruth 1-4', stylePrompt: 'Ruth, loyal and kind, gleaning in the field, biblical countryside, storybook illustration style' },
  { internalTag: 'bible_samuel', displayName: 'Samuel', scriptureReference: '1 Samuel 3', stylePrompt: 'Young Samuel listening to God, temple at night, storybook illustration style' },
  { internalTag: 'bible_elijah', displayName: 'Elijah', scriptureReference: '1 Kings 18', stylePrompt: 'Elijah the prophet, Mount Carmel, fire from heaven, storybook illustration style' },
  { internalTag: 'bible_jonah', displayName: 'Jonah', scriptureReference: 'Jonah 1-3', stylePrompt: 'Jonah and the great fish, ocean and ship, storybook illustration style' },
  { internalTag: 'bible_jesus_birth', displayName: 'Jesus', scriptureReference: 'Luke 2', stylePrompt: 'Jesus as a child, Bethlehem stable, gentle and kind, storybook illustration style' },
  { internalTag: 'bible_jesus_shepherds', displayName: 'Jesus', scriptureReference: 'Luke 2', stylePrompt: 'Jesus with the shepherds, nativity scene, storybook illustration style' },
];

const STORY_TITLES = [
  'Journey with Noah',
  'Help David Face the Giant',
  'Adventure with Moses',
  'Stand Brave with Daniel',
  'Be Brave with Esther',
  'Dream with Joseph',
  'Walk with Ruth',
  'Listen with Samuel',
  'Trust with Elijah',
  'Sail with Jonah',
  'Meet Baby Jesus',
  'Visit Jesus with the Shepherds',
];

async function seed() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGO_URI or MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const existing = await SavedCharacter.countDocuments();
  if (existing > 0) {
    console.log('SavedCharacter already has documents. Skipping character seed.');
  } else {
    for (let i = 0; i < BIBLE_CHARACTERS.length; i++) {
      await SavedCharacter.create({ ...BIBLE_CHARACTERS[i], order: i + 1, status: 'active' });
    }
    console.log('Created', BIBLE_CHARACTERS.length, 'saved characters');
  }

  const chars = await SavedCharacter.find().sort({ order: 1 }).lean();
  if (chars.length === 0) {
    console.error('No saved characters. Run seed again or create in portal.');
    process.exit(1);
  }

  const existingTemplates = await MonthlyBookTemplate.countDocuments();
  if (existingTemplates > 0) {
    console.log('MonthlyBookTemplate already has documents. Skipping template seed.');
  } else {
    for (let i = 0; i < chars.length; i++) {
      const title = STORY_TITLES[i] || `Adventure with ${chars[i].displayName}`;
      const storyPages = [];
      for (let p = 1; p <= 6; p++) {
        storyPages.push({
          pageNumber: p,
          text: `Page ${p}: {childName} and ${chars[i].displayName} went on an amazing adventure. This is a placeholder for the real story.`,
          sceneDescription: `${chars[i].displayName} and the child in a biblical scene, page ${p}`,
        });
      }
      await MonthlyBookTemplate.create({
        title,
        description: `A custom story where your child joins ${chars[i].displayName}.`,
        bibleCharacterId: chars[i]._id,
        storyPages,
        order: i + 1,
        status: 'published',
      });
    }
    console.log('Created', chars.length, 'monthly book templates');
  }

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
