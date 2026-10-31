import React from 'react';
import {getLivingAvatar,livingAvatarPortraitUrl} from '../../shared/livingAvatars.mjs';
import {yearClockLabel} from './calendar.mjs';
import {Icon} from './ui.jsx';
import './living-hud.css';
export function LivingHud({view,name,onTime,onSound,expanded}){
 const avatar=getLivingAvatar(new URLSearchParams(location.search).get('avatar'));
 return <div className="island-top-hud">
  <button className="island-profile-clock" onClick={onTime} aria-label={name?`Day and time. Playing as ${name}`:'Day and time'} aria-expanded={expanded}>
   <img className="island-profile-portrait" src={livingAvatarPortraitUrl(avatar.portrait)} alt={name?`${name}’s avatar`:'Your avatar'}/>
   <span className="island-clock-lines"><strong>{yearClockLabel(view.clock?.day||1)}</strong><span><Icon type={view.night?.dusk||view.night?.night?'moon':'sun'} size={22}/>{view.clock?.text||'8:00 AM'}</span></span>
  </button>
  <button className="island-bedtime" onClick={onTime} aria-label="Bedtime at 10 PM. Open day and time" aria-expanded={expanded}><svg width="34" height="38" viewBox="0 0 40 44" aria-hidden="true"><path fill="#fff3b9" d="M29 3A19 19 0 1 0 37 32 17 17 0 0 1 29 3Z"/><path fill="#fff" d="m34 5 1.1 3.1 3.3.2-2.6 2 1 3.2-2.8-1.9-2.6 1.9.9-3.2-2.6-2 3.2-.2Z"/></svg><span><strong>{view.night?.dusk?'Bedtime soon':'Bedtime'}</strong><small>10:00 PM</small></span></button>
  <button className="island-sound" aria-pressed={view.music!==false} aria-label={view.music===false?'Sound is off. Turn music on':'Sound is on. Turn music off'} onClick={onSound}><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Z"/>{view.music===false?<path d="m16 9 5 6m0-6-5 6"/>:<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>}</svg><span>Sound</span></button>
 </div>;
}

export function TasksIcon(){return <svg className="picture-icon" width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m13 6 26 5-5 34-27-5Z" fill="#96623b"/><path d="m12 5 26 5-5 32-27-5Z" fill="#d9a869" stroke="#9b6b3c" strokeWidth="1.5"/><path d="m15 9 19 4-4 25-19-4Z" fill="#fff6db"/><path d="m20 6 9 2 1-3-8-2Z" fill="#759194" stroke="#415d61" strokeWidth="2"/><path d="m16 19 2 2 4-4m-7 10 2 2 4-4" stroke="#699453" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="m24 21 6 1m-7 7 6 1" stroke="#b29b72" strokeWidth="2" strokeLinecap="round"/></svg>;}
