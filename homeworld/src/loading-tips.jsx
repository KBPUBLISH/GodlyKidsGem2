import React, { useEffect, useState } from 'react';

/**
 * Quick tips shown while the island loads: a phone screenshot of the feature
 * plus one line on what to do. Pictures live in public/homeworld/icons/tips
 * (the build rewrites /icons/ to /homeworld/icons/); swap a file to update a tip.
 */
export const LOADING_TIPS = [
  { image: '/icons/tips/tip-island.webp?v=2', title: 'Tap the grass to walk', text: 'Drag sideways to look around and pinch to zoom. The buttons on the right open everything.' },
  { image: '/icons/tips/tip-actions.webp?v=2', title: 'Pick a tool, then tap', text: 'Open Build › Actions to chop trees, smash rocks, plant seeds, water, and fish.' },
  { image: '/icons/tips/tip-todo.webp?v=2', title: 'Let your crew help', text: 'Open To-do, tap who should go, and press Go. Story friends work while you play.' },
  { image: '/icons/tips/tip-build.webp?v=2', title: 'Build homes and gardens', text: 'Wood and stone become huts, fences, campfires, and garden beds. Preview an upgrade for free.' },
  { image: '/icons/tips/tip-tools.webp?v=2', title: 'Forge better tools', text: 'Copper, iron, and diamond tools chop and mine faster. Ore hides inside the rocks.' },
];

const TIP_SECONDS = 4.5;

export default function LoadingTips({ tips = LOADING_TIPS }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(true);

  // Warm every picture up front so the slideshow never shows a blank frame.
  useEffect(() => { tips.forEach((t) => { const img = new Image(); img.src = t.image; }); }, [tips]);

  useEffect(() => {
    if (tips.length < 2) return undefined;
    const advance = () => {
      setShown(false);
      window.setTimeout(() => { setIndex((i) => (i + 1) % tips.length); setShown(true); }, 260);
    };
    const id = window.setInterval(advance, TIP_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [tips]);

  const tip = tips[index];
  if (!tip) return null;
  return (
    <section className={`loading-tip ${shown ? 'shown' : ''}`} aria-live="polite" aria-label="Quick tip">
      <figure className="loading-tip-shot"><img src={tip.image} alt="" draggable={false} /></figure>
      <p className="loading-tip-kicker">Quick tip</p>
      <h2>{tip.title}</h2>
      <p className="loading-tip-text">{tip.text}</p>
      <div className="loading-tip-dots" aria-hidden="true">
        {tips.map((t, i) => <i key={t.image} className={i === index ? 'on' : ''} />)}
      </div>
    </section>
  );
}
