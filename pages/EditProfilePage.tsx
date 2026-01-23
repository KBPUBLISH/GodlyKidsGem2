import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2 } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
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

  return (
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar px-6 py-6">
      
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        className="absolute top-6 left-6 z-30 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 active:scale-95 transition-transform"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="flex-1 flex flex-col items-center pt-12 pb-10 max-w-md mx-auto w-full">
          
          {/* Header Sign */}
          <div className="relative mb-8 animate-in slide-in-from-top-10 duration-700">
             <div className="relative bg-[#CD853F] px-8 py-3 rounded-xl border-b-[6px] border-[#8B4513] shadow-xl">
                 <div className="absolute inset-0 opacity-20 rounded-xl pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
                <h1 className="relative font-display font-extrabold text-[#5c2e0b] text-xl tracking-widest drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] uppercase">
                  {t('editProfile')}
                </h1>
                {/* Nails */}
                <div className="absolute top-1/2 -translate-y-1/2 left-2 w-2 h-2 bg-[#3e1f07] rounded-full"></div>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2 h-2 bg-[#3e1f07] rounded-full"></div>
             </div>
          </div>

          {/* Main Avatar Preview */}
          <div className="w-40 h-40 rounded-full border-[6px] border-white shadow-[0_0_30px_rgba(255,255,255,0.3)] bg-[#f3e5ab] mb-8 relative overflow-hidden animate-in zoom-in duration-500 flex items-center justify-center">
               {AVATAR_ASSETS[selectedHead] ? (
                  <div className="w-[90%] h-[90%]">
                     <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                         {AVATAR_ASSETS[selectedHead]}
                     </svg>
                  </div>
               ) : (
                  <img src={selectedHead} alt="Selected Avatar" className="w-full h-full object-cover" />
               )}
          </div>

          {/* Name Input */}
          <div className="w-full mb-4 space-y-2">
            <label className="text-[#eecaa0] font-display font-bold ml-2 text-sm tracking-wide">{t('name').toUpperCase()}</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${t('name')}...`}
              className="w-full bg-black/30 backdrop-blur-sm border-2 border-[#eecaa0]/50 rounded-xl px-5 py-4 text-white font-display text-lg placeholder:text-white/40 focus:outline-none focus:border-[#eecaa0] transition-colors shadow-inner text-center"
            />
          </div>

          {/* Age Input - Only for kids */}
          {!isParentProfile && (
            <div className="w-full mb-8 space-y-2">
              <label className="text-[#eecaa0] font-display font-bold ml-2 text-sm tracking-wide">{t('age').toUpperCase()}</label>
              <input 
                type="number" 
                min="1"
                max="18"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={t('howOldAreYou')}
                className="w-full bg-black/30 backdrop-blur-sm border-2 border-[#eecaa0]/50 rounded-xl px-5 py-4 text-white font-display text-lg placeholder:text-white/40 focus:outline-none focus:border-[#eecaa0] transition-colors shadow-inner text-center"
              />
              <p className="text-[#eecaa0]/60 text-xs text-center">{t('ageAppropriate')}</p>
            </div>
          )}

          {/* Avatar Selection Grid */}
          <div className="w-full mb-8">
             <label className="text-[#eecaa0] font-display font-bold ml-2 text-sm tracking-wide mb-3 block">{t('chooseALook').toUpperCase()}</label>
             <div className="grid grid-cols-5 gap-3">
                {FUNNY_HEADS.map((head) => (
                   <button
                     key={head}
                     onClick={() => setSelectedHead(head)}
                     className={`aspect-square rounded-full overflow-hidden border-2 transition-all duration-200 flex items-center justify-center bg-[#f3e5ab] p-1 ${selectedHead === head ? 'border-[#FFD700] scale-110 shadow-[0_0_15px_#FFD700]' : 'border-white/20 hover:border-white/50 opacity-80 hover:opacity-100'}`}
                   >
                      <div className="w-full h-full">
                         {AVATAR_ASSETS[head] ? (
                            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                {AVATAR_ASSETS[head]}
                            </svg>
                         ) : (
                            <img src={head} alt={head} className="w-full h-full object-cover" />
                         )}
                      </div>
                   </button>
                ))}
             </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-3">
            <WoodButton 
              fullWidth 
              variant="primary" 
              onClick={handleSave} 
              disabled={!name.trim()}
              className={`py-4 text-xl transition-opacity ${!name.trim() ? 'opacity-50 grayscale' : 'opacity-100'}`}
            >
              {t('saveChanges').toUpperCase()}
            </WoodButton>

            {/* Delete Button - Only for kid profiles */}
            {!isParentProfile && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 rounded-xl text-red-300 font-display font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 size={20} />
                {t('deleteProfile').toUpperCase()}
              </button>
            )}
          </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#5c2e0b] rounded-2xl p-6 max-w-sm w-full border-4 border-[#8B4513] shadow-2xl">
            <h3 className="text-[#eecaa0] font-display font-bold text-xl text-center mb-4">
              {t('deleteProfile')}?
            </h3>
            <p className="text-white/80 text-center mb-6">
              {t('confirmDelete')} <span className="font-bold text-[#FFD700]">{currentKid?.name}</span>
            </p>
            <div className="flex gap-3">
              <WoodButton 
                variant="light" 
                fullWidth 
                onClick={() => setShowDeleteConfirm(false)}
                className="py-3"
              >
                {t('cancel').toUpperCase()}
              </WoodButton>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-white font-display font-bold transition-colors"
              >
                {t('yesDelete').toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfilePage;

