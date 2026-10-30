// Quick "who is this friend" profiles shown when a story friend is dropped off on the island
// (and later from About on their card). Named friends read their card from the skill they carry
// (character-skills.mjs); every other collected friend is a general helper whose card is written
// from the practice XP the living village keeps (settlement.mjs), so it changes as they grow.
//
// Shape (set by the user): strengths and weaknesses are one or two short skill areas, tasks are a
// short list of real jobs plus one silly one. No numbers or quotas: the village foreman
// (village.js / settlement.mjs) hands out the day's jobs, so the card only says what each friend
// usually gets.
import {skillFor} from './character-skills.mjs';
import {ACTIVITIES,LEVELS,skillLevel} from './settlement.mjs';

/** Per-skill cards for the named friends. `tasks` icons are names from ui.jsx ICONS. */
export const SKILL_PROFILES={
  cook:{
    strengths:['Cooking','Fishing'],
    weaknesses:['Chopping wood'],
    tasks:[{icon:'rawfish',text:'Fishing'},{icon:'cookedfish',text:'Cooking'},{icon:'food',text:'Ringing the dinner bell (loudly)',silly:true}],
    foreman:'The foreman picks the day’s jobs — Eve usually gets the fishing and the kitchen.',
  },
  gardener:{
    strengths:['Gardening'],
    weaknesses:['Building'],
    tasks:[{icon:'hoe',text:'Weeding'},{icon:'water',text:'Watering'},{icon:'wheat',text:'Scarecrow conversations',silly:true}],
    foreman:'The foreman picks the day’s jobs — Abel usually gets the garden.',
  },
  woodcutter:{
    strengths:['Building'],
    weaknesses:['Gardening'],
    tasks:[{icon:'axe',text:'Cut trees'},{icon:'build',text:'Building'},{icon:'rest',text:'Back scratches',silly:true}],
    foreman:'The foreman picks the day’s jobs — Noah usually gets the wood and the grill.',
  },
  farmer:{
    strengths:['Farming','Mining'],
    weaknesses:['Cooking'],
    tasks:[{icon:'hoe',text:'Plowing'},{icon:'mine',text:'Breaking rock'},{icon:'walk',text:'Naming the chickens',silly:true}],
    foreman:'The foreman picks the day’s jobs — Adam usually gets the farm and the stone.',
  },
};

/** Skill-area names for a general helper's practice activities (settlement.mjs ACTIVITIES). */
const ACTIVITY_AREA={wood:'Chopping wood',stone:'Mining',fishing:'Fishing',garden:'Gardening',cooking:'Cooking',building:'Building'};
const HELPER_TASKS=[{icon:'walk',text:'Pitching in'},{icon:'wood',text:'Carrying things'},{icon:'energy',text:'High-fives',silly:true}];

/**
 * Card for one friend: {kind:'named'|'helper', name, role:{name,icon,levelName?}, strengths[], weaknesses[], tasks[{icon,text,silly?}], foreman, learned}.
 * `state` is the island save (for practice XP); it may be missing.
 */
export function profileFor(resident,state){
  const name=resident?.name||'Friend';
  const skill=skillFor(name);
  if(skill&&SKILL_PROFILES[skill.id]){
    const p=SKILL_PROFILES[skill.id];
    // 'fence' has no picture icon in ui.jsx; the farmer shows the build hammer instead.
    return {kind:'named',name,role:{name:skill.name,icon:skill.icon==='fence'?'build':skill.icon},strengths:p.strengths,weaknesses:p.weaknesses,tasks:p.tasks,foreman:p.foreman,learned:null};
  }
  const xp=state?.village?.xp?.[resident?.id]||{};
  const ranked=Object.keys(ACTIVITIES).map(a=>({activity:a,xp:xp[a]||0,level:skillLevel(xp[a]||0)})).sort((a,b)=>b.xp-a.xp);
  const practised=ranked.filter(r=>r.xp>=10);
  const top=practised[0]||null;
  const role=top?{name:ACTIVITIES[top.activity].name,icon:ACTIVITIES[top.activity].icon,levelName:LEVELS[top.level].name}:{name:'Helper',icon:'walk',levelName:LEVELS[0].name};
  // Strengths: what they have practised most (or just helping out); weakness: the least-practised area.
  const strengths=practised.length?practised.slice(0,2).map(r=>ACTIVITY_AREA[r.activity]):['Helping out'];
  const least=[...ranked].reverse().find(r=>!practised.includes(r))||ranked.at(-1);
  const weaknesses=least?[ACTIVITY_AREA[least.activity]]:[];
  const foreman=top?`The foreman picks the day’s jobs — ${name} is getting good at ${ACTIVITY_AREA[top.activity].toLowerCase()} and tends to get more of it.`:`The foreman picks the day’s jobs — ${name} will grow into whatever they practise most.`;
  return {kind:'helper',name,role,strengths,weaknesses,tasks:HELPER_TASKS,foreman,learned:top?{activity:top.activity,xp:top.xp,levelName:LEVELS[top.level].name}:null};
}
