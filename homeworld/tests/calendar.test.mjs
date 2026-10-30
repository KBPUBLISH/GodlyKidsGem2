import test from 'node:test';
import assert from 'node:assert/strict';
import {displayedDay, yearClock, yearClockLabel} from '../src/calendar.mjs';

test('year 0 runs through day 364, then year 1 starts and wraps without reaching year 2', () => {
  assert.deepEqual(yearClock(1), {year: 0, day: 1});
  assert.equal(yearClockLabel(1), 'Yr 0 · Day 1');
  assert.equal(displayedDay(337), 337);
  assert.equal(yearClockLabel(337), 'Yr 0 · Day 337');
  assert.equal(yearClockLabel(364), 'Yr 0 · Day 364');
  assert.equal(yearClockLabel(365), 'Yr 1 · Day 1');
  assert.equal(yearClockLabel(366), 'Yr 1 · Day 2');
  assert.equal(displayedDay(729), 365);
  assert.equal(yearClockLabel(729), 'Yr 1 · Day 365');
  assert.equal(yearClockLabel(730), 'Yr 1 · Day 1');
  assert.equal(yearClock(731).year, 1);
});
