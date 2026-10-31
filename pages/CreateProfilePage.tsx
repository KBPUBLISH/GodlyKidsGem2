import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import ChooseAvatar from '../components/onboarding/ChooseAvatar';
import { getLivingAvatar, livingAvatarPortraitUrl } from '../shared/livingAvatars.mjs';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import './ProfileSelectionPage.css';

const CreateProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { addKid } = useUser();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [choosingAvatar, setChoosingAvatar] = useState(false);
  const [avatarId, setAvatarId] = useState('trail');
  const saved = useRef(false);
  const avatar = getLivingAvatar(avatarId);
  const valid = !!name.trim() && /^\d+$/.test(age) && Number(age) >= 1 && Number(age) <= 18;

  const create = () => {
    if (!valid || saved.current) return;
    saved.current = true;
    addKid({
      id: crypto.randomUUID(), name: name.trim(), age: Number(age),
      worldAvatarId: avatar.id, avatarSeed: avatar.portrait, avatar: avatar.portrait,
      coins: 500, coinTransactions: [], ownedItems: ['f1', 'anim1'], unlockedVoices: [],
      frame: 'border-[#8B4513]', hat: null, body: null, leftArm: null, rightArm: null,
      legs: null, animation: 'anim-breathe',
    });
    navigate('/profile');
  };

  if (choosingAvatar) return <ChooseAvatar selectedId={avatarId} onSelect={setAvatarId}
    onBack={() => setChoosingAvatar(false)} onConfirm={create}/>;

  return <main className="explorer-page">
    <div className="explorer-shell">
      <header className="explorer-topbar">
        <button className="explorer-icon-button" aria-label="Back to profiles" onClick={() => navigate('/profile')}><ChevronLeft size={24}/></button>
        <span>{t('createProfile')}</span><span className="explorer-topbar-spacer" aria-hidden="true"/>
      </header>
      <form className="explorer-panel" onSubmit={e => {e.preventDefault();if(valid)setChoosingAvatar(true);}}>
        <div className="explorer-heading">
          <div className="explorer-preview"><img src={livingAvatarPortraitUrl(avatar.portrait)} alt="Your explorer"/></div>
          <h1>New explorer</h1><p>Who’s joining the adventure?</p>
        </div>
        <div className="explorer-form">
          <label className="explorer-field"><span>{t('name')}</span>
            <input aria-label="Child’s name" type="text" required maxLength={40} autoComplete="off" value={name} onChange={e=>setName(e.target.value)}/>
          </label>
          <label className="explorer-field"><span>{t('age')}</span>
            <input aria-label="Child’s age" type="number" required min="1" max="18" step="1" value={age} onChange={e=>setAge(e.target.value)}/>
          </label>
        </div>
        <div className="explorer-actions"><button type="submit" className="explorer-action explorer-teal" disabled={!valid}>Continue</button></div>
      </form>
    </div>
  </main>;
};
export default CreateProfilePage;
