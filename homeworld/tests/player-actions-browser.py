"""Actual starter planting, interruption, and world dig/plant/water/chop animations."""
import asyncio,os,runpy,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ns=runpy.run_path(str(Path(__file__).with_name('living-test-browser.py')))
BASE=os.environ.get('LIVING_ISLAND_TEST_URL','http://127.0.0.1:3000/').rstrip('/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':600,'height':750},has_touch=True)
  await ctx.route('**/api/**',ns['api']);await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(BASE+'/#/my-home');await page.wait_for_selector('iframe');frame=page.frames[-1]
  await frame.wait_for_function('window.__hw?.loaded',timeout=90000);await ns['quality'](frame)
  async def portrait(name):
   # Hide foreground scenery only in inspection portraits so joints and tools stay visible.
   await frame.evaluate('''()=>{const g=window.__hw;g.loaded=false;window.actionCamera={zoom:g.zoom,pos:g.camera.position.clone(),quat:g.camera.quaternion.clone(),hidden:[...g.treeBatches.map(b=>b.mesh),...g.staticMeshes.filter(m=>!Object.values(g.bakedMaterials).includes(m.material)),...Array.from(g.mining.nodes.values(),n=>n.group)].map(o=>[o,o.visible])};window.actionCamera.hidden.forEach(([o])=>o.visible=false);g.zoom=3.5;g.updateProjection();const offset=g.actor.position.clone().set(3,2.5,4).applyAxisAngle(g.actor.up,g.actor.rotation.y);g.camera.position.copy(g.actor.position).add(offset);g.camera.lookAt(g.actor.position.clone().add(g.actor.up.clone().multiplyScalar(.75)));for(let i=0;i<8;i++)g.renderer.render(g.scene,g.camera);}''')
   style=await frame.add_style_tag(content='.topbar,.side-buttons,.living-intro-layer,.ship-button,.recent-tools,.harvest-prompt,.toast,.resource-health{visibility:hidden!important}')
   await page.screenshot(path=f'/tmp/player-action-{name}.png')
   await style.evaluate('e=>e.remove()')
   await frame.evaluate('''()=>{const g=window.__hw,c=window.actionCamera;g.zoom=c.zoom;g.updateProjection();g.camera.position.copy(c.pos);g.camera.quaternion.copy(c.quat);c.hidden.forEach(([o,v])=>o.visible=v);g.loaded=true;}''')
  await frame.get_by_role('button',name='Plant 4 carrot seeds. 0 of 4',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.garden.work?.poseAudit?.phase==="scatter"',timeout=90000)
  pose=await frame.evaluate('window.__hw.livingTest.garden.work.poseAudit');assert pose['bend']>.4 and pose['footDrift']<.035,pose
  assert await frame.evaluate('window.__hw.tools.seed_pouch.visible&&window.__hw.livingTest.actions.seeds.some(s=>s.visible)')
  await portrait('plant')
  await frame.wait_for_function('window.__hw.livingTest.farm.state.garden.planted===1',timeout=30000)
  assert not await frame.evaluate('window.__hw.livingTest.actions.group.visible||window.__hw.tools.seed_pouch.visible')
  assert await frame.evaluate('window.__hw.livingTest.farm.state.coins')==0
  # Leaving mid-animation must not plant, pay, or leave a floating bag behind.
  await frame.get_by_role('button',name='Plant a carrot seed',exact=True).click()
  await frame.wait_for_function('window.__hw.livingTest.garden.work?.elapsed>.4',timeout=30000)
  await frame.evaluate('window.__hw.walk({...window.__hw.player})')
  await page.wait_for_timeout(2500)
  assert await frame.evaluate('window.__hw.livingTest.farm.state.garden.planted')==1
  assert not await frame.evaluate('window.__hw.livingTest.garden.work||window.__hw.livingTest.actions.group.visible||window.__hw.tools.seed_pouch.visible')
  print('PASS: starter crouch, seed scattering, planted feet, single saved planting and clean interruption',flush=True)
  # Exercise the real garden commands on an unused square outside the starter patch.
  key=await frame.evaluate('''()=>{const g=window.__hw,used=new Set(g.livingTest.garden.plots.map(p=>p.key));for(const s of g.world.gardenSlots)if(!used.has(s.key)&&g.gardenAction('plow',s.key)===true)return s.key;throw Error('No reachable dig spot');}''')
  await frame.wait_for_function('window.__hw.action?.type==="plow"&&window.__hw.action.t>1',timeout=90000)
  assert await frame.evaluate('window.__hw.tools.hoe.visible&&window.__hw.bones.mixamorigSpine.rotation.x>.1')
  await portrait('dig')
  await frame.wait_for_function('!window.__hw.action',timeout=30000)
  assert await frame.evaluate('(key)=>window.__hw.store.state.cells[key]?.soil',key)=='tilled'
  before=await frame.evaluate('window.__hw.store.state.inventory.carrot_seed')
  await frame.evaluate('(key)=>{window.__hw.setSeed("carrot_seed");window.__hw.gardenAction("plant",key);}',key)
  await frame.wait_for_function('window.__hw.action?.poseAudit?.phase==="scatter"',timeout=90000)
  assert await frame.evaluate('window.__hw.action.poseAudit.footDrift')<.035
  await frame.wait_for_function('!window.__hw.action',timeout=30000)
  assert await frame.evaluate('window.__hw.store.state.inventory.carrot_seed')==before-1
  assert await frame.evaluate('(key)=>window.__hw.gardenAction("water",key)',key)
  await frame.wait_for_function('window.__hw.action?.poseAudit?.phase==="pour"&&window.__hw.action.t>1',timeout=90000)
  assert await frame.evaluate('window.__hw.tools.watering_can.visible&&window.__hw.livingTest.actions.drops.filter(d=>d.visible).length===18')
  assert await frame.evaluate('window.__hw.action.poseAudit.footDrift')<.035
  await portrait('water')
  await frame.wait_for_function('!window.__hw.action',timeout=30000)
  assert await frame.evaluate('(key)=>window.__hw.store.state.cells[key].watered',key)
  assert not await frame.evaluate('window.__hw.livingTest.actions.group.visible||window.__hw.tools.watering_can.visible')
  print('PASS: real digging, planting and continuous watering; seed debit and watered state committed once',flush=True)
  before=await frame.evaluate('window.__hw.store.state.stats.trees')
  await frame.evaluate('window.__hw.nearestTree()')
  await frame.wait_for_function('window.__hw.action?.type==="chop"&&window.__hw.action.poseAudit?.swing==="wind"',timeout=90000)
  assert await frame.evaluate('window.__hw.tools.axe.visible&&Math.abs(window.__hw.bones.mixamorigSpine.rotation.y)>.01')
  await portrait('chop')
  await frame.wait_for_function('!window.__hw.action',timeout=60000)
  assert not await frame.evaluate('window.__hw.tools.axe.visible')
  assert await frame.evaluate('window.__hw.store.state.stats.trees')==before+1
  assert not errors,errors
  print('PASS: two-hand axe wind-up, torso twist and tree reward; no browser errors',flush=True)
  await browser.close()
if __name__=='__main__':asyncio.run(main())
