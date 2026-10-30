import React,{useEffect,useState} from 'react';
import './resident-line.css';

/** One short thought on a character tap; the island remains playable around it. `actions` keeps the card up until a button is chosen. */
export function ResidentLine({name,line,onDismiss,actions,above}) {
  if (!line?.text) return null;
  const asking = actions?.length > 0;
  return <aside className={`resident-line${asking ? ' resident-line-ask' : ''}${above ? ' above' : ''}`} aria-label={`${name} says`} onPointerDown={event => event.stopPropagation()}>
    <strong>{name}</strong>
    <p role="status" aria-live="polite" aria-atomic="true">{line.text}</p>
    {asking
      ? <div className="resident-line-actions">{actions.map(action => <button key={action.id} type="button" disabled={!!action.disabled} onClick={event => { event.stopPropagation(); action.onClick?.(); }}>{action.label}</button>)}</div>
      : <button type="button" onClick={onDismiss} aria-label={`Dismiss ${name}’s message`}><span aria-hidden="true">×</span></button>}
  </aside>;
}

/** Eve's mealtime ask, using the same chat card as a friend's spoken line. */
export function MealAsk({engine,enabled}) {
  const [card,setCard] = useState(null);
  useEffect(() => {
    if (!enabled) { setCard(null); return; }
    let frame;
    const update = () => { setCard(engine.current?.dining?.askCard?.() || null); frame = requestAnimationFrame(update); };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [engine, enabled]);
  if (!enabled || !card) return null;
  return <ResidentLine name={card.name} line={{text: card.text}} actions={[
    {id: 'go', label: card.goLabel, onClick: () => engine.current?.dining?.acceptAsk?.()},
    {id: 'wait', label: 'Not yet', onClick: () => engine.current?.dining?.declineAsk?.()},
  ]} />;
}

/** Abel, Noah, or Adam asking the kid to tap the ground. Hidden while Eve's meal card is up. */
export function SiteAsk({engine,enabled}) {
  const [card,setCard] = useState(null);
  useEffect(() => {
    if (!enabled) { setCard(null); return; }
    let frame;
    const update = () => { setCard(engine.current?.buildAsk?.card?.() || null); frame = requestAnimationFrame(update); };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [engine, enabled]);
  if (!enabled || !card) return null;
  return <ResidentLine name={card.name} line={{text: card.text}} actions={[
    {id: 'go', label: card.goLabel, disabled: card.goEnabled === false, onClick: () => engine.current?.buildAsk?.accept?.()},
    {id: 'wait', label: card.waitLabel || 'Not now', onClick: () => engine.current?.buildAsk?.decline?.()},
  ]} />;
}
