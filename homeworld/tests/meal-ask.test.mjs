import test from 'node:test';
import assert from 'node:assert/strict';
import {kidFirstName,mealAskLine,playedCookStep,ASK_AGAIN_MINUTES} from '../src/meal-ask.mjs';

const MEALS = ['breakfast', 'lunch', 'dinner'];

test('each meal has three different lines in Eve\'s voice, and lol is not on every one', () => {
  let lol = 0, lines = 0;
  for (const id of MEALS) {
    const set = new Set([0, 1, 2].map(i => mealAskLine(id, 'Sam', i)));
    assert.equal(set.size, 3, id);
    for (const line of set) {
      lines++;
      assert.match(line, /^Hey Sam,/);
      assert.match(line, new RegExp(id, 'i'));
      assert.ok(line.length < 90, line);
      if (/lol/i.test(line)) lol++;
    }
  }
  assert.ok(lol > 0 && lol < lines);
  assert.equal(mealAskLine('dinner', 'Sam', 0), 'Hey Sam, I gotta go make dinner lol.');
});

test('a played cook is asked at the bell, snoozed for 10 island minutes, then skipped an hour late', () => {
  const mealHour = 12, mealId = 'lunch';
  assert.equal(playedCookStep({hour: 11.5, mealHour, minutes: 690, mealId, ask: null, released: false}).kind, 'hold');
  const first = playedCookStep({hour: 12, mealHour, minutes: 720, mealId, ask: null, released: false});
  assert.deepEqual(first, {kind: 'ask', variant: 0});
  const open = {mealId, variant: 0, open: true, againAt: 0};
  assert.equal(playedCookStep({hour: 12.1, mealHour, minutes: 726, mealId, ask: open, released: false}).kind, 'showing');
  const snooze = {mealId, variant: 0, open: false, againAt: 720 + ASK_AGAIN_MINUTES};
  assert.equal(playedCookStep({hour: 12.05, mealHour, minutes: 723, mealId, ask: snooze, released: false}).kind, 'snooze');
  const again = playedCookStep({hour: 12.2, mealHour, minutes: 732, mealId, ask: snooze, released: false});
  assert.deepEqual(again, {kind: 'ask', variant: 1});
  assert.equal(playedCookStep({hour: 13, mealHour, minutes: 780, mealId, ask: open, released: false}).kind, 'skip');
  assert.equal(playedCookStep({hour: 12.4, mealHour, minutes: 744, mealId, ask: null, released: true}).kind, 'cook');
});

test('the kid\'s profile name is the first word, otherwise friend', () => {
  const prev = globalThis.localStorage;
  globalThis.localStorage = {getItem: key => key === 'godly_kids_data_v6' ? JSON.stringify({currentProfileId: '1', kids: [{id: '1', name: 'Sam Lee'}]}) : null};
  assert.equal(kidFirstName(), 'Sam');
  globalThis.localStorage = {getItem: () => JSON.stringify({currentProfileId: null, kids: [{id: '1', name: 'Sam'}]})};
  assert.equal(kidFirstName(), 'friend');
  globalThis.localStorage = prev;
  if (typeof localStorage === 'undefined') assert.equal(kidFirstName(), 'friend');
});
