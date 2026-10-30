import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSceneVideo } from '../utils/prepareSceneVideo.mjs';
function fixture(t) {
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const video = new EventTarget();
  Object.assign(video,{readyState:0,load(){ calls.push('load'); },play(){ calls.push(['play',this.muted,this.playsInline]); return new Promise(()=>{}); }});
  const calls=[];
  const states=[];
  const loader=prepareSceneVideo(video,{onLoading:()=>states.push('loading'),onReady:()=>states.push('ready'),onFailure:()=>states.push('failed')});
  t.after(()=>loader.dispose());
  return {video,calls,states,loader};
}
test('pending autoplay does not prevent muted startup; retry loads and plays synchronously',t=>{
  const {calls,states,loader}=fixture(t);
  assert.deepEqual(calls,[['play',true,true]]);
  t.mock.timers.tick(15000);
  assert.equal(states.at(-1),'failed');
  loader.retry();
  assert.deepEqual(calls.slice(-2),['load',['play',true,true]]);
  assert.equal(states.at(-1),'loading');
});
test('decoded frame clears timeout even when loadeddata was suppressed',t=>{
  const {video,states}=fixture(t);
  video.readyState=2;
  t.mock.timers.tick(250);
  assert.equal(states.at(-1),'ready');
  t.mock.timers.tick(20000);
  assert.deepEqual(states,['loading','ready']);
});
test('late frame recovers a timed-out scene',t=>{
  const {video,states}=fixture(t);
  t.mock.timers.tick(15000);
  video.readyState=3;
  video.dispatchEvent(new Event('canplay'));
  assert.deepEqual(states,['loading','failed','ready']);
});
test('cleanup prevents events and timeouts affecting another scene',t=>{
  const {video,states,loader}=fixture(t);
  loader.dispose();
  video.readyState=4;
  video.dispatchEvent(new Event('playing'));
  t.mock.timers.tick(20000);
  loader.retry();
  assert.deepEqual(states,['loading']);
});
