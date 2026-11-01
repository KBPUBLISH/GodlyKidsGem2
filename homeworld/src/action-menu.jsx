import React from 'react';
import {Icon,ItemIcon,ActionButton,TOOLS} from './ui.jsx';
import {BuildMenu} from './building-ui.jsx';
import {AnimalFarm} from './animals-ui.jsx';
import {LIVING_TEST} from './storage-scope.mjs';
import {TemplatePicker} from './garden-templates.jsx';

const TABS=[{id:'actions',name:'Actions',icon:'actions'},{id:'build',name:'Build',icon:'build'},{id:'farm',name:'Farm',icon:'plant'},{id:'decorate',name:'Decorate',icon:'rest'}];
const HARVEST={id:'harvest',name:'Harvest',color:'#527c38',soft:'#edf6d9'};
const HINTS={walk:'Tap a tree to gather wood.',axe:'Tap a tree to gather wood.',mine:'Rocks use 5 energy per hit.',hoe:'Tap clear grass to walk there and dig.',plant:'Tap an empty garden plot.',water:'Tap a plant to help it grow.',fish:'Tap water to cast your line.'};

export const QUICK_TOOLS=[HARVEST,...TOOLS];
export function ActionMenu({view,tab,onTab,onClose,onEquip,onRun,onPanel,onPick,buildProps,seed}){
  const farm=tab==='farm',tool=view.tool,choices=farm?[HARVEST,...TOOLS.filter(t=>['hoe','plant','water'].includes(t.id))]:[HARVEST,...TOOLS];
  const ready=farm&&!['hoe','plant','water'].includes(tool)?'hoe':(HINTS[tool]?tool:'walk');
  const choose=id=>{onPick?.(id);return id==='food'?onPanel('food'):id==='harvest'?onRun(g=>g.nutrition.harvestFood()):onEquip(id);};
  const primary={
    walk:{icon:'axe',name:'Chop a tree',run:g=>g.nearestTree()},
    axe:{icon:'axe',name:'Chop a tree',run:g=>g.nearestTree()},
    mine:{icon:'mine',name:'Smash a rock',run:g=>g.mining.nearest()},
    hoe:{icon:'hoe',name:'Choose a spot',run:g=>g.setTool('hoe')},
    plant:{icon:'plant',name:`Plant ${seed.name.toLowerCase()}`,run:g=>g.gardenAction('plant')},
    water:{icon:'water',name:'Water a plant',run:g=>g.gardenAction('water')},
    fish:{icon:'fish',name:'Catch a fish',run:g=>g.nutrition.goFish()},
  }[ready];
  const switchTab=(e,index)=>{
    const key=e.key;if(!['ArrowLeft','ArrowRight','Home','End'].includes(key))return;
    e.preventDefault();const next=key==='Home'?0:key==='End'?3:(index+(key==='ArrowRight'?1:3))%4;
    onTab(TABS[next].id);e.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  };
  return <section id="action-menu" className="action-menu panel" role="region" aria-label="Action menu">
    <button className="collapse-actions" onClick={onClose} aria-label="Close action menu"><span aria-hidden="true">⌄</span></button>
    <div className="action-menu-tabs" role="tablist" aria-label="Island activities">{TABS.map((t,i)=><button key={t.id} id={`activity-${t.id}`} role="tab" aria-selected={tab===t.id} aria-controls="activity-content" tabIndex={tab===t.id?0:-1} onKeyDown={e=>switchTab(e,i)} onClick={()=>onTab(t.id)}><Icon type={t.icon} size={26}/><span>{t.name}</span></button>)}</div>
    <div className="action-menu-content" id="activity-content" role="tabpanel" aria-labelledby={`activity-${tab}`}>
      {tab==='build'||tab==='decorate'?<BuildMenu onTemplate={id=>onRun(g=>g.buildAsk?.startGardenPreset(id))} key={tab} view={view} {...buildProps} compact allowedCategories={tab==='decorate'?['Decorations','Paths','Fences']:null}/>:<>
        <div className="action-options" role="group" aria-label={farm?'Garden actions':'Choose an action'}>{choices.map(t=>{const selected=tool===t.id;return <button key={t.id} aria-label={t.name} aria-pressed={t.id==='food'||t.id==='harvest'?undefined:selected} className={`tool-button ${selected?'selected':''}`} style={{'--tool-color':t.color,'--tool-soft':t.soft}} onClick={()=>choose(t.id)}><span className="tool-picture"><Icon type={t.id}/></span><span className="tool-name">{t.name}</span>{selected&&<span className="chosen-mark" aria-hidden="true">✓</span>}</button>;})}</div>
        {!farm&&<button className={`action-sleep-shortcut ${view.nutrition.lowEnergy?'is-tired':''}`} onClick={()=>onPanel('sleep')}><Icon type="rest" size={28}/><strong>Rest at home</strong><small>{view.nutrition.sleep?'Sleeping':view.nutrition.lowEnergy?'Low energy':'Recharge'} →</small></button>}
        {!farm&&!view.playersOnly&&!view.livingTest&&<button className="action-sleep-shortcut community-shortcut" onClick={()=>onPanel('community')}><Icon type="plant" size={28}/><strong>Our community</strong><small>Eve & Noah →</small></button>}
        {(farm||tool==='plant')&&<button className="seed-strip" onClick={()=>onPanel('catalogue')} aria-label={`Choose seed. Selected: ${seed.name}`}><ItemIcon id={seed.id} size={30}/><strong>{seed.name}</strong><small>{view.state.inventory[seed.id]||0} seeds</small><em>Choose →</em></button>}
        {farm&&<BuildMenu view={view} {...buildProps} compact allowedCategories={['Farm']}/>}
        {farm&&<TemplatePicker onChoose={id=>onRun(g=>g.buildAsk?.startGardenPreset(id))}/>}
        {tool==='mine'&&!farm&&<button className="action-extra" onClick={()=>onPanel('tools')}>Better tools →</button>}
        {primary&&<div className="menu-primary"><ActionButton icon={primary.icon} disabled={view.busy||(ready==='fish'&&view.nutrition.energy<4)} onClick={()=>onRun(primary.run)}>{primary.name}</ActionButton><span>{HINTS[ready]}</span></div>}
        {farm&&<p className="action-menu-tip">Choose Dig, then tap clear grass to walk there and dig. Plant and water your new spot.</p>}

        {farm&&!LIVING_TEST&&!view.livingTest&&<AnimalFarm view={view} onRun={onRun}/>}
      </>}
    </div>
  </section>;
}
