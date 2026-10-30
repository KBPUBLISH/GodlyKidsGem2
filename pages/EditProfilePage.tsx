import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Trash2, Pencil, Check } from 'lucide-react';
import './ProfileSelectionPage.css';
import { AVATAR_ASSETS } from '../components/avatar/AvatarAssets';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';

// PNG-based heads from /public/avatars/heads/
const FUNNY_HEADS = [
  '/avatars/heads/head-1.png',
  '/avatars/heads/head-2.png',
  '/avatars/heads/head-3.png',
  '/avatars/heads/head-4.png',
  '/avatars/heads/head-5.png',
  '/avatars/heads/head-6.png',
  '/avatars/heads/head-7.png',
  '/avatars/heads/head-8.png',
  '/avatars/heads/head-9.png',
  '/avatars/heads/head-11.png',
  '/avatars/heads/head-12.png',
  '/avatars/heads/head-13.png',
  '/avatars/heads/head-14.png',
  '/avatars/heads/head-15.png',
  '/avatars/heads/head-16.png',
  '/avatars/heads/head-17.png',
  '/avatars/heads/head-18.png',
  '/avatars/heads/head-19.png',
  '/avatars/heads/head-20.png',
  '/avatars/heads/head-21.png',
  '/avatars/heads/head-22.png',
  '/avatars/heads/head-23.png',
];

const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { 
    currentProfileId, 
    kids, 
    updateKid, 
    removeKid,
    setEquippedAvatar
  } = useUser();

  const stateProfileId = typeof (location.state as { profileId?: unknown } | null)?.profileId === 'string'
    ? (location.state as { profileId: string }).profileId
    : '';
  // The picker passes this kid's id. Never fall back to whoever is currently active.
  const kidId = searchParams.get('kid') || stateProfileId;
  const currentKid = kids.find(k => k.id === kidId);
  
  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [selectedHead, setSelectedHead] = useState(FUNNY_HEADS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!kidId) navigate('/profile', { replace: true });
  }, [kidId, navigate]);

  // Load this kid once, during render, so a later wallet save cannot wipe a name being typed.
  if (currentKid && loadedFor.current !== currentKid.id) {
    loadedFor.current = currentKid.id;
    setName(currentKid.name || '');
    setAge(currentKid.age?.toString() || '');
    setSelectedHead(currentKid.avatar || currentKid.avatarSeed || FUNNY_HEADS[0]);
  }

  const handleSave = () => {
    if (!currentKid || !name.trim()) return;

    updateKid(currentKid.id, {
      name: name.trim(),
      age: age ? parseInt(age, 10) : currentKid.age,
      avatar: selectedHead,
      avatarSeed: selectedHead
    });
    // The active kid's look is also stored on the live avatar. Keep them together
    // so the save doesn't write the old head back over this edit.
    if (currentProfileId === currentKid.id) {
      setEquippedAvatar(selectedHead);
    }
    
    navigate('/profile');
  };

  const handleDelete = () => {
    if (currentKid) {
      removeKid(currentKid.id);
      navigate('/profile');
    }
  };

  const renderHead = (head: string) => AVATAR_ASSETS[head]
    ? <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">{AVATAR_ASSETS[head]}</svg>
    : <img src={head} alt="" className="w-full h-full object-cover" />;

  if (!kidId || !currentKid) {
    return (
      <main className="explorer-page">
        <div className="explorer-shell">
          <header className="explorer-topbar">
            <button className="explorer-icon-button" aria-label="Back to profiles" onClick={() => navigate('/profile')}><ChevronLeft size={24}/></button>
            <span><Pencil size={20}/>{t('editProfile')}</span>
            <span className="explorer-topbar-spacer" aria-hidden="true" />
          </header>
          <section className="explorer-panel">
            <div className="explorer-heading">
              <h1>{kidId ? 'That explorer is gone' : t('editProfile')}</h1>
              <p>{kidId ? 'Pick an explorer to edit.' : 'Taking you back to explorers.'}</p>
            </div>
            <div className="explorer-actions">
              <button type="button" className="explorer-action explorer-teal" onClick={() => navigate('/profile')}>Back to explorers</button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="explorer-page">
      <div className="explorer-shell">
        <header className="explorer-topbar">
          <button className="explorer-icon-button" aria-label="Back to profiles" onClick={() => navigate('/profile')}><ChevronLeft size={24}/></button>
          <span><Pencil size={20}/>{t('editProfile')}</span>
          <span className="explorer-topbar-spacer" aria-hidden="true" />
        </header>
        <section className="explorer-panel" aria-labelledby="edit-profile-title">
          <div className="explorer-heading">
            <div className="explorer-preview">{renderHead(selectedHead)}</div>
            <h1 id="edit-profile-title" data-no-localize="true">{name.trim() || t('editProfile')}</h1>
            <p>Change the name, age and look.</p>
          </div>
          <div className="explorer-form">
            <label className="explorer-field">
              <span>{t('name')}</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${t('name')}...`} data-no-localize="true" />
            </label>
            <label className="explorer-field">
              <span>{t('age')}</span>
              <input type="number" min="1" max="18" value={age} onChange={(e) => setAge(e.target.value)} placeholder={t('howOldAreYou')} />
              <small>{t('ageAppropriate')}</small>
            </label>
            <div className="explorer-field">
              <span>{t('chooseALook')}</span>
              <div className="explorer-heads" role="radiogroup" aria-label={t('chooseALook')}>
                {FUNNY_HEADS.map((head, i) => (
                  <button key={head} type="button" role="radio" aria-checked={selectedHead === head} aria-label={`Look ${i + 1}`} onClick={() => setSelectedHead(head)} className={`explorer-head${selectedHead === head ? ' is-selected' : ''}`}>
                    {renderHead(head)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="explorer-actions">
            <button type="button" className="explorer-action explorer-save" onClick={handleSave} disabled={!name.trim()}><Check size={19}/><span>{t('saveChanges')}</span></button>
            <button type="button" className="explorer-action explorer-danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={18}/><span>{t('deleteProfile')}</span></button>
          </div>
        </section>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="explorer-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-profile-title">
          <div className="explorer-dialog">
            <h2 id="delete-profile-title">{t('deleteProfile')}?</h2>
            <p>{t('confirmDelete')} <strong data-no-localize="true">{currentKid?.name}</strong></p>
            <div className="explorer-actions">
              <button type="button" className="explorer-action" onClick={() => setShowDeleteConfirm(false)}>{t('cancel')}</button>
              <button type="button" className="explorer-action explorer-danger is-solid" onClick={handleDelete}>{t('yesDelete')}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default EditProfilePage;

