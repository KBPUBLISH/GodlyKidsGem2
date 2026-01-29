import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PremiumOnboarding from '../components/features/PremiumOnboarding';
import { useSubscription } from '../context/SubscriptionContext';

/**
 * Premium Onboarding Page
 * Shown when a user starts a reverse trial (7-day free premium)
 * Walks them through what they've unlocked
 */
const PremiumOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { reverseTrial, isPremium } = useSubscription();

  // If user navigates here directly without a reverse trial, redirect to home
  useEffect(() => {
    if (!reverseTrial.isActive && !isPremium) {
      navigate('/home', { replace: true });
    }
  }, [reverseTrial.isActive, isPremium, navigate]);

  const handleComplete = () => {
    // Mark onboarding as shown so we don't show it again
    localStorage.setItem('godlykids_premium_onboarding_shown', 'true');
    navigate('/home', { replace: true });
  };

  return (
    <PremiumOnboarding
      isOpen={true}
      onComplete={handleComplete}
    />
  );
};

export default PremiumOnboardingPage;
