"""Render profile icons from the same 3D designs. Run the Vite dev server on port 3001 first."""
import asyncio,base64,os,shutil,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
BASE=os.environ.get('AVATAR_AUTHORING_URL','http://127.0.0.1:3001')
async def main():
 html=Path('public/__avatar-authoring.html')
 if html.exists():raise RuntimeError('Temporary authoring page already exists')
 html.write_text('<!doctype html><html><body style="margin:0"><div id="portrait" style="width:256px;height:256px"></div></body></html>')
 output=Path('public/avatars/adventurers');output.mkdir(parents=True,exist_ok=True)
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
   page=await browser.new_page(viewport={'width':256,'height':256},device_scale_factor=1)
   await page.goto(BASE+'/__avatar-authoring.html')
   avatars=await page.evaluate("async()=> (await import('/shared/livingAvatars.mjs')).LIVING_AVATARS")
   for avatar in avatars:
    png=await page.evaluate("""async id=>{
     const {createAvatarPreview}=await import('/components/onboarding/avatarPreviewScene.ts');
     const scene=createAvatarPreview(document.getElementById('portrait'),id,true);
     const png=scene.portrait();scene.dispose();return png.split(',')[1];
    }""",avatar['id'])
    (output/(avatar['id']+'.png')).write_bytes(base64.b64decode(png))
   await browser.close()
  subprocess.run(['node','--input-type=module','-e',"""
import sharp from 'sharp';import {LIVING_AVATARS} from './shared/livingAvatars.mjs';
for(const avatar of LIVING_AVATARS)await sharp('public'+avatar.portrait).webp({quality:85}).toFile('public'+avatar.portrait.replace('.png','.webp'));
"""],check=True)
  print('Rendered all six matching profile portraits from the island models.')
 finally:html.unlink(missing_ok=True)
if __name__=='__main__':asyncio.run(main())
