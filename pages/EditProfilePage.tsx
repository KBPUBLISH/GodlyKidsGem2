import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { t } = useLanguage();
  const { 
    currentProfileId, 
    parentName, 
    setParentName, 
    kids, 
    updateKid, 
    removeKid,
    equippedAvatar,
    setEquippedAvatar
  } = useUser();
  
  // Determine if editing parent or kid
  const isParentProfile = currentProfileId === null;
  const currentKid = kids.find(k => k.id === currentProfileId);
  
  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [selectedHead, setSelectedHead] = useState(FUNNY_HEADS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form with current profile data
  useEffect(() => {
    if (isParentProfile) {
      setName(parentName || '');
      setSelectedHead(equippedAvatar || FUNNY_HEADS[0]);
      // Parent doesn't have age
      setAge('');
    } else if (currentKid) {
      setName(currentKid.name || '');
      setAge(currentKid.age?.toString() || '');
      setSelectedHead(currentKid.avatar || currentKid.avatarSeed || FUNNY_HEADS[0]);
    }
  }, [isParentProfile, parentName, equippedAvatar, currentKid]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (isParentProfile) {
      // Update parent profile
      setParentName(name.trim());
      if (selectedHead !== equippedAvatar) {
        setEquippedAvatar(selectedHead);
      }
    } else if (currentKid) {
      // Update kid profile
      updateKid(currentKid.id, {
        name: name.trim(),
        age: age ? parseInt(age, 10) : currentKid.age,
        avatar: selectedHead,
        avatarSeed: selectedHead
      });
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
            <h1 id="edit-profile-title">{name.trim() || t('editProfile')}</h1>
            <p>{isParentProfile ? 'Change the name and look.' : 'Change the name, age and look.'}</p>
          </div>
          <div className="explorer-form">
            <label className="explorer-field">
              <span>{t('name')}</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${t('name')}...`} data-no-localize="true" />
            </label>
            {!isParentProfile && (
              <label className="explorer-field">
                <span>{t('age')}</span>
                <input type="number" min="1" max="18" value={age} onChange={(e) => setAge(e.target.value)} placeholder={t('howOldAreYou')} />
                <small>{t('ageAppropriate')}</small>
              </label>
            )}
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
            {!isParentProfile && (
              <button type="button" className="explorer-action explorer-danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={18}/><span>{t('deleteProfile')}</span></button>
            )}
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

