import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import PortholeAvatar from '../common/PortholeAvatar';
import { useUser } from '../../context/UserContext';

type Props = {
  className?: string;
};

/**
 * Porthole avatar with premium crown — same chrome as the Explore header.
 * Tap → Profiles. (The avatar Builder Shop lives on the crew ship: tap the
 * cabin door at the bow.)
 */
const ProfilePortholeButton: React.FC<Props> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { equippedAvatar, isSubscribed, headOffset, kids, currentProfileId } = useUser();
  const activeKid = kids.find((k: any) => k.id === currentProfileId);
  const avatarFallbackInitial: string | undefined = activeKid?.name?.charAt(0);

  return (
    <button
      type="button"
      onClick={() => navigate('/profile')}
      className={`relative flex-shrink-0 active:scale-95 transition-transform ${className}`}
      aria-label="Profile"
    >
      <PortholeAvatar
        avatarSrc={equippedAvatar}
        headOffset={headOffset}
        fallbackInitial={avatarFallbackInitial}
        className="w-11 h-11 sm:w-12 sm:h-12 shadow-[0_2px_4px_rgba(60,30,10,0.4)]"
      />
      <div
        className={`absolute -top-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm border z-20 ${
          isSubscribed ? 'border-[#FFD700]' : 'border-gray-200'
        }`}
      >
        <Crown
          size={12}
          className={isSubscribed ? 'text-[#B8860B]' : 'text-gray-400'}
          fill={isSubscribed ? '#FFD700' : '#E5E7EB'}
        />
      </div>
    </button>
  );
};

export default ProfilePortholeButton;
