import {cp,mkdir,copyFile,access} from 'node:fs/promises';
await access('dist/index.html');
await access('homeworld/dist/index.html');
await mkdir('dist/homeworld/assets',{recursive:true});
await cp('homeworld/dist/assets','dist/homeworld/assets',{recursive:true});
await copyFile('homeworld/dist/index.html','dist/homeworld/living-test.html');
console.log('Original-island test entry prepared in dist/homeworld/living-test.html');
