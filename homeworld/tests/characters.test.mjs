import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,BIBLE_CHARACTERS,ROLES,SKILL_AREAS,characterKey,characterFor,needsProfile,registerCharacter,validateProfile,leadership,foremanFor,foremanPayload,promptSummary} from '../src/characters.mjs';
import {profileFor} from '../src/character-profile.mjs';
import {skillFor} from '../src/character-skills.mjs';
import {residentPersonality,nextResidentLine} from '../src/resident-dialogue.mjs';
import {RemoteProfiles,cacheKeyFor,isStoryFriend} from '../src/character-profile-remote.js';

test('characterFor finds base islanders, Bible friends and falls back to the generic helper',()=>{
  assert.equal(characterFor('Eve').roleId,'cook');
  assert.equal(characterFor('Moses').roleId,'leader');
  assert.equal(characterFor('Moses').title,'Moses the Leader');
  const bob=characterFor('Traveller Bob');
  assert.equal(bob.roleId,null);
  assert.equal(bob.name,'Traveller Bob');
  assert.equal(needsProfile('Traveller Bob'),true);
  assert.equal(needsProfile('Moses'),false);
});

test('fuzzy names: case, Saint/King/the, "the Great" suffixes, bible_* tags and CMS _2/_3d suffixes',()=>{
  for(const [raw,key] of [['moses','moses'],['MOSES','moses'],['Moses the Great','moses'],['Saint Peter','peter'],['King David','david'],['the Good Samaritan','samaritan'],
    ['bible_joseph_3d','joseph'],['bible_joseph_2_3d','joseph'],['Bible_Esau_2_3d','esau'],['Joseph_2','joseph'],['Jesus2','jesus'],['Disney Jesus','jesus'],['Israel','jacob'],['Simon Peter','peter'],['Queen Esther','esther']]){
    assert.equal(characterKey(raw),key,raw);
    assert.equal(characterFor(raw).roleId,BIBLE_CHARACTERS[key].roleId,raw);
  }
});

test('every Bible friend is in the approved card shape and passes the safety validator',()=>{
  for(const [key,c] of Object.entries(BIBLE_CHARACTERS)){
    assert.ok(ROLES[c.roleId],`${key} role`);
    assert.ok(c.strengths.length>=1&&c.strengths.length<=2,`${key} strengths`);
    assert.ok(c.weaknesses.length<=2,`${key} weaknesses`);
    for(const s of [...c.strengths,...c.weaknesses])assert.ok(SKILL_AREAS.includes(s),`${key} skill area ${s}`);
    assert.equal(c.tasks.length,3,`${key} tasks`);
    assert.equal(c.tasks.filter(t=>t.silly).length,1,`${key} silly task`);
    assert.ok(c.leadership>=0&&c.leadership<=5,`${key} leadership`);
    assert.ok(c.bibleRef&&c.storyLine&&c.faith,`${key} bible fields`);
    assert.ok(validateProfile(c,c.name),`${key} validates`);
  }
});

test('leadership scores and foremanFor: Joseph runs the meeting when he is ashore, Adam by default',()=>{
  assert.equal(leadership('Joseph'),5);
  assert.equal(leadership('Moses'),5);
  assert.equal(leadership('Deborah'),5);
  assert.equal(leadership('Jonah'),1);
  assert.equal(leadership('Adam'),2);
  assert.equal(leadership('Nobody Special'),1);
  assert.equal(foremanFor([]).residentName,'Adam');
  assert.equal(foremanFor(['Eve','Noah','Adam']).residentName,'Adam');           // tie at 2 → Adam
  assert.equal(foremanFor(['Noah','Eve']).residentName,'Noah');                  // tie, no Adam → earliest arrival
  assert.equal(foremanFor([{name:'Eve'},{name:'Joseph_2'},{name:'Adam'}]).residentName,'Joseph_2');
  assert.equal(foremanFor(['Adam','Moses','Joseph']).residentName,'Moses');      // tie at 5 → earliest
  const payload=foremanPayload([{name:'Adam'},{name:'Gideon'}]);
  assert.equal(payload.foreman,'Gideon');
  assert.equal(payload.residents[1].leadership,3);
  assert.match(payload.residents[1].summary,/Gideon the Farmer/);
  assert.match(promptSummary('Peter'),/Voice:/);
});

