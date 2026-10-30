/**
 * Character canon — the single source of truth for the island friends.
 *
 * Everything the island (and, later, the app and the Gemini foreman) says about Eve, Abel, Noah and
 * Adam lives here: role, voice, strengths, weaknesses, tasks, daily rhythm, faith line and limits.
 * Other files should read from this one instead of restating facts. `homeworld/CHARACTERS.md` is
 * generated from this file (`npm run characters:md` in homeworld/), so edit here, not the markdown.
 *
 * Keys match the skill ids and icons in character-skills.mjs (`roleId`, `icon`) and the card shape in
 * character-profile.mjs (`strengths`, `weaknesses`, `tasks[{icon,text,silly?}]`). Task icons are names
 * from ui.jsx ICONS. No imports on purpose: this file must be safe to load from node scripts, tests and
 * the app without pulling in three.js or the save system.
 *
 * Tone rules (ages 4–9): short warm sentences, no numbers on cards, faith lines are gentle and simple,
 * never preachy. Daily caps (trees, rocks, plots) are game rules and stay in character-skills.mjs.
 */

/** Friends with a named skill. The `generic` entry is the template for every other collected friend. */
export const CHARACTERS={
  eve:{
    name:'Eve',
    title:'Eve the Cook',
    roleId:'cook',
    roleName:'Cook',
    rankTitle:'Master Chef', // fixed rank shown on cards and the village strip (settlement.mjs learnedRole) — never re-ranked by practice
    icon:'cookedfish',
    personality:['warm','organised','cheerful','a little bossy about mealtimes'],
    voice:'Short, warm, practical sentences. Talks about food, the garden and "everyone eats together". Loud and happy when she rings the bell.',
    strengths:['Cooking','Fishing'],
    weaknesses:['Chopping wood'],
    tasks:[
      {icon:'rawfish',text:'Fishing'},
      {icon:'cookedfish',text:'Cooking'},
      {icon:'food',text:'Ringing the dinner bell (loudly)',silly:true},
    ],
    dailyRhythm:'Before every meal (8 AM, noon, 6 PM) she fishes and picks what is ripe while Noah grills the catch, then rings the Dining Hall bell so everyone eats together. Between meals she plants seeds and gathers the ones lying around.',
    relationships:'Works every meal with Noah (she catches, he grills) and covers the grill when he is away. Shares the garden with Abel and teases him about his scarecrow chats.',
    faith:'Eve loves that God made a garden full of good things to eat and share — her favourite story is the very first one, when God looked at everything He had made and said it was good.',
    limits:['Never chops wood','Never rings a stale bell: a meal missed by more than an hour is skipped','Plants only between meals, and only from seeds already in the bag'],
    leadership:2,dialogue:'gardener',bibleRef:'Genesis 2–3',storyLine:'Eve was the first woman God made, and she lived in a garden full of good things.',
    usually:'the fishing and the kitchen',
    foremanNote:'Eve is the cook: give her fishing and the kitchen (meals at 8, 12 and 6); gardening is fine between meals; never send her to chop wood.',
    bio:'Eve keeps everyone fed. She fishes and picks the garden before every meal, rings the Dining Hall bell so the whole island eats together, and plants a few seeds in between.',
  },
  abel:{
    name:'Abel',
    title:'Abel the Garden Keeper',
    roleId:'gardener',
    roleName:'Garden keeper',
    rankTitle:'Master Gardener',
    icon:'water',
    personality:['gentle','patient','quiet','watchful'],
    voice:'Soft-spoken and few words. Notices small things — a sprout, a thirsty plant, a crow on the fence — and has a gentle sense of humour.',
    strengths:['Gardening'],
    weaknesses:['Building'],
    tasks:[
      {icon:'hoe',text:'Weeding'},
      {icon:'water',text:'Watering'},
      {icon:'wheat',text:'Scarecrow conversations',silly:true},
    ],
    dailyRhythm:'In the garden all day: pulls weeds, waters, picks what is ripe and tills a new row beside the garden once the empty plots are nearly all planted. At dusk he walks to the garden and stands guard so a coyote is chased off.',
    relationships:'Shares the garden with Eve (she plants, he tends). Keeps asking Adam for fences and a scarecrow so the crows and coyotes leave the food alone.',
    faith:'Abel loves that God notices a gift given with a glad heart — and he likes any story with sheep in it, especially the shepherd who looks after every single one.',
    limits:['Never builds (he hands that to Noah and Adam)','Never fights a coyote — he just chases it off and comes back','Tills only a few new plots a day so the garden grows a row at a time'],
    leadership:1,dialogue:'gardener',bibleRef:'Genesis 4',storyLine:'Abel kept sheep and gave God his very best with a glad heart.',
    usually:'the garden',
    foremanNote:'Abel is the garden keeper: give him weeding, watering, picking and tilling, and guard duty at dusk when coyotes are about; keep him off building.',
    bio:'Abel looks after the garden from the first weed to the last ripe pumpkin. When the sun goes down he stands by the rows so nothing sneaks in to eat the crops.',
  },
  noah:{
    name:'Noah',
    title:'Noah the Woodcutter',
    roleId:'woodcutter',
    roleName:'Woodcutter',
    rankTitle:'Master Builder',
    icon:'axe',
    personality:['hearty','practical','full of ideas','steady'],
    voice:'Big, cheerful and hands-on. Thinks in plans and logs, says "let\'s build it" a lot, and always has an idea about what the island needs next.',
    strengths:['Building'],
    weaknesses:['Gardening'],
    tasks:[
      {icon:'axe',text:'Cut trees'},
      {icon:'build',text:'Building'},
      {icon:'rest',text:'Back scratches',silly:true},
    ],
    dailyRhythm:'Clears stumps wherever trees were felled and cuts trees for the build pile. About an hour before each meal he lights the campfire and grills the fish Eve catches, fetching a log first if the fire is cold. Joins any building crew that needs hands.',
    relationships:'Grills for Eve before every meal. Builds with Adam and happily argues with him about what to raise next. Will take a back scratch from anyone.',
    faith:'Noah loves that God keeps His promises — every rainbow makes him stop and smile, because it reminds him of the ark and the promise that came after the rain.',
    limits:['Never gardens','Cuts only a few trees a day and stops when the wood store is full','Leaves the grill to Eve when he is away or being played'],
    leadership:2,dialogue:'builder',bibleRef:'Genesis 6–9',storyLine:'Noah built a huge boat, kept the animals safe through the flood, and saw the first rainbow.',
    usually:'the wood and the grill',
    foremanNote:'Noah is the woodcutter and builder: give him trees, stumps, building and the campfire grill before meals; never the garden.',
    bio:'Noah cuts the wood, digs out the stumps and lights the fire that grills the catch before every meal. He always has a plan for what to build next — and why.',
  },
  adam:{
    name:'Adam',
    title:'Adam the Farmer',
    roleId:'farmer',
    roleName:'Farmer',
    rankTitle:'Master Farmer',
    icon:'fence',
    personality:['curious','kind','thankful','outdoorsy'],
    voice:'Curious and simple. Asks questions, names things (especially animals) and thanks God out loud. Warm and a little wide-eyed, like everything is new.',
    strengths:['Farming','Mining'],
    weaknesses:['Cooking'],
    tasks:[
      {icon:'hoe',text:'Plowing'},
      {icon:'mine',text:'Breaking rock'},
      {icon:'walk',text:'Naming the chickens',silly:true},
    ],
    dailyRhythm:'Cuts trees and breaks stone for the build pile, knows which animals to bring home, and keeps talking about a fenced farm and a stable so the coyotes stay out.',
    relationships:'Builds with Noah and brings home the animals that Abel then has to keep out of the garden. Eve sends him to wash before dinner.',
    faith:'Adam loves that God made everything and called it good — his favourite moment is being asked to name the animals, which is why every chicken on the island has one.',
    limits:['Never cooks','Breaks only a few rocks and cuts only a few trees a day','Leaves rocks alone that need better tools than the island has'],
    leadership:2,dialogue:'gardener',bibleRef:'Genesis 1–2',storyLine:'Adam was the first man God made, and he gave every animal its name.',
    usually:'the farm and the stone',
    foremanNote:'Adam is the farmer and miner: give him plowing, stone, trees for the build pile and anything to do with animals or fences; never the kitchen.',
    bio:'Adam breaks stone and cuts trees for whatever the island builds next, and he knows which animals belong on a farm. He wants a fence and a stable so the coyotes keep their distance.',
  },
  /** Template for a collected friend without a named skill. `name` is filled in by characterFor(). */
  generic:{
    name:'Friend',
    title:'A helpful friend',
    roleId:null,
    roleName:'Helper',
    icon:'walk',
    personality:['friendly','willing','curious','kind'],
    voice:'Simple, cheerful and encouraging. Happy to pitch in wherever the foreman points.',
    strengths:['Helping out'],
    weaknesses:[],
    tasks:[
      {icon:'walk',text:'Pitching in'},
      {icon:'wood',text:'Carrying things'},
      {icon:'energy',text:'High-fives',silly:true},
    ],
    dailyRhythm:'Picks up whatever the island is calling for — a thirsty plant, a low campfire, wood or stone the next building needs, fish for the table — and grows into the role they practise most.',
    relationships:'Gets along with everyone and learns from whoever they work beside.',
    faith:'Thankful that God gives everyone a different gift to share, and glad to have a place at the table.',
    limits:['Only takes jobs the island has tools for','Gathers a little for the village each day, never stripping the island bare'],
    leadership:1,dialogue:null,bibleRef:'',storyLine:'',
    usually:'whatever needs doing',
    foremanNote:'A general helper with no fixed trade: give them whatever the village is short of today; they grow into what they practise most.',
    bio:'A friend from the stories who came to live on the island. No fixed trade yet — they help wherever they are needed and slowly become whatever they practise most.',
  },
};

