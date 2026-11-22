
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Settings, ChevronLeft, ChevronRight, ShoppingBag, Crown, Compass, Pencil, Globe, Trash2 } from 'lucide-react';
import './ProfileSelectionPage.css';
import ShopModal from '../components/features/ShopModal';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import PortholeAvatar from '../components/common/PortholeAvatar';

// Helper for random color backgrounds for kid profiles
const PROFILE_BG_COLORS = ['bg-[#F8BBD0]', 'bg-[#4FC3F7]', 'bg-[#C5E1A5]', 'bg-[#FFF59D]', 'bg-[#E1BEE7]'];

const ProfileSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    isSubscribed, 
    kids,
    switchProfile,
    removeKid,
  } = useUser();
  
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDelete = kids.find((kid) => kid.id === pendingDeleteId) ?? null;
  const { t, currentLanguage, supportedLanguages } = useLanguage();
  const lang = supportedLanguages[currentLanguage];
  /** In-app path to return to after picking a profile (e.g. '/crew'). */
  const returnTo: string | undefined =
    typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/') && !location.state.returnTo.startsWith('//')
      ? location.state.returnTo
      : undefined;
  
  // Open shop if requested via navigation state
  useEffect(() => {
    if (location.state?.openShop) {
      setIsShopOpen(true);
      // Clear the state to prevent reopening on re-render (keep returnTo)
      navigate(location.pathname, { replace: true, state: { returnTo: location.state?.returnTo } });
    }
  }, [location.state, navigate]);

  // Helper to pick a color based on index (consistent for same kid order)
  const getKidColor = (index: number) => PROFILE_BG_COLORS[index % PROFILE_BG_COLORS.length];

  return (
    <main className="explorer-page">
      <div className="explorer-shell">
        <header className="explorer-topbar">
          <button className="explorer-icon-button" aria-label="Back to ship" onClick={()=>navigate(returnTo || '/crew')}><ChevronLeft size={24}/></button>
          <span><Compass size={20}/>{t('profiles')}</span>
          <button className="explorer-icon-button" aria-label="Settings" onClick={()=>navigate('/settings')}><Settings size={22}/></button>
        </header>
        <section className="explorer-panel" aria-labelledby="explorer-title">
          <div className="explorer-heading">
            <span className="explorer-emblem" aria-hidden="true"><Compass size={36} strokeWidth={1.5}/></span>
            <h1 id="explorer-title">{kids.length === 0 ? 'No explorers yet' : t('chooseExplorer')}</h1>
            <p>{kids.length === 0 ? 'Add one to start playing.' : t('whosPlayingToday')}</p>
          </div>
          <div className="explorer-grid">
            {kids.map((profile,index)=><div key={profile.id} className="explorer-card" data-profile-id={profile.id}>
              <button type="button" className="explorer-card-open" onClick={()=>{switchProfile(profile.id);navigate(returnTo || '/crew');}}>
                <PortholeAvatar avatarSrc={profile.characterAvatar || profile.avatar || profile.avatarSeed} fallbackInitial={profile.name?.charAt(0)} glassClassName={getKidColor(index)} className="explorer-avatar"/>
                <span className="explorer-name" data-no-localize="true">{profile.name}</span>
                <span className="explorer-play" aria-hidden="true"><ChevronRight size={18}/></span>
              </button>
              <div className="explorer-card-tools">
                <button type="button" className="explorer-card-tool" aria-label={`${t('editProfile')}: ${profile.name}`} onClick={()=>navigate(`/edit-profile?kid=${encodeURIComponent(profile.id)}`,{state:{profileId:profile.id}})}>
                  <Pencil size={15}/><span>{t('editProfile')}</span>
                </button>
                <button type="button" className="explorer-card-tool is-delete" aria-label={`${t('deleteProfile')}: ${profile.name}`} onClick={()=>setPendingDeleteId(profile.id)}>
                  <Trash2 size={15}/><span>{t('deleteProfile')}</span>
                </button>
              </div>
            </div>)}
            {kids.length<5&&<button type="button" className="explorer-card explorer-add" onClick={()=>navigate('/create-profile')}>
              <span className="explorer-add-icon"><Plus size={36} strokeWidth={2}/></span>
              <span className="explorer-name">New explorer</span>
            </button>}
          </div>
          <div className="explorer-actions">
            <button className="explorer-action explorer-shop" onClick={()=>setIsShopOpen(true)}><ShoppingBag size={19}/><span>{t('visitShop')}</span></button>
            <button className="explorer-action explorer-language" aria-label={`${t('language')}: ${lang?.nativeName || 'English'}`} onClick={()=>navigate('/language?returnTo=/profile')}>
              <Globe size={18}/><span className="explorer-language-flag" aria-hidden="true">{lang?.flag}</span><span data-no-localize="true">{lang?.nativeName || 'English'}</span><small>{t('language')}</small><ChevronRight size={16}/>
            </button>
          </div>
        </section>
        {!isSubscribed&&<button type="button" className="explorer-premium" onClick={()=>navigate('/onboarding/welcome',{state:{returnTo:'/profile'}})}>
          <span className="explorer-crown"><Crown size={25}/></span>
          <span><strong>{t('goPremium')}</strong><small>{t('unlockAllStoriesItems') || 'Unlock all stories & items'}</small></span>
          <ChevronRight size={21}/>
        </button>}
      </div>
      <ShopModal isOpen={isShopOpen} onClose={()=>setIsShopOpen(false)} initialTab={location.state?.shopTab || undefined}/>
      {pendingDelete && (
        <div className="explorer-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-profile-title">
          <div className="explorer-dialog">
            <h2 id="delete-profile-title">{t('deleteProfile')}?</h2>
            <p>{t('confirmDelete')} <strong data-no-localize="true">{pendingDelete.name}</strong></p>
            <div className="explorer-actions">
              <button type="button" className="explorer-action" onClick={()=>setPendingDeleteId(null)}>{t('cancel')}</button>
              <button type="button" className="explorer-action explorer-danger is-solid" onClick={()=>{removeKid(pendingDelete.id);setPendingDeleteId(null);}}>{t('yesDelete')}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
export default ProfileSelectionPage;
