import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelfieCameraSession } from '../utils/selfieCameraSession.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const events = [];
  const capture = deferred();
  const stream = { getTracks: () => [{ stop() { events.push('stop'); } }] };
  const devices = {
    getUserMedia(constraints) { events.push(['capture', constraints]); return capture.promise; },
    async enumerateDevices() { events.push('enumerate'); return [{ kind: 'videoinput' }]; }
  };
  const callbacks = {
    onStream(value) { assert.equal(value, stream); events.push('preview'); },
    onDevices() { events.push('devices'); },
    onError() { events.push('error'); }
  };
  return { session: createSelfieCameraSession(), events, capture, stream, devices, callbacks };
}

test('idle camera session and cleanup do not probe hardware', () => {
  const f = fixture();
  f.session.stop();
  assert.deepEqual(f.events, []);
});

test('device enumeration waits for explicitly requested camera permission', async () => {
  const f = fixture();
  const constraints = { video: { facingMode: 'user' } };
  const work = f.session.start(f.devices, constraints, f.callbacks);
  assert.deepEqual(f.events, [['capture', constraints]]);
  f.capture.resolve(f.stream);
  await work;
  assert.deepEqual(f.events.slice(1), ['preview', 'enumerate', 'devices']);
  f.session.stop();
  f.session.stop();
  assert.equal(f.events.filter(e => e === 'stop').length, 1);
});

test('denial never enumerates devices or leaves an active camera', async () => {
  const f = fixture();
  const work = f.session.start(f.devices, { video: true }, f.callbacks);
  f.capture.reject(new Error('NotAllowedError'));
  await work;
  assert.deepEqual(f.events.slice(1), ['error']);
});

test('leaving while the OS prompt is pending stops a late stream without opening a preview', async () => {
  const f = fixture();
  const work = f.session.start(f.devices, { video: true }, f.callbacks);
  f.session.stop();
  f.capture.resolve(f.stream);
  await work;
  assert.deepEqual(f.events.slice(1), ['stop']);
});

test('leaving while permission is pending ignores a late rejection', async () => {
  const f = fixture();
  const work = f.session.start(f.devices, { video: true }, f.callbacks);
  f.session.stop();
  f.capture.reject(new Error('NotAllowedError'));
  await work;
  assert.equal(f.events.length, 1);
});

test('switching cameras discards a stale request without stopping the new stream', async () => {
  const f = fixture();
  const oldCapture = deferred();
  const oldStream = { getTracks: () => [{ stop() { f.events.push('stop-old'); } }] };
  const oldWork = f.session.start({ getUserMedia: () => oldCapture.promise }, { video: true }, f.callbacks);
  const work = f.session.start(f.devices, { video: true }, f.callbacks);
  f.capture.resolve(f.stream);
  await work;
  oldCapture.resolve(oldStream);
  await oldWork;
  assert.deepEqual(f.events.slice(1), ['preview', 'enumerate', 'devices', 'stop-old']);
  f.session.stop();
  assert.equal(f.events.at(-1), 'stop');
});

test('late device results cannot update a closed selfie screen', async () => {
  const f = fixture(), enumeration = deferred(), enumerating = deferred();
  f.devices.enumerateDevices = () => { enumerating.resolve(); return enumeration.promise; };
  const work = f.session.start(f.devices, { video: true }, f.callbacks);
  f.capture.resolve(f.stream);
  await enumerating.promise;
  f.session.stop();
  enumeration.resolve([{ kind: 'videoinput' }]);
  await work;
  assert.deepEqual(f.events.slice(1), ['preview', 'stop']);
});
