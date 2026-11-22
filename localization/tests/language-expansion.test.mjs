import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=name=>fs.readFileSync(new URL('../../'+name,import.meta.url),'utf8');
function load(file,extras={}) {
 const context={exports:{},...extras};
 vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
 return context.exports;
}
const {ENGLISH_UI,EXPANDED_UI}=load('localization/expandedLanguages.ts');
const registry=load('services/translationService.ts',{require:()=>({getApiBaseUrl:()=>''})});
const codes=['hi','ta','ml','ar','sw','zh-TW'];
test('each new language has complete, nonempty UI text and a reader/launch/voice entry',()=>{
 assert.equal(Object.keys(ENGLISH_UI).length,254);
 for(const code of codes){
  const catalog=EXPANDED_UI[code];
  assert.deepEqual(Object.keys(catalog).sort(),Object.keys(ENGLISH_UI).sort());
  for(const [key,text] of Object.entries(catalog)){
   assert.ok(text.trim(),code+':'+key);
   assert.ok(!/\[[A-Z-]+\]/.test(text));
   for(const token of ENGLISH_UI[key].match(/\{[^}]+\}/g)||[])assert.ok(text.includes(token));
  }
  assert.ok(registry.SUPPORTED_LANGUAGES[code]?.nativeName);
  assert.ok(registry.LAUNCH_LANGUAGES.includes(code));
  assert.ok(registry.LANGUAGE_VOICES[code]);
 }
 assert.notEqual(registry.SUPPORTED_LANGUAGES.zh.nativeName,registry.SUPPORTED_LANGUAGES['zh-TW'].nativeName);
});
test('Arabic direction updates immediately and follows persisted preferences across documents',()=>{
 const events={}, document={documentElement:{}};
 let language='ar';
 const direction=load('localization/languageDirection.ts',{document,window:{addEventListener:(key,fn)=>events[key]=fn},localStorage:{getItem:()=>language}});
 direction.observeDocumentLanguage();
 assert.equal(document.documentElement.dir,'rtl');
 assert.equal(document.documentElement.lang,'ar');
 language='zh-TW';events.storage({key:'godlykids_app_language'});
 assert.equal(document.documentElement.dir,'ltr');
 assert.equal(document.documentElement.lang,'zh-TW');
 language='ar';events['gk:language']();assert.equal(document.documentElement.dir,'rtl');
 language='en';events.storage({key:null});assert.equal(document.documentElement.dir,'ltr');
 assert.equal(direction.languageDirection('ar-SA'),'rtl');
});
test('literal labels use prepared UI meanings without needing the network',()=>{
 const {staticTranslation}=load('localization/staticTranslations.ts',{require: name => name==='./expandedLanguages'?{ENGLISH_UI,EXPANDED_UI}:{INDONESIAN_UI:{}}});
 assert.equal(staticTranslation('Save','ar'),'حفظ');
 assert.equal(staticTranslation('Arms','zh-TW'),'手臂');
 assert.equal(staticTranslation('Resume','sw'),'Endelea');
 assert.equal(staticTranslation('Not in the UI catalog','hi'),undefined);
});
