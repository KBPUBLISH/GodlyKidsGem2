import test from 'node:test';
import assert from 'node:assert/strict';
import {friendRole,friendPersona,nearbyGreeting,repairFriendReply,validFriendTask} from '../../shared/friendConversation.mjs';
import {LivingFriend} from '../src/living-friend.js';
test('Bible friends use their existing skills and short, varied personal greetings',()=>{
 assert.equal(friendRole('Adam'),'Farmer');assert.equal(friendRole('Noah'),'Woodcutter');assert.equal(friendRole('Eve'),'Cook');
 assert.notEqual(nearbyGreeting('Mikey',0),nearbyGreeting('Mikey',1));assert.match(nearbyGreeting('Mikey Smith',2),/Mikey,/);
 assert.match(friendPersona('Adam'),/Farmer/);assert.match(friendPersona('Adam'),/supplied world facts/);
 assert.match(friendPersona('Adam'),/trusted adult/);assert.match(friendPersona('Adam'),/Good is a great day/);
 assert.equal(repairFriendReply('Good','Good is a great day to have, Mikey! What was the best part of your good day?'),'I’m glad your day is good! What was the best part of your day?');
 assert.ok(!validFriendTask('buy'));assert.ok(validFriendTask('water'));
});
test('only current conversations accept known task requests',()=>{
 const calls=[],friend=Object.create(LivingFriend.prototype);Object.assign(friend,{chatOpen:true,session:7,post:x=>calls.push(x),assign:x=>({ok:true,line:x}),brief:()=>({name:'Adam'})});
 friend.handle({type:'gk-living-friend-task',session:6,task:'water'});friend.handle({type:'gk-living-friend-task',session:7,task:'delete'});assert.equal(calls.length,0);
 friend.handle({type:'gk-living-friend-task',session:7,task:'water'});assert.equal(calls.length,1);assert.equal(calls[0].line,'water');
 friend.chatOpen=false;friend.handle({type:'gk-living-friend-task',session:7,task:'chop'});assert.equal(calls.length,1);
});
