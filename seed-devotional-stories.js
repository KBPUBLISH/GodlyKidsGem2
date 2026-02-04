const mongoose = require('mongoose');
require('dotenv').config();

const DevotionalStory = require('./src/models/DevotionalStory');

const MONGO_URI = process.env.MONGO_URI;

const stories = [
  // AGE 4-6: Love
  {
    title: "The Sharing Heart",
    displayTitle: "{childName}'s Sharing Heart",
    description: "A story about sharing and showing God's love to others",
    scripture: "1 John 4:19",
    scriptureText: "We love because He first loved us.",
    content: `Once upon a time, {childName} woke up to a sunny morning. Today was a special day—{childName} had a brand new box of crayons!

{childName} sat down to color a beautiful rainbow. The red was so bright! The blue was so pretty! {childName} loved these crayons very much.

Then {childName}'s friend came over to play. The friend looked at the crayons with big, hopeful eyes. "Those are so nice," the friend said softly.

{childName} felt something warm in their heart. It was a feeling that said, "Share your crayons!"

At first, {childName} wasn't sure. These were NEW crayons! But then {childName} remembered something important—God shares His love with us every single day. The sunshine, the flowers, hugs from family—all gifts from God's loving heart.

{childName} smiled big and said, "Here! Let's color together!"

The friend's face lit up like a Christmas tree. They colored the most beautiful picture—together. And you know what? Sharing the crayons made {childName} feel even happier than keeping them alone.

That night, {childName} prayed, "Thank you, God, for teaching me to share. Help me have a sharing heart every day!"

And God smiled, because He loves it when we share His love with others.`,
    ageGroups: ['4-6'],
    goalTags: ['love'],
    estimatedDuration: 2,
    status: 'published',
    reflectionQuestions: [
      {
        question: "How did {childName} feel after sharing the crayons?",
        parentTip: "Help your child connect sharing with positive feelings. Ask about a time they shared something.",
        emoji: "❤️"
      },
      {
        question: "What's something you can share with a friend this week?",
        parentTip: "Make it practical and specific. Maybe a toy, a snack, or even a smile!",
        emoji: "🎁"
      }
    ],
    preferredVoice: 'Aoede',
    order: 1
  },

  // AGE 6-8: Courage
  {
    title: "The Brave Prayer",
    displayTitle: "{childName} and the Brave Prayer",
    description: "A story about finding courage through prayer when facing fears",
    scripture: "Joshua 1:9",
    scriptureText: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.",
    content: `{childName} stood at the edge of the swimming pool, heart pounding like a drum. Today was the day—the deep end.

"I can't do it," {childName} whispered. The water looked so deep, so blue, so scary.

Coach Sara smiled kindly. "You've practiced so much. You're ready."

But {childName}'s legs felt like jelly. What if I sink? What if I forget how to swim?

Then {childName} remembered what Grandma always said: "When you're scared, talk to God. He's always listening."

Right there by the pool, {childName} closed their eyes and prayed quietly: "God, I'm really scared. Please help me be brave. Please be with me in the water."

Something amazing happened. {childName} didn't stop feeling nervous—but something else grew stronger. A calm feeling, like a warm blanket wrapping around their heart.

{childName} took a deep breath and jumped.

SPLASH!

The water rushed around, but {childName}'s arms and legs remembered what to do. Kick, pull, kick, pull. Before long, {childName} was swimming across the deep end!

"I did it!" {childName} shouted, climbing out with the biggest grin ever.

That night, {childName} wrote in a journal: "Being brave doesn't mean not being scared. It means doing it anyway—with God's help."

And that was a lesson {childName} would never forget.`,
    ageGroups: ['6-8'],
    goalTags: ['courage'],
    estimatedDuration: 2,
    status: 'published',
    reflectionQuestions: [
      {
        question: "What helped {childName} feel brave enough to jump in the pool?",
        parentTip: "Highlight the role of prayer. Discuss how talking to God can help in scary moments.",
        emoji: "🙏"
      },
      {
        question: "What's something that feels scary to you? Can we pray about it together?",
        parentTip: "Validate their fear first, then offer to pray together. Make prayer a natural response to fear.",
        emoji: "💪"
      }
    ],
    preferredVoice: 'Kore',
    order: 2
  },

  // AGE 8-10: Self-Control
  {
    title: "The Pause That Changed Everything",
    displayTitle: "The Day {childName} Pressed Pause",
    description: "A story about self-control when anger rises",
    scripture: "Proverbs 29:11",
    scriptureText: "Fools give full vent to their rage, but the wise bring calm in the end.",
    content: `{childName} stared at the screen in disbelief. Three hours of work on the school project—gone. Little brother had "accidentally" deleted everything.

"It was an accident!" he cried, tears streaming down his face.

But {childName} didn't care. Anger exploded like a volcano. Words—mean, hurtful words—were about to erupt.

Then something strange happened. Time seemed to slow down.

{childName} remembered Sunday's lesson about King David. When David was angry at Nabal, he almost did something terrible. But Abigail helped him pause and think. David later thanked God for stopping him from making a huge mistake.

In that frozen moment, {childName} made a choice. Instead of screaming, {childName} walked to their room, closed the door, and sat on the bed.

Breathe in. Breathe out. "God, I am SO angry right now. Help me not say something I'll regret."

After five minutes, the volcano inside had cooled to a simmer. {childName} walked back out.

Little brother was still crying. "I'm really sorry..."

{childName} took another deep breath. "I know. It was an accident. I'm upset, but I forgive you. Maybe you can help me redo it?"

His face brightened. "Really? Yeah! I'll help!"

Later, Dad put his hand on {childName}'s shoulder. "I saw what you did. That took real strength. I'm proud of you."

{childName} smiled. Self-control didn't feel like weakness. It felt like a superpower.`,
    ageGroups: ['8-10'],
    goalTags: ['self-control'],
    estimatedDuration: 2,
    status: 'published',
    reflectionQuestions: [
      {
        question: "What did {childName} do instead of yelling? Why was that wise?",
        parentTip: "Discuss the 'pause' strategy. Taking space isn't running away—it's gaining control.",
        emoji: "⏸️"
      },
      {
        question: "Think of a time you got really angry. What could 'pressing pause' look like for you?",
        parentTip: "Help them create a personal strategy: walk away, count to 10, or pray silently.",
        emoji: "🧠"
      }
    ],
    preferredVoice: 'Kore',
    order: 3
  },

  // AGE 10-12: Faith
  {
    title: "When Prayers Feel Empty",
    displayTitle: "{childName} and the Silent Sky",
    description: "A story about trusting God when prayers seem unanswered",
    scripture: "Hebrews 11:1",
    scriptureText: "Now faith is confidence in what we hope for and assurance about what we do not see.",
    content: `{childName} had been praying for weeks. Every night, same prayer: "Please let Grandpa get better."

But Grandpa wasn't getting better. The hospital visits continued. The worried looks on Mom and Dad's faces didn't fade.

One night, {childName} sat by the window, staring at the stars. "God, are you even there? Why aren't you answering?"

The sky was silent. No booming voice. No sign. Just stars, twinkling like they did every night.

{childName} felt something breaking inside. Maybe prayer doesn't work. Maybe God doesn't care.

The next day, Pastor Miguel visited. He sat next to {childName} on the porch.

"I heard you've been praying hard for your grandpa," he said gently.

{childName} nodded, eyes stinging. "But nothing's changing."

Pastor Miguel was quiet for a moment. "Can I tell you something I've learned? Faith isn't a vending machine—put in a prayer, get what you want. Faith is trust. Trust that God sees the whole picture when we only see a tiny piece."

"But what if..." {childName} couldn't finish.

"What if the answer isn't what we want?" Pastor Miguel nodded. "That's the hardest part. But here's what I know: God promises to be WITH us. Every step. Every tear. That's a promise He always keeps."

That night, {childName} prayed differently: "God, I don't understand. But I'm choosing to trust You. Please be with Grandpa. And be with me too."

The sky was still silent. But somehow, {childName} didn't feel so alone anymore.`,
    ageGroups: ['10-12'],
    goalTags: ['faith'],
    estimatedDuration: 2,
    status: 'published',
    reflectionQuestions: [
      {
        question: "What did Pastor Miguel mean when he said faith isn't a 'vending machine'?",
        parentTip: "This is a mature concept. Discuss how faith means trusting God's character even when we don't understand His plan.",
        emoji: "🤔"
      },
      {
        question: "Have you ever felt like God wasn't answering a prayer? How did that feel?",
        parentTip: "Create safe space for doubt. It's okay not to have answers. Emphasize that God welcomes our honest questions.",
        emoji: "💭"
      }
    ],
    preferredVoice: 'Kore',
    order: 4
  }
];

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!\n');

    for (const story of stories) {
      console.log(`Creating: "${story.title}" (${story.ageGroups[0]}, ${story.goalTags[0]})`);
      const doc = new DevotionalStory(story);
      await doc.save();
      console.log(`  ✅ Created with ID: ${doc._id}\n`);
    }

    console.log('🎉 All stories created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

seed();
