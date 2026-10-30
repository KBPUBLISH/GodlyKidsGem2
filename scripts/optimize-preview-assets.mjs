// Optional asset-authoring step; see homeworld/FAST-START.md for pinned tools.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import fs from 'node:fs/promises';
const require=createRequire(resolve(process.env.PREVIEW_ASSET_TOOLS || '.', 'package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {dedup,weld,resample,draco,textureCompress}=require('@gltf-transform/functions');
const draco3d=require('draco3dgltf');
const sharp=require('sharp');
const base=resolve('public')+'/';
await fs.mkdir(base+'homeworld/assets/mobile',{recursive:true});
await fs.mkdir(base+'models/mobile',{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.encoder':await draco3d.createEncoderModule(),'draco3d.decoder':await draco3d.createDecoderModule()});
for(const name of ['environment','library','construction','house-upgrades','wood-storage','church','adam','perry']){
 const input=name==='perry'?'models/perry-flight-essentials.glb':`homeworld/assets/${name}.glb`,output=name==='perry'?'models/mobile/perry-flight.glb':`homeworld/assets/mobile/${name}.glb`;
 const doc=await io.read(base+input);
 await doc.transform(dedup(),weld(),resample(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:85}),draco());
 await io.write(base+output,doc);
 console.log(name,(await fs.stat(base+input)).size,'->',(await fs.stat(base+output)).size);
}
