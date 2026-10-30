import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

/** Build preview styles here instead of compiling them on every child's phone. */
export default function previewStyles(enabled) {
  return {
    name: 'preview-styles',
    async transformIndexHtml(html) {
      if (!enabled) return html;
      const result = await postcss([tailwindcss({
        content: ['./index.html', './App.tsx', './{pages,components,context,hooks,utils,services,localization}/**/*.{tsx,ts,jsx,js}'],
        theme: {extend: {
          colors: {'gk-blue-dark':'#0c2e4e','gk-blue-light':'#2a9df4','gk-wood':'#8B4513','gk-wood-light':'#A0522D','gk-gold':'#FFD700'},
          fontFamily: {sans:['Nunito','sans-serif'],display:['Fredoka','sans-serif']},
        }},
      })]).process('@tailwind base; @tailwind components; @tailwind utilities;', {from: undefined});
      return html.replace('<script src="https://cdn.tailwindcss.com"></script>', `<style data-preview-styles>${result.css}</style>`)
        .replace(/<script>\s*tailwind\.config\s*=[\s\S]*?<\/script>/, '');
    },
  };
}
