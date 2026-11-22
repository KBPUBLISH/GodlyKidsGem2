import React from 'react';

export const SCREEN_FADE_MS = 420;

interface ScreenFadeProps extends React.HTMLAttributes<HTMLDivElement> {
  fading: boolean;
  children: React.ReactNode;
}

/** Opacity fade for splash / onboarding beats after the helm spin. */
const ScreenFade: React.FC<ScreenFadeProps> = ({
  fading,
  children,
  className,
  style,
  ...rest
}) => (
  <div
    className={className}
    style={{
      ...style,
      opacity: fading ? 0 : 1,
      transition: `opacity ${SCREEN_FADE_MS}ms ease`,
    }}
    {...rest}
  >
    {children}
  </div>
);

export default ScreenFade;
