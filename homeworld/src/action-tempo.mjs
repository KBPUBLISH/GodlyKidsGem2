// Short work motions are 25% quicker; clocks, growth and spoken scenes keep real time.
export const WORK_ACTION_RATE=1.25;
const QUICK_ACTIONS=new Set(['plant','water','harvest','chop','plow','clear_weeds','dig_stump','dig_mud','mine','pick_apples','eat','grill']);
export const actionPlaybackRate=type=>QUICK_ACTIONS.has(type)?WORK_ACTION_RATE:1;
