import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root=new URL('../../',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
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


for(const lang of ['id','hi','ta','ml','ar','sw','zh-TW']) test(`${lang} reaches text, batch and reader routes with its exact provider code`,async()=>{
 const api=translationRouter();
 assert.ok((await api.call('get /languages')).body[lang]);
 assert.equal((await api.call('post /text',{lang},{text:'Welcome to your island!'})).statusCode,200);
 assert.equal((await api.call('post /texts',{lang},{texts:['My bag','Build a home']})).body.translations.length,2);
 assert.equal((await api.call('get /page/:pageId',{lang},{},{pageId:'the-end-page'})).body.languageCode,lang);
 assert.equal(api.requests.length,3);
 for(const req of api.requests)assert.equal(req.target,lang);
 assert.equal(api.cacheWrites[0][0].languageCode,lang);
});
test('unsupported language cannot reach the translation provider',async()=>{
 const api=translationRouter();
 assert.equal((await api.call('post /text',{lang:'invalid'},{text:'Hello'})).statusCode,400);
 assert.equal(api.requests.length,0);
});