test('validateProfile accepts a good remote profile, clamps leadership, and rejects bad roles or unsafe words',()=>{
  const good={roleId:'farmer',name:'Gideon',strengths:['Farming'],weaknesses:['Fishing'],personality:['brave','careful','humble'],voice:'Asks are you sure, then does it.',faith:'Loves that God called him mighty.',
    storyLine:'Gideon felt small but God used him.',foremanNote:'Give him wheat and the night watch.',bio:'A farmer who learned to trust God.',leadership:9,
    tasks:[{icon:'wheat',text:'Threshing wheat'},{icon:'moon',text:'Guarding at dusk'},{icon:'sun',text:'Checking the fleece',silly:true}],bibleRef:'Judges 6–7'};
  const v=validateProfile(good,'Gideon');
  assert.ok(v);assert.equal(v.leadership,5);assert.equal(v.roleName,'Farmer');assert.equal(v.remote,true);
  assert.equal(validateProfile({...good,roleId:'wizard'}),null);
  assert.equal(validateProfile({...good,voice:'He fought a battle.'}),null);
  assert.equal(validateProfile({...good,tasks:good.tasks.slice(0,2)}),null);
  assert.equal(validateProfile({...good,strengths:['Being extremely good at things']}),null);
});

test('a registered remote profile becomes canon for the card, the skill and the dialogue',()=>{
  const raw={roleId:'fisher',name:'Andrew',strengths:['Fishing'],weaknesses:['Building'],personality:['quiet','kind'],voice:'Brings people along.',faith:'Loves that Jesus called him first.',
    storyLine:'Andrew brought his brother Peter to Jesus.',foremanNote:'Give him the fishing.',bio:'A fisherman who brings friends.',leadership:2,dialogue:'encourager',lines:['Come and see.'],
    tasks:[{icon:'rawfish',text:'Fishing'},{icon:'bag',text:'Hauling nets'},{icon:'walk',text:'Bringing everyone he meets to breakfast',silly:true}],bibleRef:'John 1'};
  assert.equal(needsProfile('Andrew'),true);
  registerCharacter('Andrew',validateProfile(raw,'Andrew'));
  assert.equal(needsProfile('Andrew'),false);
  assert.equal(characterFor('andrew').roleId,'fisher');
  const card=profileFor({id:'r1',name:'Andrew'},{});
  assert.equal(card.kind,'named');assert.equal(card.role.name,'Fisher');assert.equal(card.strengths[0],'Fishing');assert.match(card.story,/Peter/);
  assert.equal(skillFor('Andrew').id,'fisher');assert.ok(skillFor('Andrew').chores.has('fish'));
  assert.equal(residentPersonality({id:'r1',name:'Andrew'}),'encourager');
});

test('Bible friends get a card from the canon, a skill mapped to existing chores, and their own lines first',()=>{
  const moses=profileFor({id:'m',name:'Moses the Great'},{});
  assert.equal(moses.kind,'named');assert.equal(moses.role.name,'Leader');assert.deepEqual(moses.strengths,['Leading','Teaching']);
  assert.match(moses.foreman,/Moses usually gets the morning meeting/);
  assert.ok(skillFor('Peter').chores.has('fish'));
  assert.ok(skillFor('David').chores.has('guard'));
  assert.ok(skillFor('Nehemiah').chores.has('chop'));
  assert.equal(skillFor('Eve').id,'cook');assert.ok(skillFor('Eve').chores.has('plant'));
  assert.equal(residentPersonality({id:'x',name:'Abel'}),'gardener');
  const state={cells:{},stats:{},buildings:[],animals:[],revision:0,islandConversations:{version:1,events:[],residents:{peter:{lastText:'hi',lastAt:0,recent:['welcome']}}}};
  const {line}=nextResidentLine(state,{id:'peter',name:'Peter'},{residents:[],plants:[],buildings:[]},Date.now());
  assert.ok(BIBLE_CHARACTERS.peter.lines.includes(line.text),line.text);
});

