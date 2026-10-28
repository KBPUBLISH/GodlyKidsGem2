import React from 'react';
import {Icon} from './ui.jsx';
export function NightRest({night}){
 if(!night?.sleeping)return null;
 return <div className="night-curtain"><section className="night-rest" role="status" aria-live="polite"><small className="night-bedtime">10 PM · Bedtime</small><Icon type="moon" size={48}/><strong>Good night, island!</strong><p>Everyone is resting.</p><small>Morning in {night.remaining} {night.remaining===1?'second':'seconds'}…</small><progress aria-label="Night rest" value={night.nightProgress} max="1"/></section></div>;
}
