import React, { useState } from 'react';
import { Check, ArrowRight, Compass } from 'lucide-react';
import './LanguagePicker.css';
import { useLanguage } from '../../context/LanguageContext';
export const LAUNCH_LANGUAGES = ['en', 'tl', 'pt', 'fr', 'de', 'it', 'ko', 'es', 'pl'];
const CONTINUE: Record<string,string> = {en:'Continue',tl:'Magpatuloy',pt:'Continuar',fr:'Continuer',de:'Weiter',it:'Continua',ko:'계속',es:'Continuar',pl:'Dalej'};
const REGIONS: Record<string,string> = {en:'United States',tl:'Pilipinas',pt:'Brasil',fr:'France',de:'Deutschland',it:'Italia',ko:'대한민국',es:'Latinoamérica',pl:'Polska'};
const COPY: Record<string,[string,string,string]> = {
en:['Choose your language','Your adventure, in your language.','Music and video audio stay in their original language. You can change your language in Settings.'],
tl:['Piliin ang iyong wika','Ang iyong pakikipagsapalaran, sa iyong wika.','Mananatili sa orihinal na wika ang musika at audio ng video. Maaari mong baguhin ang wika sa Mga Setting.'],
pt:['Escolha seu idioma','Sua aventura, no seu idioma.','As músicas e o áudio dos vídeos permanecem no idioma original. Você pode mudar o idioma nas Configurações.'],
fr:['Choisissez votre langue','Votre aventure, dans votre langue.','La musique et le son des vidéos restent dans leur langue originale. Vous pouvez changer de langue dans les paramètres.'],
de:['Wähle deine Sprache','Dein Abenteuer in deiner Sprache.','Musik und Videos bleiben in ihrer Originalsprache. Du kannst die Sprache in den Einstellungen ändern.'],
it:['Scegli la tua lingua','La tua avventura, nella tua lingua.','La musica e l’audio dei video restano nella lingua originale. Puoi cambiare lingua nelle Impostazioni.'],
ko:['언어를 선택하세요','여러분의 언어로 즐기는 모험.','음악과 동영상의 음성은 원래 언어로 유지됩니다. 설정에서 언어를 변경할 수 있습니다.'],
es:['Elige tu idioma','Tu aventura, en tu idioma.','La música y el audio de los videos permanecen en su idioma original. Puedes cambiar el idioma en Configuración.'],
pl:['Wybierz swój język','Twoja przygoda w Twoim języku.','Muzyka i dźwięk filmów pozostają w oryginalnym języku. Język możesz zmienić w ustawieniach.'],
};
export default function LanguagePicker({onComplete}: {onComplete:()=>void}) {
  const {currentLanguage, setLanguage, supportedLanguages} = useLanguage();
  const [selected,setSelected] = useState(LAUNCH_LANGUAGES.includes(currentLanguage) ? currentLanguage : 'en');
  const copy = COPY[selected] || COPY.en;
  return <main className="language-screen" aria-labelledby="language-title" lang={selected}>
    <div className="language-ocean" aria-hidden="true"><div/><div/><div/></div>
    <div className="language-shell">
      <div className="language-brand" aria-hidden="true"><Compass size={22}/><span data-no-localize="true">GODLY KIDS</span></div>
      <section className="language-panel">
        <header className="language-header">
          <div className="language-globe" aria-hidden="true"><img src="/assets/images/language/language-globe-v1.png" alt="" width="112" height="112"/></div>
          <h1 id="language-title">{copy[0]}</h1>
          <p>{copy[1]}</p>
        </header>
        <div className="language-grid" role="group" aria-labelledby="language-title">
          {LAUNCH_LANGUAGES.map(code=>{
            const lang=supportedLanguages[code];
            const active=selected===code;
            return <button key={code} type="button" lang={code} aria-pressed={active} onClick={()=>setSelected(code)} className={`language-option${active?' is-selected':''}`}>
              <span className="language-flag" aria-hidden="true">{lang.flag}</span>
              <span className="language-name"><strong>{lang.nativeName}</strong><span>{REGIONS[code]}</span></span>
              <span className="language-check" aria-hidden="true">{active&&<Check size={14} strokeWidth={3}/>}</span>
            </button>;
          })}
        </div>
        <footer className="language-footer">
          <button type="button" className="language-continue" onClick={()=>{setLanguage(selected);localStorage.setItem('godlykids_language_selected','true');onComplete();}}>
            <span>{CONTINUE[selected]||CONTINUE.en}</span><ArrowRight size={21} aria-hidden="true"/>
          </button>
          <p>{copy[2]}</p>
        </footer>
      </section>
    </div>
  </main>;
}