test('base islanders are unchanged by the Bible table',()=>{
  assert.deepEqual(Object.keys(CHARACTERS),['eve','abel','noah','adam','generic']);
  assert.equal(profileFor({id:'e',name:'Eve'},{}).foreman,'The foreman picks the day’s jobs — Eve usually gets the fishing and the kitchen.');
});

// The exact profile the production endpoint returned for a name outside the static table (Barnabas, Oct 2026).
const BARNABAS={name:'Barnabas',title:'Barnabas the Helper',roleId:'healer',roleName:'Helper',icon:'energy',personality:['generous','encouraging','kind','supportive'],traits:['generous','encouraging','kind','supportive'],voice:'Barnabas speaks with a warm, gentle voice, always ready to offer a kind word or a helping hand.',strengths:['Helping','Teaching'],weaknesses:[],tasks:[{icon:'bag',text:'Sharing supplies'},{icon:'book',text:'Encouraging friends'},{icon:'walk',text:'Giving the chickens high fives',silly:true}],dailyRhythm:'Barnabas starts his day by checking in with everyone.',relationships:'He is a wonderful friend to all.',faith:'Barnabas loves how God uses people to encourage each other and share good news, just like he did with Paul.',limits:['Never discourages anyone'],usually:'helping new arrivals and sharing stories',foremanNote:'Give him tasks where he can support others.',bio:'Barnabas is known for his big heart and his gift of encouragement.',leadership:3,dialogue:'encourager',lines:["You're doing a wonderful job!",'Let\'s work together on this.','I believe in you!'],bibleRef:'Acts 4, 9, 13\u201315',storyLine:'Barnabas helped his friend Paul tell everyone about Jesus and encouraged many people.',remote:true};

function fakeStorage(init={}){const m=new Map(Object.entries(init));return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}

test('remote profiles: prefetch asks the parent only for story friends, receive() validates + caches, hydrate() restores after reload',()=>{
  const posted=[];const parent={postMessage:(msg)=>posted.push(msg)};
  const st=fakeStorage();
  const game={notify(){}};
  const rp=new RemoteProfiles(game,st,parent);
  assert.equal(isStoryFriend({id:'trav_7',name:'Bob'}),false,'travellers are not story friends');
  assert.equal(rp.prefetch({id:'trav_7',name:'Bob'}),false);
  assert.equal(rp.prefetch({id:'bible_gideon_3d',name:'Gideon',story:true}),false,'Gideon is static canon: no request');
  assert.equal(rp.prefetch({id:'bible_barnabas_3d',name:'Barnabas',story:true,sourceStoryId:'s1'}),true);
  assert.equal(posted.length,1);assert.equal(posted[0].type,'gk-character-profile-please');assert.equal(posted[0].name,'Barnabas');
  assert.equal(rp.receive({type:'gk-character-profile',name:'Barnabas',profile:BARNABAS}),true);
  assert.equal(cacheKeyFor('Barnabas'),'godlykids_island_charprofile_v1:barnabas');
  assert.ok(st.getItem('godlykids_island_charprofile_v1:barnabas'));
  assert.equal(characterFor('Barnabas').title,'Barnabas the Helper');
  assert.equal(profileFor({id:'b',name:'Barnabas'},{}).role.name,'Helper');
  // a second island boot on the same device: the registry is rebuilt from storage, no network needed
  registerCharacter('Barnabas',null);
  assert.equal(needsProfile('Barnabas'),true);
  const again=new RemoteProfiles(game,st,parent);
  assert.equal(again.hydrate()>=1,true);
  assert.equal(needsProfile('Barnabas'),false);
  assert.equal(again.prefetch({id:'bible_barnabas_3d',name:'Barnabas',story:true}),false,'cached: parent is not asked again');
  assert.equal(posted.length,1);
  // a poisoned cache entry is ignored, not shown
  st.setItem('godlykids_island_charprofile_v1:nabal',JSON.stringify({v:1,profile:{...BARNABAS,name:'Nabal',bio:'He wanted to fight everyone.'}}));
  assert.equal(new RemoteProfiles(game,st,parent).readCached('Nabal'),null);
});
