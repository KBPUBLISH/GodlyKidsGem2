import React from 'react';
import './resident-line.css';

/** One short thought on a character tap; the island remains playable around it. */
export function ResidentLine({name,line,onDismiss}) {
  if (!line?.text) return null;
  return <aside className="resident-line" aria-label={`${name} says`} onPointerDown={event => event.stopPropagation()}>
    <strong>{name}</strong>
    <p role="status" aria-live="polite" aria-atomic="true">{line.text}</p>
    <button type="button" onClick={onDismiss} aria-label={`Dismiss ${name}’s message`}><span aria-hidden="true">×</span></button>
  </aside>;
}