/**
 * Roles a friend can carry. The first four are the base islanders' skills (character-skills.mjs);
 * the rest were added for Bible friends and are mapped onto EXISTING autopilot chores (residents.js
 * `pickSkillChores` kinds), so a new role never needs new game code. `area` is the 1–2 word skill area
 * shown on cards; `icon` must exist in ui.jsx ICONS.
 */
export const ROLES={
  cook:{name:'Cook',icon:'cookedfish',area:'Cooking',chores:['plant','pickup'],usually:'the kitchen',rhythm:'Fishes and picks before meals, helps in the kitchen and plants seeds in between.'},
  gardener:{name:'Garden keeper',icon:'water',area:'Gardening',chores:['guard','weeds','harvest','plow'],usually:'the garden',rhythm:'Weeds, waters, picks and tills in the garden, and stands guard at dusk.'},
  woodcutter:{name:'Woodcutter',icon:'axe',area:'Chopping wood',chores:['stump','chop'],usually:'the wood',rhythm:'Cuts trees and clears stumps for the build pile.'},
  farmer:{name:'Farmer',icon:'fence',area:'Farming',chores:['chop','mine'],usually:'the farm and the stone',rhythm:'Cuts trees and breaks stone for the build pile and looks after the farm.'},
  shepherd:{name:'Shepherd',icon:'walk',area:'Animals',chores:['guard','harvest'],usually:'the animals and the night watch',rhythm:'Looks after the animals, picks what is ripe and stands guard at dusk so the coyotes stay away.'},
  builder:{name:'Builder',icon:'build',area:'Building',chores:['chop','stump'],usually:'the building site',rhythm:'Joins every build crew and cuts the wood the next building needs.'},
  fisher:{name:'Fisher',icon:'fish',area:'Fishing',chores:['fish'],usually:'the fishing spot',rhythm:'Fishes for the table and hauls the catch to the shelf.'},
  teacher:{name:'Teacher',icon:'book',area:'Teaching',chores:['pickup'],usually:'the new friends and the campfire stories',rhythm:'Walks between the workers, teaches new friends and tells stories at the campfire; gathers seeds on the way.'},
  leader:{name:'Leader',icon:'map',area:'Leading',chores:['chop','mine'],usually:'the morning meeting and the build site',rhythm:'Runs the morning meeting, keeps an eye on the build site and pitches in with wood and stone.'},
  healer:{name:'Helper',icon:'energy',area:'Helping',chores:['harvest','pickup'],usually:'whoever is tired or new',rhythm:'Looks after tired and hungry friends, picks food and gathers what is lying around.'},
};
export const ROLE_IDS=Object.keys(ROLES);
/** Skill-area words allowed in strengths / weaknesses (the user-approved 1–2 word shape). */
export const SKILL_AREAS=['Cooking','Fishing','Chopping wood','Mining','Gardening','Farming','Building','Animals','Teaching','Leading','Helping'];

/** Bible friend entry. Missing fields are filled from the role so each entry stays short. */
function B(key,o){
  const role=ROLES[o.roleId];
  const name=o.name||key[0].toUpperCase()+key.slice(1);
  return {
    name,title:o.title||`${name} the ${role.name}`,roleId:o.roleId,roleName:role.name,icon:role.icon,
    personality:o.personality,traits:o.traits||o.personality,voice:o.voice,
    strengths:o.strengths,weaknesses:o.weaknesses,tasks:o.tasks,
    dailyRhythm:o.dailyRhythm||role.rhythm,relationships:o.relationships||'Gets along with everyone and learns from whoever they work beside.',
    faith:o.faith,limits:o.limits||[`Never ${(o.weaknesses[0]||'the hard jobs').toLowerCase()} — that goes to a friend who is good at it`],
    usually:o.usually||role.usually,foremanNote:o.foremanNote||`${name} is a ${role.name.toLowerCase()}: give them ${role.usually}; keep them off ${(o.weaknesses[0]||'nothing').toLowerCase()}.`,
    bio:o.bio||`${o.storyLine} On the island ${name} is our ${role.name.toLowerCase()}.`,
    leadership:o.leadership??1,dialogue:o.dialogue||'encourager',lines:o.lines||[],bibleRef:o.bibleRef,storyLine:o.storyLine,
  };
}
const T=(icon,text,silly)=>silly?{icon,text,silly:true}:{icon,text};

/**
 * Bible friends who can arrive from the reward pool (names checked against the live CMS reward pool and
 * saved-character library: Abraham, Isaac, Jacob, Sarah, Rachel, Joseph, Cain, Esau, Shem, Ham, Japheth,
 * Laban, Nimrod, Goliath, Saul, David, Mary, Jesus) plus the friends most likely to come next.
 * Profiles are derived from who they are in the Bible; `leadership` 0–5 decides who runs the morning meeting.
 */
