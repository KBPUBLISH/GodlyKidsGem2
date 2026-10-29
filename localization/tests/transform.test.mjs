import test from 'node:test';
import assert from 'node:assert/strict';
import localization from '../vite-localization.mjs';
const plugin=localization(process.cwd());
test('translates game inventory, notifications and accessibility text without changing events',()=>{
 const out=plugin.transform('const X=()=> <button aria-label="Open my bag" onClick={()=>open(id)}>{item.name}{toast}{`${count} minutes left`}</button>','/project/homeworld/src/example.jsx').code;
 assert.match(out,/GKLocalizedElement/);assert.match(out,/value=\{item.name\}/);assert.match(out,/value=\{toast\}/);assert.match(out,/onClick=\{\(\) => open\(id\)\}/);
});
test('preserves user names and already translated character typewriter text',()=>{
 const out=plugin.transform('const X=()=> <p>Hello {user.name}{reply.text.slice(0,typed)}</p>','/project/pages/Example.tsx').code;
 assert.match(out,/Hello /);assert.doesNotMatch(out,/value=\{user.name\}/);assert.doesNotMatch(out,/value=\{reply.text/);
});
test('does not transform localization implementation',()=>{
 assert.equal(plugin.transform('const X=()=> <p>hello</p>','/project/localization/Example.tsx'),null);
});
