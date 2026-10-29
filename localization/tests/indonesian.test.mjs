import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const catalog = {exports:{}};
vm.runInNewContext(ts.transpileModule(read('localization/indonesian.ts'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS}
}).outputText, catalog);

test('Indonesian has complete nonempty coverage of the English interface catalog', () => {
  const ast = ts.createSourceFile('context.tsx', read('context/LanguageContext.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let english;
  function visit(node) {
    if(ts.isVariableDeclaration(node) && node.name.getText(ast)==='UI_TRANSLATIONS')
      english=node.initializer.properties.find(p=>p.name?.getText(ast)==='en').initializer;
    ts.forEachChild(node,visit);
  }
  visit(ast);
  const keys=english.properties.map(p=>p.name.getText(ast));
  assert.deepEqual(Object.keys(catalog.exports.INDONESIAN_UI).sort(),keys.sort());
  for(const key of keys) assert.ok(catalog.exports.INDONESIAN_UI[key].trim(),key);
});

function translationRouter() {
  const routes=new Map(), requests=[], cacheWrites=[];
  const router=Object.fromEntries(['get','post','delete'].map(method=>[method,(path,fn)=>routes.set(method+' '+path,fn)]));
  const models={findOne:async()=>null,updateOne:async(...args)=>cacheWrites.push(args)};
  const context={module:{exports:{}},console,AbortSignal,process:{env:{GOOGLE_TRANSLATE_API_KEY:'test-only-key'}},
    require(name){if(name==='express')return{Router:()=>router};if(name==='crypto')return crypto;if(name==='mongoose')return{Types:{ObjectId:{isValid:()=>false}}};if(name.endsWith('translationError'))return{classifyTranslationError:()=> 'provider_error'};return models;},
    async fetch(url,options){requests.push(JSON.parse(options.body));return{ok:true,json:async()=>({data:{translations:[{translatedText:'Teks Indonesia'}]}})};}
  };
  vm.runInNewContext(read('backend/src/routes/translate.js'),context);
  async function call(route,query={},body={},params={}) {
    const res={statusCode:200,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
    await routes.get(route)({query,body,params},res);return res;
  }
  return {call,requests,cacheWrites};
}

test('Indonesian is accepted by the shared text and batch translation routes',async()=>{
  const api=translationRouter();
  assert.equal((await api.call('get /languages')).body.id,'Indonesian');
  const one=await api.call('post /text',{lang:'id'},{text:'Build a home together'});
  assert.equal(one.statusCode,200);assert.equal(one.body.translatedText,'Teks Indonesia');
  const batch=await api.call('post /texts',{lang:'id'},{texts:['My bag','Garden']});
  assert.equal(batch.statusCode,200);assert.equal(batch.body.translations.length,2);
  assert.equal(api.requests.length,3);
  for(const request of api.requests)assert.equal(request.target,'id');
  assert.equal(api.cacheWrites[0][0].languageCode,'id');
});

test('reader accepts Indonesian and unsupported codes still fail before provider calls',async()=>{
  const api=translationRouter();
  const page=await api.call('get /page/:pageId',{lang:'id'},{},{pageId:'the-end-page'});
  assert.equal(page.statusCode,200);assert.equal(page.body.languageCode,'id');
  const invalid=await api.call('post /text',{lang:'invalid'},{text:'Hello'});
  assert.equal(invalid.statusCode,400);assert.equal(api.requests.length,0);
});
