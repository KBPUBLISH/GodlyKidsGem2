import React from 'react';
import { Navigate } from 'react-router-dom';
import LanguagePicker from '../components/language/LanguagePicker';
import { warmPreviewNextScreen } from '../utils/previewWarmup';

/** The preview opens immediately: no movie or full-adventure download gate. */
export default function QuickStartPage() {
  React.useEffect(() => warmPreviewNextScreen('onboarding'), []);
  const [languageChosen, setLanguageChosen] = React.useState(() => localStorage.getItem('godlykids_language_selected') === 'true');
  if (!languageChosen) return <LanguagePicker onComplete={() => setLanguageChosen(true)} />;
  let hasKid = false;
  try { hasKid = Boolean(JSON.parse(localStorage.getItem('godly_kids_data_v6') || '{}').kids?.length); } catch { /* fresh profile */ }
  return <Navigate to={hasKid ? '/my-home' : '/onboarding'} replace />;
}
