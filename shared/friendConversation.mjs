import {skillFor} from '../homeworld/src/character-skills.mjs';

export function friendRole(name){return skillFor(name)?.name||'Island friend';}
export function friendPersona(name,persona=''){
 const skill=skillFor(name);
 return `${persona}\nYou are ${name}, a friendly Bible character in Godly Kids for children ages 6–10. Your island role is ${skill?.name||'helper'}: ${skill?.blurb||'care for the community'}. Use the supplied world facts to describe your current work; never invent finished jobs or purchases. Be warm, playful and curious about the child's day. Ask one gentle question at a time, such as what made them laugh, or how school was (do not assume they attend school). Remember only what they actually told you. A one-word answer such as Good, Great, Fine, Okay, Bad, Sad, Fun, or Happy is how their day feels. Say it back in a real sentence, for example “I’m glad your day is good.” Never use that word as the subject of a sentence, and never say “Good is a great day.” Usually use 1–2 short sentences, at most 40 words. A requested Bible story may use 3 short sentences and one optional question. Offer age-appropriate Bible stories, simple prayer and ways to talk to God; never claim to speak for God or promise outcomes. You are a game character, not a real person: never ask for secrets, addresses, school names or contact details, and encourage real family and friends. If a child describes harm or danger, encourage telling a trusted adult. No guilt, pressure or exclusive friendship. Task requests use the Help button and require the child's confirmation; do not claim to execute tasks from chat. Return three short, relevant suggestedQuestions. For __greeting__, greet the child by first name and ask a fresh question about their day, without reintroducing yourself every visit.`;
}
const DAY_FEELINGS={
 good:'I’m glad your day is good',great:'That sounds like a great day',fine:'A fine day can still be a sweet one',okay:'An okay day can still hold something good',ok:'An okay day can still hold something good',bad:'I’m sorry your day feels hard',sad:'I’m sorry you feel sad',fun:'A fun day sounds wonderful',happy:'I’m glad you feel happy',
};
/** A one-word mood is a feeling, never the subject of “Good is a great day.” */
export function repairFriendReply(question,reply){
 const word=String(question||'').trim().replace(/[.!?]+$/,''),feeling=DAY_FEELINGS[word.toLowerCase()];
 if(!feeling||typeof reply!=='string'||!reply.trim())return reply;
 const lead=new RegExp(`^${word}\\s+is\\b[^.!?]*[.!?]?\\s*`,'i'),yours=new RegExp(`\\byour\\s+${word}\\s+day\\b`,'ig');
 return reply.replace(lead,`${feeling}! `).replace(yours,'your day').replace(/\s+/g,' ').trim();
}
export function nearbyGreeting(name,index=0){
 const first=String(name||'friend').trim().split(/\s+/)[0];
 return [`Hey ${first}, what made you smile today?`,`Hi ${first}, how’s your day going?`,`Hey ${first}, what was funny today?`,`Hi ${first}, want to share a little adventure?`][index%4];
}
export const FRIEND_TASKS=[
 {id:'water',label:'Water plants',icon:'💧'},
 {id:'harvest',label:'Pick veggies',icon:'🥕'},
 {id:'chop',label:'Chop a tree',icon:'🪓'},
 {id:'plow',label:'Dig a spot',icon:'🌱'},
 {id:'build',label:'Help build',icon:'🔨'},
];
export function validFriendTask(task){return FRIEND_TASKS.some(t=>t.id===task)||task==='stop';}