export const BIBLE_CHARACTERS={
  moses:B('moses',{roleId:'leader',leadership:5,bibleRef:'Exodus 3; 14',storyLine:'God asked Moses to lead His people out of Egypt, and the sea opened to let them walk through.',
    personality:['brave','humble','patient','a little shy about speaking'],voice:'Slow, steady and kind. Starts with "God will help us" and gives the plan one step at a time.',
    strengths:['Leading','Teaching'],weaknesses:['Fishing'],tasks:[T('map','Leading the morning meeting'),T('stone','Carrying stone'),T('water_drop','Parting the bathwater',true)],
    faith:'Moses loves that God spoke to him from a bush that did not burn up — and that God went ahead of His people as a cloud by day and a fire by night.',
    lines:['God goes ahead of us, one step at a time.','I was scared to speak once. God helped me anyway.'],dialogue:'encourager'}),
  joseph:B('joseph',{roleId:'leader',leadership:5,bibleRef:'Genesis 37–45',storyLine:'Joseph was sold by his brothers, but God was with him, and one day he saved them all by storing food for the hungry years.',
    personality:['forgiving','organised','dreamy','wise'],voice:'Calm and sure, counts things out loud and likes a good plan. Talks about dreams and about forgiving.',
    strengths:['Leading','Farming'],weaknesses:['Chopping wood'],tasks:[T('wheat','Planning the food store'),T('harvest','Counting the harvest'),T('moon','Explaining everyone\'s dreams at breakfast',true)],
    faith:'Joseph loves that God was with him in the pit, in the prison and in the palace — and that what others meant for harm, God turned into good.',
    lines:['Store a little today, and tomorrow is taken care of.','I forgave my brothers. It felt like sunshine.'],dialogue:'encourager'}),
  david:B('david',{roleId:'shepherd',leadership:4,bibleRef:'1 Samuel 16–17; Psalm 23',storyLine:'David was the youngest shepherd boy, but he trusted God and faced a giant with a sling.',
    personality:['brave','musical','warm','quick'],voice:'Bright and tuneful, hums while he works, says "the Lord is my shepherd" and means it.',
    strengths:['Animals','Leading'],weaknesses:['Cooking'],tasks:[T('walk','Watching the sheep'),T('moon','Guarding at dusk'),T('rest','Harp concerts for the chickens',true)],
    faith:'David loves that God looks at the heart, not at how big you are — and he sings Psalm 23 to the sheep: the Lord is my shepherd, I have everything I need.',
    lines:['The Lord is my shepherd. The sheep think I am theirs.','Even a small stone can do a big job when God is in it.'],dialogue:'playful'}),
  daniel:B('daniel',{roleId:'teacher',leadership:3,bibleRef:'Daniel 1; 6',storyLine:'Daniel kept praying to God even when it was not allowed, and God shut the lions\' mouths.',
    personality:['faithful','calm','clever','steady'],voice:'Quiet and thoughtful. Prays before he answers, likes vegetables and water, and is never in a hurry.',
    strengths:['Teaching','Gardening'],weaknesses:['Chopping wood'],tasks:[T('book','Reading at the campfire'),T('water','Watering the vegetables'),T('walk','Making friends with every animal, even the big ones',true)],
    faith:'Daniel loves that God heard him three times a day with the window open — and that God was right there in the lions\' den.',
    lines:['I pray three times a day. The window is open.','Vegetables and water. Try it for ten days.'],dialogue:'encourager'}),
  esther:B('esther',{roleId:'leader',leadership:4,bibleRef:'Esther 4',storyLine:'Queen Esther was brave and spoke up for her people, because God had put her in the right place at the right time.',
    personality:['brave','gracious','careful','kind'],voice:'Gentle but firm. Plans a feast before she asks for a favour, and says "for such a time as this".',
    strengths:['Leading','Cooking'],weaknesses:['Mining'],tasks:[T('food','Planning the feast'),T('map','Speaking up for friends'),T('sun','Wearing a crown to breakfast',true)],
    faith:'Esther loves that God put her exactly where she could help — for such a time as this — and that her people prayed with her first.',
    lines:['Let\'s plan a feast, then we will talk.','Maybe you are here for such a time as this.'],dialogue:'encourager'}),
  ruth:B('ruth',{roleId:'farmer',leadership:2,bibleRef:'Ruth 1–2',storyLine:'Ruth stayed with Naomi and picked up leftover grain in the fields, and God gave her a new family.',
    personality:['loyal','hard-working','humble','warm'],voice:'Soft and loyal. Says "where you go, I will go" and keeps working until the basket is full.',
    strengths:['Farming','Helping'],weaknesses:['Fishing'],tasks:[T('wheat','Gleaning the wheat'),T('harvest','Picking ripe crops'),T('walk','Following Naomi everywhere, even to the well',true)],
    faith:'Ruth loves that God welcomed her into His family when she chose to stay — and that He noticed a stranger picking up leftover grain.',
    lines:['Where you go, I will go.','There is always a little grain left for someone who needs it.'],dialogue:'gardener'}),
  mary:B('mary',{roleId:'healer',leadership:3,bibleRef:'Luke 1–2',storyLine:'Mary said yes to God and became the mother of Jesus, and she kept all the wonderful things in her heart.',
    personality:['gentle','thoughtful','brave','caring'],voice:'Quiet and warm. Hums while she works and keeps the best moments "in her heart".',
    strengths:['Helping','Cooking'],weaknesses:['Mining'],tasks:[T('energy','Caring for tired friends'),T('cookedfish','Cooking'),T('rest','Humming lullabies while she works',true)],
    faith:'Mary loves that God chose an ordinary girl and that she could say "let it be as you have said" — and she treasures every bit of the story in her heart.',
    lines:['I am keeping that one in my heart.','Saying yes to God was the bravest thing I did.'],dialogue:'encourager'}),
  joshua:B('joshua',{roleId:'leader',leadership:4,bibleRef:'Joshua 1; 6',storyLine:'Joshua led the people into the new land, and the walls of Jericho fell down when they marched and shouted.',
    personality:['courageous','loyal','energetic','steady'],voice:'Loud and encouraging. Says "be strong and courageous" before every job, and likes marching.',
    strengths:['Leading','Building'],weaknesses:['Cooking'],tasks:[T('build','Leading the build crew'),T('map','Scouting the island'),T('sun','Trumpet practice at the fence',true)],
    faith:'Joshua loves that God told him "be strong and courageous, I am with you wherever you go" — and that walls fall when you do it God\'s way.',
    lines:['Be strong and courageous. That one is for you too.','Seven times round and a shout. Walls are not so tough.'],dialogue:'builder'}),
  deborah:B('deborah',{roleId:'leader',leadership:5,bibleRef:'Judges 4–5',storyLine:'Deborah was a wise judge who sat under a palm tree, and she led God\'s people bravely and sang about it afterwards.',
    personality:['wise','bold','fair','joyful'],voice:'Clear and decisive, settles squabbles with one sentence, then sings about the good day.',
    strengths:['Leading','Teaching'],weaknesses:['Chopping wood'],tasks:[T('book','Settling squabbles under the palm tree'),T('map','Planning the day'),T('sun','Singing victory songs very loudly',true)],
    faith:'Deborah loves that God gives wisdom to anyone who asks — and that He goes ahead of His people, so a brave woman can lead the way.',
    lines:['Come and sit under my palm tree. Tell me what happened.','The Lord goes ahead of us. Let\'s go!'],dialogue:'encourager'}),
  samuel:B('samuel',{roleId:'teacher',leadership:3,bibleRef:'1 Samuel 3',storyLine:'Samuel heard God calling his name at night, and he answered "Speak, Lord, I am listening."',
    personality:['attentive','honest','gentle','faithful'],voice:'Listens first, then speaks. Says "here I am" when anyone calls, and tells the truth kindly.',
    strengths:['Teaching','Helping'],weaknesses:['Building'],tasks:[T('book','Telling stories at the campfire'),T('energy','Listening for who needs help'),T('moon','Waking up at every noise to say "Here I am!"',true)],
    faith:'Samuel loves that God called a little boy by name in the dark — and that all he had to say was "speak, Lord, your servant is listening".',
    lines:['Here I am! Did somebody call?','Speak, Lord, I am listening. Try it tonight.'],dialogue:'encourager'}),
  elijah:B('elijah',{roleId:'builder',leadership:3,bibleRef:'1 Kings 17–19',storyLine:'Elijah was fed by ravens, prayed for fire from heaven, and heard God in a gentle whisper.',
    personality:['bold','rugged','prayerful','a little dramatic'],voice:'Booming one minute, whispering the next. Stacks stones while he prays and watches the sky for ravens.',
    strengths:['Building','Mining'],weaknesses:['Gardening'],tasks:[T('stone','Stacking stones'),T('wood','Keeping the campfire lit'),T('food','Waiting for ravens to bring lunch',true)],
    faith:'Elijah loves that God answered with fire on the mountain — and even more that God spoke to him afterwards in a gentle whisper.',
    lines:['Twelve stones, one altar, one God.','Listen. God is in the quiet whisper too.'],dialogue:'builder'}),
  jonah:B('jonah',{roleId:'fisher',leadership:1,bibleRef:'Jonah 1–4',storyLine:'Jonah ran away from God\'s job, got swallowed by a big fish, and then got a second chance.',
    personality:['grumpy','honest','funny','learning'],voice:'Mutters, then grins. Tells the big-fish story often, and it gets bigger every time.',
    strengths:['Fishing'],weaknesses:['Gardening'],tasks:[T('rawfish','Fishing'),T('bag','Mending nets'),T('fish','Telling the fish story again (it gets bigger every time)',true)],
    faith:'Jonah loves that God gave him a second chance — and that God cares about every person in every city, even the ones he did not like at first.',
    lines:['Did I tell you about the fish? It was THIS big.','God gave me a second go. He does that.'],dialogue:'playful'}),
  peter:B('peter',{roleId:'fisher',leadership:3,bibleRef:'Luke 5; Matthew 14',storyLine:'Peter was a fisherman who followed Jesus, walked on the water for a moment, and became a leader of the friends.',
    personality:['bold','loud','loyal','quick to jump'],voice:'Big voice, big heart. Jumps in first and thinks after. Says "Lord, save me!" and "let\'s go fishing" a lot.',
    strengths:['Fishing','Leading'],weaknesses:['Gardening'],tasks:[T('rawfish','Fishing'),T('bag','Hauling the catch'),T('water_drop','Jumping into the water before thinking',true)],
    faith:'Peter loves that Jesus called him off his boat to be a fisher of people — and that when he sank, Jesus grabbed his hand straight away.',
    lines:['Let\'s go fishing. Nets on the other side this time.','I sank once. Jesus caught me. Still here.'],dialogue:'playful'}),
  paul:B('paul',{roleId:'teacher',leadership:4,bibleRef:'Acts 9; 16',storyLine:'Paul met Jesus on the road, and then he travelled everywhere telling people about Him and writing them letters.',
    personality:['bold','clever','tireless','warm'],voice:'Talks fast, writes long. Explains things carefully and ends with "grace and peace".',
    strengths:['Teaching','Building'],weaknesses:['Fishing'],tasks:[T('book','Teaching new friends'),T('build','Mending tents'),T('book','Writing very long letters to everyone',true)],
    faith:'Paul loves that Jesus met him on the road when he was going the wrong way — and that nothing can separate us from God\'s love.',
    lines:['Grace and peace to you, friend.','Nothing can separate us from God\'s love. Nothing.'],dialogue:'encourager'}),
  john:B('john',{roleId:'fisher',leadership:3,bibleRef:'John 13; 21; 1 John 4',storyLine:'John was a fisherman and one of Jesus\' closest friends, and he wrote down that God is love.',
    personality:['loving','thoughtful','loyal','observant'],voice:'Gentle and sure. Says "God is love" and "little children" and notices who needs a friend.',
    strengths:['Fishing','Teaching'],weaknesses:['Mining'],tasks:[T('rawfish','Fishing'),T('book','Writing down what happened'),T('energy','Reminding everyone he is the friend Jesus loved',true)],
    faith:'John loves that God is love — and that Jesus made breakfast on the beach for His friends after the big catch of fish.',
    lines:['God is love. That is the whole thing, really.','One hundred and fifty-three fish. I counted.'],dialogue:'encourager'}),
  martha:B('martha',{roleId:'cook',leadership:2,bibleRef:'Luke 10',storyLine:'Martha loved having Jesus at her house and was busy cooking, and she learned that sitting with Him matters too.',
    personality:['busy','generous','practical','learning to rest'],voice:'Brisk and kind. Always has a cloth in one hand, and is learning to sit down and listen.',
    strengths:['Cooking','Helping'],weaknesses:['Fishing'],tasks:[T('cookedfish','Cooking'),T('food','Setting the table'),T('bag','Tidying while everyone else is still eating',true)],
    faith:'Martha loves that Jesus came to her house — and that He gently told her the best thing is to sit down and listen to Him for a while.',
    lines:['Sit down, I\'ll bring you something.','I am learning to stop and listen. It is harder than cooking.'],dialogue:'gardener'}),
  miriam:B('miriam',{roleId:'teacher',leadership:3,bibleRef:'Exodus 2; 15',storyLine:'Miriam watched over her baby brother Moses in the river, and later led everyone in singing when God rescued them.',
    personality:['watchful','joyful','musical','brave'],voice:'Sings half of what she says. Keeps an eye on the little ones and starts a song whenever something good happens.',
    strengths:['Teaching','Leading'],weaknesses:['Mining'],tasks:[T('sun','Leading the singing'),T('energy','Watching the little ones'),T('sun','Tambourine solos at breakfast',true)],
    faith:'Miriam loves that God kept a baby safe in a basket — and that when He brought everyone through the sea, the first thing to do was sing.',
    lines:['Sing to the Lord! He has done great things.','I watched a basket float for an hour once. Worth it.'],dialogue:'playful'}),
  gideon:B('gideon',{roleId:'farmer',leadership:3,bibleRef:'Judges 6–7',storyLine:'Gideon felt small, but God called him a mighty warrior, and with only 300 friends and some torches God won the day.',
    personality:['cautious','humble','brave when it counts','careful'],voice:'Asks "are you sure?" and then does it anyway. Talks about wheat, fleeces and torches.',
    strengths:['Farming','Leading'],weaknesses:['Fishing'],tasks:[T('wheat','Threshing wheat'),T('moon','Guarding at dusk'),T('sun','Asking for a sign before choosing a snack',true)],
    faith:'Gideon loves that God called him "mighty warrior" while he was hiding — and that God used a small team so everyone would know it was Him.',
    lines:['God called me mighty when I was hiding. Imagine that.','Small team, big God. Works every time.'],dialogue:'encourager'}),
  solomon:B('solomon',{roleId:'builder',leadership:4,bibleRef:'1 Kings 3; 6',storyLine:'King Solomon asked God for wisdom instead of riches, and he built a beautiful temple for God.',
    personality:['wise','curious','grand','thoughtful'],voice:'Says wise little sayings about ants and friends, and plans buildings with lots of gold.',
    strengths:['Building','Teaching'],weaknesses:['Fishing'],tasks:[T('build','Planning the big buildings'),T('book','Settling arguments wisely'),T('plant','Collecting proverbs about ants',true)],
    faith:'Solomon loves that God asked him "what do you want?" and said yes when he chose wisdom — and he built God a house with everything he had.',
    lines:['Go and watch the ants. They do not need a foreman.','Ask God for wisdom. He gives it away for free.'],dialogue:'builder'}),
  nehemiah:B('nehemiah',{roleId:'builder',leadership:4,bibleRef:'Nehemiah 2; 6',storyLine:'Nehemiah prayed, then rebuilt the broken city wall with everyone helping, and it was finished in 52 days.',
    personality:['organised','prayerful','determined','encouraging'],voice:'Prays quickly, then hands out jobs. Says "let\'s rebuild" and checks the wall at night.',
    strengths:['Building','Leading'],weaknesses:['Fishing'],tasks:[T('build','Rebuilding walls and fences'),T('map','Organising the crew'),T('moon','Checking the fence at midnight',true)],
    faith:'Nehemiah loves that God put the plan in his heart and then everyone built their own bit of the wall — prayer first, then hard work together.',
    lines:['Everyone takes the bit of wall in front of their house.','I prayed first. Then I picked up a stone.'],dialogue:'builder'}),
  caleb:B('caleb',{roleId:'farmer',leadership:3,bibleRef:'Numbers 13–14',storyLine:'Caleb explored the new land, carried back giant grapes, and trusted God when everyone else was scared.',
    personality:['wholehearted','bold','cheerful','strong'],voice:'Says "we can do it" and means it. Talks about hills, grapes and following God all the way.',
    strengths:['Farming','Leading'],weaknesses:['Cooking'],tasks:[T('map','Scouting new ground'),T('hoe','Plowing'),T('harvest','Carrying giant grapes',true)],
    faith:'Caleb loves that God kept His promise for forty-five years — he followed God with his whole heart and still got his hill.',
    lines:['We can do it! God said so.','Give me the hill. I am not too old.'],dialogue:'builder'}),
  hannah:B('hannah',{roleId:'healer',leadership:2,bibleRef:'1 Samuel 1–2',storyLine:'Hannah prayed quietly for a baby, God heard her, and she thanked Him by giving Samuel back to serve Him.',
    personality:['prayerful','tender','patient','thankful'],voice:'Soft and heartfelt. Prays so quietly her lips move, and thanks God for every little thing.',
    strengths:['Helping','Gardening'],weaknesses:['Chopping wood'],tasks:[T('energy','Caring for the little ones'),T('water','Watering'),T('pray','Praying so quietly people think she is asleep',true)],
    faith:'Hannah loves that God heard a quiet prayer nobody else could hear — and that she could give her best gift right back to Him.',
    lines:['God hears the quiet prayers too.','I asked, He answered, I said thank you. That is the whole story.'],dialogue:'encourager'}),
  lydia:B('lydia',{roleId:'healer',leadership:2,bibleRef:'Acts 16',storyLine:'Lydia sold purple cloth, listened to Paul by the river, and opened her home to the new friends.',
    personality:['hospitable','business-like','warm','generous'],voice:'Welcomes everyone in before they finish knocking. Talks about purple, rivers and open doors.',
    strengths:['Helping','Cooking'],weaknesses:['Mining'],tasks:[T('energy','Welcoming new friends'),T('cookedfish','Cooking'),T('bag','Dyeing everything purple',true)],
    faith:'Lydia loves that God opened her heart by the river while she listened — so now she opens her door to everyone.',
    lines:['Come in, come in. There is room.','God opened my heart. The door was easy after that.'],dialogue:'encourager'}),
  timothy:B('timothy',{roleId:'teacher',leadership:2,bibleRef:'2 Timothy 1; 3',storyLine:'Timothy learned the Bible from his mum and grandma, and Paul taught him to be a brave young leader.',
    personality:['young','eager','faithful','a little nervous'],voice:'Keen and polite. Quotes his grandma, asks Paul lots of questions and tries very hard.',
    strengths:['Teaching','Helping'],weaknesses:['Chopping wood'],tasks:[T('book','Learning from Paul'),T('book','Reading at the campfire'),T('book','Writing back to Paul\'s long letters',true)],
    faith:'Timothy loves that God gives a spirit of courage and love — and that his grandma Lois taught him the stories before he could read.',
    lines:['My grandma taught me this one.','Nobody is too young to help. Paul said so.'],dialogue:'encourager'}),
  zacchaeus:B('zacchaeus',{roleId:'healer',leadership:1,bibleRef:'Luke 19',storyLine:'Zacchaeus was short, so he climbed a tree to see Jesus, and Jesus came to his house and changed his heart.',
    personality:['small','curious','generous now','cheerful'],voice:'Chirpy and quick. Climbs things to see better and gives away more than he has to.',
    strengths:['Helping','Gardening'],weaknesses:['Building'],tasks:[T('apple_seed','Picking apples from the tree'),T('food','Sharing out the food fairly'),T('walk','Climbing trees to see who is coming',true)],
    faith:'Zacchaeus loves that Jesus looked up into the tree and knew his name — and wanted to come to his house, of all houses.',
    lines:['I can see everything from up here!','He knew my name. He came to my house. I gave half of everything away.'],dialogue:'playful'}),
  samaritan:B('samaritan',{name:'The Good Samaritan',title:'The Good Samaritan, our Helper',roleId:'healer',leadership:2,bibleRef:'Luke 10',storyLine:'A traveller stopped to help a hurt stranger when nobody else would — Jesus said, go and be a neighbour like that.',
    personality:['kind','practical','humble','patient'],voice:'Few words, quick hands. Asks "are you hurt?" and already has a bandage out.',
    strengths:['Helping'],weaknesses:['Fishing'],tasks:[T('energy','Caring for hurt friends'),T('wood','Carrying things'),T('walk','Stopping for every bug that needs help',true)],
    faith:'He loves that Jesus told his story to show what a neighbour is — anyone who stops to help.',
    lines:['Are you hurt? Sit down, I have a bandage.','A neighbour is anyone who stops.'],dialogue:'encourager'}),
  // ---- Names already in the CMS saved-character library / reward pool ----
  abraham:B('abraham',{roleId:'shepherd',leadership:4,bibleRef:'Genesis 12; 15',storyLine:'God told Abraham to pack up and go, and promised him more family than there are stars.',
    personality:['old','wise','a great storyteller','dry humour'],voice:'Tells long stories with a twinkle. Counts stars, welcomes visitors and says "God said go, so we went".',
    strengths:['Animals','Leading'],weaknesses:['Building'],tasks:[T('walk','Watching the flocks'),T('food','Welcoming visitors'),T('moon','Counting the stars every night',true)],
    faith:'Abraham loves that God promised him a family as many as the stars when he was old and had none — and he believed Him.',
    lines:['Try counting the stars. Go on. That is how big the promise was.','God said go. So we went. Good story, that one.'],dialogue:'encourager',limits:['Never builds anything bigger than a tent','Never turns a visitor away']}),
  sarah:B('sarah',{roleId:'cook',leadership:2,bibleRef:'Genesis 18; 21',storyLine:'Sarah laughed when she heard she would have a baby when she was old — and then God gave her Isaac, whose name means "he laughs".',
    personality:['hospitable','quick to laugh','strong','motherly'],voice:'Warm and a bit teasing. Bakes for visitors and laughs easily, especially at good news.',
    strengths:['Cooking','Helping'],weaknesses:['Chopping wood'],tasks:[T('bread','Baking bread for visitors'),T('food','Setting the table'),T('sun','Laughing at good news',true)],
    faith:'Sarah loves that God kept His promise even after she laughed — and that He let her name the laugh Isaac.',
    lines:['Three visitors, one baby promise. I laughed. God did it anyway.','Fresh bread for whoever walks in.'],dialogue:'gardener'}),
  isaac:B('isaac',{roleId:'shepherd',leadership:2,bibleRef:'Genesis 22; 26',storyLine:'Isaac was the promised boy who loved God; later he dug wells and his fields grew a hundred times over.',
    personality:['silly','sunny','gentle','loves God'],voice:'A kid at heart: giggles, asks questions, says "God will provide" because his dad taught him.',
    strengths:['Animals','Farming'],weaknesses:['Cooking'],tasks:[T('walk','Watching the lambs'),T('shovel','Digging wells'),T('sun','Giggling at his own name',true)],
    faith:'Isaac loves that God provided a ram on the mountain — "God will provide" is his favourite thing to say.',
    lines:['My name means "he laughs". So I do.','God will provide. Dad said so, and he was right.'],dialogue:'playful'}),
  jacob:B('jacob',{roleId:'shepherd',leadership:3,bibleRef:'Genesis 28–33',storyLine:'Jacob dreamt of a ladder to heaven, worked years for his sheep, and made peace with his brother Esau.',
    personality:['clever','determined','a dreamer','learning honesty'],voice:'Quick and clever, talks about sheep, ladders and long walks, and says "God was in this place".',
    strengths:['Animals','Farming'],weaknesses:['Fishing'],tasks:[T('walk','Watching the sheep'),T('build','Building the pens'),T('rest','Resting his head on rocks',true)],
    faith:'Jacob loves that God promised "I am with you wherever you go" at the bottom of a ladder of angels — and kept it, all the way home.',
    lines:['God was in this place and I did not know it.','Rocks make fine pillows if you have the right dream.'],dialogue:'gardener'}),
  rachel:B('rachel',{roleId:'shepherd',leadership:2,bibleRef:'Genesis 29–30',storyLine:'Rachel was a shepherdess who met Jacob at the well, and God remembered her.',
    personality:['caring','spirited','loving','a little impatient'],voice:'Warm and lively. Knows every sheep by name and says "God remembered me".',
    strengths:['Animals','Helping'],weaknesses:['Mining'],tasks:[T('water','Watering the flocks'),T('walk','Watching the lambs'),T('walk','Naming every sheep',true)],
    faith:'Rachel loves that God remembered her when she had waited a long time — and that He answers in His own good time.',
    lines:['That one is Fluffy. That one is also Fluffy.','God remembered me. He does not forget anyone.'],dialogue:'gardener'}),
  esau:B('esau',{roleId:'woodcutter',leadership:1,bibleRef:'Genesis 25; 33',storyLine:'Esau was a hairy outdoors hunter who loved stew — and in the end he ran to hug his brother and forgave him.',
    personality:['rugged','hungry','big-hearted','impulsive'],voice:'Loud and outdoorsy. Talks about the woods, the next meal and bear hugs.',
    strengths:['Chopping wood','Animals'],weaknesses:['Cooking'],tasks:[T('axe','Cutting trees'),T('walk','Tracking animals'),T('food','Trading anything for a bowl of stew',true)],
    faith:'Esau loves that forgiving his brother felt better than being angry — he ran to meet Jacob and hugged him.',
    lines:['Is that stew? I would trade a lot for stew.','I ran and hugged my brother. Best run of my life.'],dialogue:'playful'}),
  laban:B('laban',{roleId:'shepherd',leadership:1,bibleRef:'Genesis 29–31',storyLine:'Laban had big flocks and kept changing the deal with Jacob, and learned that God watches over fair play.',
    personality:['shrewd','busy','talkative','learning fairness'],voice:'Counts sheep out loud and likes a bargain. Learning to keep his word.',
    strengths:['Animals','Farming'],weaknesses:['Fishing'],tasks:[T('walk','Counting the flocks'),T('build','Mending the pens'),T('map','Changing the rules of every game',true)],
    faith:'Laban is learning that God sees every deal — and that a promise kept is worth more than a flock of sheep.',
    lines:['Let us count the flock again. Twice.','God watches between you and me. I am learning to like that.'],dialogue:'playful'}),
  cain:B('cain',{roleId:'farmer',leadership:1,bibleRef:'Genesis 4',storyLine:'Cain was the first farmer, and he learned the hard way that God still speaks kindly after a bad day.',
    personality:['hard-working','moody','proud','learning'],voice:'Short sentences, likes his fields. Learning to say sorry and to be glad for others.',
    strengths:['Farming'],weaknesses:['Fishing'],tasks:[T('hoe','Plowing'),T('harvest','Picking crops'),T('pumpkin','Counting his pumpkins twice',true)],
    faith:'Cain is learning that God still talks to him kindly after a bad day — and that doing what is right feels better than being cross.',
    lines:['These are my pumpkins. I counted them. Twice.','Doing right feels better. I am working on it.'],dialogue:'gardener'}),
  shem:B('shem',{roleId:'builder',leadership:2,bibleRef:'Genesis 7–9',storyLine:'Shem helped his dad Noah build the ark and look after the animals through the flood.',
    personality:['steady','responsible','kind','observant'],voice:'Calm like his dad. Talks about the ark, the animals and the rainbow.',
    strengths:['Building','Animals'],weaknesses:['Gardening'],tasks:[T('build','Building'),T('walk','Feeding the animals'),T('rest','Telling everyone which animal snored loudest',true)],
    faith:'Shem loves that God shut the door of the ark Himself — and opened the sky with a rainbow afterwards.',
    lines:['Forty days on a boat full of animals. You learn patience.','The elephant snored loudest. Ask anyone.'],dialogue:'builder'}),
  ham:B('ham',{roleId:'builder',leadership:2,bibleRef:'Genesis 7–9',storyLine:'Ham helped build the ark with his brothers and did the mucking out while it rained.',
    personality:['practical','strong','cheeky','hard-working'],voice:'Jokes while he works. Talks about hammers, hay and the smell of the ark.',
    strengths:['Building','Chopping wood'],weaknesses:['Cooking'],tasks:[T('build','Building'),T('axe','Cutting planks'),T('shovel','Mucking out the ark (again)',true)],
    faith:'Ham loves that God kept every single creature safe in the storm — even the smelly ones.',
    lines:['Somebody has to muck out. It was me. Forty days.','Hammer, plank, pray. Dad\'s recipe for a boat.'],dialogue:'builder'}),
  japheth:B('japheth',{roleId:'builder',leadership:2,bibleRef:'Genesis 7–9',storyLine:'Japheth helped build the ark and was the one watching for the dove to come back with a leaf.',
    personality:['hopeful','patient','gentle','a watcher'],voice:'Quiet and hopeful. Looks at the sky a lot and talks about the dove and the olive leaf.',
    strengths:['Building','Fishing'],weaknesses:['Mining'],tasks:[T('build','Building'),T('rawfish','Fishing off the deck'),T('sun','Watching for the dove',true)],
    faith:'Japheth loves that a little dove with a leaf was God\'s way of saying "nearly there" — hope is a small green thing.',
    lines:['The dove came back with a leaf. I cried a bit.','Keep watching the sky. Good things come back.'],dialogue:'encourager'}),
  nimrod:B('nimrod',{roleId:'builder',leadership:2,bibleRef:'Genesis 10–11',storyLine:'Nimrod was a mighty hunter and a builder of cities who learned that the best building is one God asks for.',
    personality:['strong','ambitious','bold','learning humility'],voice:'Big plans, big voice. Talks about towers and hunting, and is learning to ask God first.',
    strengths:['Building','Animals'],weaknesses:['Gardening'],tasks:[T('stone','Hauling stone'),T('walk','Tracking animals'),T('build','Building towers out of plates',true)],
    faith:'Nimrod is learning that the best building is the one God asks for — and that God likes it when we work together and understand each other.',
    lines:['Bigger! Higher! ...Actually, let me ask God first.','I can carry that stone. And that one. And that one.'],dialogue:'builder'}),
  goliath:B('goliath',{roleId:'builder',leadership:0,bibleRef:'1 Samuel 17',storyLine:'Goliath was the giant whose story reminds everyone that size is not what matters to God — a small shepherd with a big trust won the day.',
    personality:['enormous','loud','clumsy','softer than he looks'],voice:'BIG voice, simple words. Ducks under doors and is surprisingly gentle with chickens.',
    strengths:['Building','Chopping wood'],weaknesses:['Gardening'],tasks:[T('wood','Carrying the heaviest logs'),T('build','Reaching the high shelves'),T('walk','Ducking under every doorway',true)],
    faith:'Goliath\'s story reminds everyone that being the biggest is not what matters to God — a small shepherd with a big trust won the day.',
    lines:['Mind your head. No wait, that is me.','Small shepherd, big God. I learned that one the hard way.'],dialogue:'playful',limits:['Never gardens (the plants do not survive his boots)','Never carries more than two friends at once']}),
  saul:B('saul',{roleId:'leader',leadership:3,bibleRef:'1 Samuel 9–10; 15',storyLine:'Saul was the first king, tall and shy, who learned that listening to God matters more than being king.',
    personality:['tall','shy','proud','learning to listen'],voice:'Formal and a bit stiff, then warm. Hides when it is his turn to speak, and is learning to listen first.',
    strengths:['Leading','Building'],weaknesses:['Cooking'],tasks:[T('map','Organising the crew'),T('walk','Scouting'),T('bag','Hiding in the baggage when it is his turn to speak',true)],
    faith:'Saul is learning that God would rather we listen to Him than do anything grand — obeying is better than a big show.',
    lines:['I was hiding in the luggage when they made me king. True story.','Listen first. I am still learning that.'],dialogue:'encourager'}),
  jesus:B('jesus',{roleId:'teacher',leadership:5,bibleRef:'Luke 2; John 21',storyLine:'Jesus is God\'s Son, who grew up in a carpenter\'s home, told the best stories, and loves every child.',
    personality:['loving','kind','wise','welcoming'],voice:'Gentle and clear. Tells short stories that make big things simple, and always has time for the littlest friend.',
    strengths:['Teaching','Helping'],weaknesses:[],tasks:[T('book','Telling stories at the campfire'),T('build','Carpentry on the build site'),T('cookedfish','Breakfast fish on the beach for everyone',true)],
    faith:'He is the one the whole story is about — He loves every child, and nothing can change that.',
    limits:['Never turns anyone away'],foremanNote:'Jesus is the teacher: give Him the campfire stories, the new friends and the carpentry; He will also help wherever anyone is struggling.',
    lines:['Let the little children come to me.','Come and have breakfast.'],dialogue:'encourager'}),
};

