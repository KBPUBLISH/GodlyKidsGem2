import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import OnboardingGuideCard from './OnboardingGuideCard';
import {
  hasSeenLibraryHsGuide,
  markLibraryHsGuideSeen,
} from '../../utils/onboardingJourney';

type Props = {
  onActiveChange?: (active: boolean) => void;
  onGuideFinished?: () => void;
  forceActive?: boolean;
};

/**
 * First tap of Library on the ship deck — HS welcome, once.
 */
const LibraryHsGuide: React.FC<Props> = ({ onActiveChange, onGuideFinished, forceActive = false }) => {
  const location = useLocation();
  const [active, setActive] = useState(
    () =>
      Boolean((location.state as { libraryHsGuide?: boolean } | null)?.libraryHsGuide) &&
      (forceActive || !hasSeenLibraryHsGuide()),
  );

  useEffect(() => {
    if (active) markLibraryHsGuideSeen();
  }, [active]);

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const onFinished = useCallback(() => {
    setActive(false);
    onGuideFinished?.();
  }, [onGuideFinished]);

  return (
    <OnboardingGuideCard variant="library" active={active} onFinished={onFinished} />
  );
};

export default LibraryHsGuide;
