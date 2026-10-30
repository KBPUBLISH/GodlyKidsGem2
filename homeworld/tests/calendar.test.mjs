import test from 'node:test';
import assert from 'node:assert/strict';
import {displayedDay, yearClockLabel, DISPLAY_YEAR} from '../src/calendar.mjs';

test('the year stays 1 and the day wraps after 365', () => {
  assert.equal(DISPLAY_YEAR, 1);
  assert.equal(displayedDay(1), 1);
  assert.equal(yearClockLabel(1), 'Yr 1 · Day 1');
  assert.equal(displayedDay(365), 365);
  assert.equal(yearClockLabel(365), 'Yr 1 · Day 365');
  assert.equal(displayedDay(366), 1);
  assert.equal(yearClockLabel(366), 'Yr 1 · Day 1');
  assert.equal(displayedDay(730), 365);
  assert.equal(yearClockLabel(730), 'Yr 1 · Day 365');
  assert.equal(yearClockLabel(731), 'Yr 1 · Day 1');
});