/** Names that mean the same friend. */
const ALIASES={israel:'jacob',simon:'peter',good:'samaritan',yeshua:'jesus',christ:'jesus',abram:'abraham',sarai:'sarah'};
const STRIP=/^(bible|saint|st|king|queen|prophet|young|old|baby|disney|the|new|bible_character|character)$/;

/**
 * Normalise a resident name or CMS tag to a canon key: lower-cased, prefixes like "Saint", "King", "bible_"
 * and suffixes like "_3d", "_2", "the Great" removed. 'Moses the Great' → moses, 'bible_joseph_2_3d' → joseph,
 * 'Disney Jesus' → jesus, 'The Good Samaritan' → samaritan, 'Israel' → jacob.
 */
export function characterKey(name){
  let s=String(name||'').trim().toLowerCase().replace(/[’'`´]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  s=s.replace(/\s?3d$/,'').replace(/\s?\d+$/g,'').replace(/(\s\d+)+$/,'').trim();
  const words=s.split(' ').filter(Boolean);
  while(words.length>1&&STRIP.test(words[0]))words.shift();
  const first=words[0]||'';
  return ALIASES[first]||first;
}

/** Profiles added at runtime (Gemini-written, cached in localStorage by character-profile-remote.js). */
const REMOTE=new Map();
export function registerCharacter(name,entry){const key=characterKey(name);if(!key)return null;if(!entry){REMOTE.delete(key);return key;}REMOTE.set(key,entry);return key;}
export const remoteCharacters=()=>new Map(REMOTE);
/** True when the name has no static or registered profile, so a Bible/story friend would need the remote lookup. */
export function needsProfile(name){const key=characterKey(name);return !!key&&key!=='generic'&&!CHARACTERS[key]&&!BIBLE_CHARACTERS[key]&&!REMOTE.has(key);}

/** The canon entry for a friend by name or tag: base islanders → Bible friends → runtime profiles → generic template. */
export function characterFor(name){
  const key=characterKey(name);
  if(key&&key!=='generic'){
    if(CHARACTERS[key])return CHARACTERS[key];
    if(BIBLE_CHARACTERS[key])return BIBLE_CHARACTERS[key];
    if(REMOTE.has(key))return REMOTE.get(key);
  }
  const shown=String(name||'').trim()||CHARACTERS.generic.name;
  return {...CHARACTERS.generic,name:shown,title:shown===CHARACTERS.generic.name?CHARACTERS.generic.title:`${shown} the Helper`};
}
export const isGenericProfile=c=>!c?.roleId;
/** Fixed rank title for a named base friend ('Master Chef' for Eve …), or null when the friend ranks by practice. */
export const rankTitleFor=name=>characterFor(name)?.rankTitle||null;

/** 0–5: how naturally this friend runs the morning meeting. Unknown friends are 1; Adam (the default foreman) is 2. */
export function leadership(nameOrChar){
  const c=nameOrChar&&typeof nameOrChar==='object'?nameOrChar:characterFor(nameOrChar);
  const n=Number(c.leadership);return Number.isFinite(n)?Math.max(0,Math.min(5,n)):1;
}

/**
 * Who speaks at the morning meeting: the resident with the highest leadership. Ties go to Adam if he is one of
 * them (he is the island's default foreman), otherwise to whoever arrived first (list order = arrival order).
 * With nobody ashore it is Adam. `residents` may be names or {name} objects. Returns the canon entry with
 * `residentName` set to the name as it appears on the island.
 */
export function foremanFor(residents=[]){
  const people=(Array.isArray(residents)?residents:[]).map(r=>typeof r==='string'?r:r?.name).filter(Boolean);
  if(!people.length)return {...CHARACTERS.adam,residentName:'Adam'};
  let best=people[0],bestScore=leadership(best);
  for(const name of people.slice(1)){
    const score=leadership(name);
    if(score>bestScore||(score===bestScore&&characterKey(name)==='adam'&&characterKey(best)!=='adam')){best=name;bestScore=score;}
  }
  return {...characterFor(best),residentName:best};
}

/** A 1–2 line summary for LLM prompts (the foreman, chat): who they are, how they talk, what they do and never do. */
export function promptSummary(nameOrChar){
  const c=nameOrChar&&typeof nameOrChar==='object'?nameOrChar:characterFor(nameOrChar);
  return `${c.title}: ${c.personality.join(', ')}. ${c.foremanNote}\nVoice: ${c.voice}`;
}

/**
 * What the island should send the backend foreman per resident (village.js / foreman.js: TODO wire — the
 * foreman client was not in the tree when this was written). `residents` are {name, ...} as the island knows them.
 */
export function foremanPayload(residents=[]){
  const list=(Array.isArray(residents)?residents:[]).filter(r=>r?.name);
  const foreman=foremanFor(list);
  return {foreman:foreman.residentName,foremanLeadership:leadership(foreman),
    residents:list.map(r=>{const c=characterFor(r.name);return {name:r.name,skill:c.roleName,leadership:leadership(c),summary:promptSummary(c)};})};
}

// ---- Validation for profiles written by the backend (Gemini) before they become canon on a device ----
/** Words that keep a generated profile off a 4–9 year old's card. One hit anywhere → the profile is rejected. */
export const UNSAFE_WORDS=/\b(kill|kills|killed|killing|murder\w*|blood\w*|sword|spear|die|died|dies|dying|death|dead|hell|devil|demon\w*|satan|scary|terrif\w*|fear|fears|feared|fearful|afraid|war|wars|battle\w*|fight\w*|fought|slaughter\w*|stab\w*|punish\w*|curse|cursed|wrath|destroy\w*|slave\w*|naked|drunk|hate|hated|hates)\b/i;
export const unsafeText=text=>UNSAFE_WORDS.test(String(text||''));
const unsafe=unsafeText;
const words=(s,max)=>String(s||'').trim().split(/\s+/).filter(Boolean).length<=max;
const shortList=(v,max)=>Array.isArray(v)&&v.length<=max&&v.every(x=>typeof x==='string'&&x.trim()&&words(x,3));

/**
 * Checks a profile (from the server or localStorage) against the canon shape. Returns a cleaned entry or null.
 * Rules: role from ROLES, leadership clamped 0–5, strengths 1–2 / weaknesses 0–2 short skill areas, exactly
 * 3 tasks with one silly, every text field short and free of UNSAFE_WORDS.
 */
export function validateProfile(raw,name=''){
  if(!raw||typeof raw!=='object')return null;
  const roleId=String(raw.roleId||'').toLowerCase();const role=ROLES[roleId];if(!role)return null;
  const shown=String(raw.name||name||'').trim();if(!shown||shown.length>40)return null;
  if(!shortList(raw.strengths,2)||raw.strengths.length<1||!shortList(raw.weaknesses||[],2))return null;
  const tasks=Array.isArray(raw.tasks)?raw.tasks.map(t=>({icon:String(t?.icon||role.icon),text:String(t?.text||'').trim(),...(t?.silly?{silly:true}:{})})).filter(t=>t.text&&t.text.length<=60):[];
  if(tasks.length!==3||tasks.filter(t=>t.silly).length!==1)return null;
  const personality=Array.isArray(raw.personality)?raw.personality.map(p=>String(p).trim()).filter(Boolean).slice(0,4):[];
  if(personality.length<2)return null;
  const text={voice:raw.voice,faith:raw.faith,storyLine:raw.storyLine,foremanNote:raw.foremanNote,bio:raw.bio,dailyRhythm:raw.dailyRhythm||role.rhythm,relationships:raw.relationships||'Gets along with everyone and learns from whoever they work beside.'};
  const tidy=v=>String(v).replace(/\s+/g,' ').trim();
  for(const [k,v] of Object.entries(text)){if(typeof v!=='string'||!v.trim()||v.length>400)return null;text[k]=tidy(v);}
  const limits=Array.isArray(raw.limits)?raw.limits.map(l=>String(l).trim()).filter(Boolean).slice(0,3):[];
  const everything=[shown,...raw.strengths,...(raw.weaknesses||[]),...tasks.map(t=>t.text),...personality,...Object.values(text),...limits,String(raw.bibleRef||'')].join(' | ');
  if(unsafe(everything))return null;
  const icons=new Set(['walk','axe','mine','hoe','plant','water','fish','food','build','book','bag','map','sun','energy','wood','stone','rest','water_drop','pray','rawfish','cookedfish','wheat','harvest','moon','shovel','bread','manna','apple_seed','pumpkin','carrot']);
  for(const t of tasks)if(!icons.has(t.icon))t.icon=role.icon==='fence'?'build':role.icon;
  const lead=Number(raw.leadership);
  return {
    name:shown,title:String(raw.title||`${shown} the ${role.name}`).slice(0,60),roleId,roleName:role.name,icon:role.icon,
    personality,traits:personality,voice:text.voice,strengths:raw.strengths.map(s=>String(s).trim()),weaknesses:(raw.weaknesses||[]).map(s=>String(s).trim()),tasks,
    dailyRhythm:text.dailyRhythm,relationships:text.relationships,faith:text.faith,limits:limits.length?limits:[`Never ${(raw.weaknesses?.[0]||'the hard jobs').toLowerCase()} — that goes to a friend who is good at it`],
    usually:String(raw.usually||role.usually).slice(0,60),foremanNote:text.foremanNote,bio:text.bio,
    leadership:Number.isFinite(lead)?Math.max(0,Math.min(5,Math.round(lead))):1,dialogue:['gardener','builder','encourager','playful'].includes(raw.dialogue)?raw.dialogue:'encourager',
    lines:Array.isArray(raw.lines)?raw.lines.map(l=>String(l).trim()).filter(l=>l&&l.length<=120).slice(0,3):[],
    bibleRef:tidy(raw.bibleRef||'').slice(0,40),storyLine:text.storyLine,remote:true,
  };
}

/** Where the canon is read from today, and the files that still restate facts and should move over. */
export const CONSUMERS=[
  {file:'homeworld/src/character-profile.mjs',status:'now',what:'welcome-ashore / About card: role, strengths, weaknesses, tasks, foreman line and the one-line Bible story'},
  {file:'homeworld/src/character-skills.mjs',status:'now',what:'skillFor() falls back to the canon role (ROLES) for Bible friends, so new roles run on existing autopilot chores'},
  {file:'homeworld/src/residents.js',status:'now',what:'autopilot chores chosen by role (ROLES[...].chores); prefetches a remote profile at drop-off'},
  {file:'homeworld/src/character-profile-remote.js',status:'now',what:'asks the app for a Gemini-written profile when a story friend is not in the tables; localStorage cache godlykids_island_charprofile_v1:<key>'},
  {file:'homeworld/src/resident-dialogue.mjs',status:'now',what:'residentPersonality() uses the canon dialogue bank; a friend\'s own `lines` are offered first'},
  {file:'pages/MyHomePage.tsx + services/islandCharacterService.ts',status:'now',what:'relays gk-character-profile-please → POST /api/island/character-profile → gk-character-profile'},
  {file:'backend/src/routes/islandCharacterProfile.js',status:'now',what:'Gemini Flash writes the canon shape for unknown Bible friends; cached in Mongo IslandCharacterProfile by normalised name'},
  {file:'homeworld/scripts/gen-characters-md.mjs',status:'now',what:'generates homeworld/CHARACTERS.md'},
  {file:'homeworld/src/village.js / foreman.js',status:'later',what:'TODO: morning meeting should use foremanFor(residents) for the speaker and send foremanPayload() to the backend'},
  {file:'backend/src/routes/islandForeman.js',status:'later',what:'TODO: accept residents[].summary + leadership (foremanPayload) and put them in the Gemini prompt'},
  {file:'homeworld/src/dining.js',status:'later',what:'meal routine: who cooks (role cook) and who grills (Noah) — already works through skillFor()'},
  {file:'homeworld/src/community.mjs',status:'later',what:'legacy MEMBERS roles (Eve/Adam "Garden helper", Noah "Fisher") predate the skills and disagree with the canon'},
  {file:'services/rewardsService.ts',status:'later',what:'ONBOARDING_ADAM_REWARD persona; CMS personas (MapStory reward pool) stay authoritative for chat, the canon is the island default'},
];
