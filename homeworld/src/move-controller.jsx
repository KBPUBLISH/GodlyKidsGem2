import React from 'react';
import './move-controller.css';
export function MovePad({valid,onMove}){
 return <div className={`move-pad ${valid?'fits':'blocked'}`} role="group" aria-label="Move your building"><button className="move-up" aria-label="Move building up" onClick={()=>onMove(-1,1)}>↑</button><button className="move-left" aria-label="Move building left" onClick={()=>onMove(-1,-1)}>←</button><span className="move-fit" aria-label={valid?'Fits here':'Does not fit'}>{valid?'✓':'×'}</span><button className="move-right" aria-label="Move building right" onClick={()=>onMove(1,1)}>→</button><button className="move-down" aria-label="Move building down" onClick={()=>onMove(1,-1)}>↓</button></div>;
}
export function CoopMoveController({valid,onMove,onConfirm,onCancel}){
 return <section className={`coop-move-controller ${valid?'fits':'blocked'}`} aria-label="Move chicken coop"><div><strong>Move your coop</strong><p role="status">{valid?'✓ It fits here!':'× Needs more room'}</p><small>Tap the ground or use the arrows.</small></div><MovePad valid={valid} onMove={onMove}/><div className="coop-move-actions"><button onClick={onCancel}>Cancel</button><button className="move-confirm" disabled={!valid} onClick={onConfirm}>Move here ✓</button></div></section>;
}
