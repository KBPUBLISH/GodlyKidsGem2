/**
 * Kid-safe HTML5 game iframe helpers (Famobi + generic /game embeds).
 *
 * Famobi play.famobi.com inside an iframe shows a "Play" splash whose CTA uses
 * target=_blank / top.location — dead under a no-popups / no-top-navigation
 * sandbox. Always embed games.cdn.famobi.com/html5games/... for known titles.
 */

/** Gameplay sandbox: scripts + storage. No popups / top navigation. */
export const KID_SAFE_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-pointer-lock allow-forms';

/**
 * Famobi CDN gameapi is picky in iframes. Prefer no sandbox for CDN embeds so
 * the game can boot; containment is still: never load play.famobi splash, omit
 * popups/top-nav when sandbox is used, parent window.open guard.
 */
export const FAMOBI_CDN_IFRAME_SANDBOX: string | undefined = undefined;

/** Permissions limited to what HTML5 games typically need. */
export const KID_SAFE_IFRAME_ALLOW =
  'accelerometer; autoplay; encrypted-media; gyroscope; fullscreen; gamepad';

/** Default referrer — let CDN subresource requests send a normal Referer. */
export const KID_SAFE_REFERRER_POLICY = 'origin-when-cross-origin' as const;

/** Default public Famobi affiliate id from their catalog feed. */
export const FAMOBI_DEFAULT_AFFILIATE = 'A1000-11';

type FamobiCdnKnown = {
  packageId: string;
  letter: string;
  version: string;
  fgUid: string;
  fgPid: string;
  fgAid: string;
};

/**
 * Known CDN coordinates — hard fallback when live resolve fails.
 * Speed Pool King (Speed Billiards) from play.famobi.com redirectUrl.
 */
const FAMOBI_CDN_KNOWN: Record<string, FamobiCdnKnown> = {
  'speed-pool-king': {
    packageId: 'speed-pool-king',
    letter: 's',
    version: 'v020',
    fgUid: '1aa36ec3-b337-4365-8b6d-5d9f6fd0ecd8',
    fgPid: 'e37ab3ce-88cd-4438-9b9c-a37df5d33736',
    fgAid: 'A1000-111',
  },
};

/** Stable hardcoded CDN embed for the sail-boat pool table (never play.famobi). */
export function getSpeedPoolKingCdnUrl(): string {
  return buildFamobiCdnUrl(FAMOBI_CDN_KNOWN['speed-pool-king']);
}

export function isFamobiGameUrl(url: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'play.famobi.com' ||
      host === 'games.cdn.famobi.com' ||
      host.endsWith('.famobi.com')
    );
  } catch {
    return /famobi\.com/i.test(url);
  }
}

/** True for play.famobi.com splash / wrapper pages (not the CDN game). */
export function isFamobiSplashUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== 'play.famobi.com') return false;
    // CDN is games.cdn — play host is always splash/wrapper/html5game gate.
    return true;
  } catch {
    return /play\.famobi\.com/i.test(url);
  }
}

export function isFamobiCdnUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === 'games.cdn.famobi.com';
  } catch {
    return /games\.cdn\.famobi\.com/i.test(url);
  }
}

export function parseFamobiPackageId(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'wrapper' && parts[1]) return parts[1];
    if (parts[0] === 'html5games' && parts[2]) return parts[2];
    if (parts[0] === 'html5game') {
      // /html5game/{uuid}/A1000-11 — map known uuid → package
      const uid = parts[1];
      for (const known of Object.values(FAMOBI_CDN_KNOWN)) {
        if (known.fgUid === uid) return known.packageId;
      }
      return null;
    }
    if (parts[0] && parts[0] !== 'play') return parts[0];
  } catch {
    /* fall through */
  }
  return null;
}

function buildFamobiCdnUrl(
  known: FamobiCdnKnown,
  affiliateId = FAMOBI_DEFAULT_AFFILIATE,
): string {
  const beat = String(Date.now() % 100000);
  const originalRef = `https://play.famobi.com/${known.packageId}/${affiliateId}`;
  const params = new URLSearchParams({
    fg_domain: 'play.famobi.com',
    fg_aid: known.fgAid,
    fg_uid: known.fgUid,
    fg_pid: known.fgPid,
    fg_beat: beat,
    original_ref: originalRef,
  });
  return `https://games.cdn.famobi.com/html5games/${known.letter}/${known.packageId}/${known.version}/?${params.toString()}`;
}

/**
 * Sync URL for iframe src. For known Famobi games ALWAYS returns CDN —
 * never play.famobi.com (that page's Play button is dead under sandbox).
 */
export function toKidSafeGameUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  // Bare package convenience
  if (rawUrl === 'speed-pool-king' || rawUrl.includes('speed-pool-king')) {
    const packageId = parseFamobiPackageId(
      rawUrl.startsWith('http') ? rawUrl : `https://play.famobi.com/${rawUrl}`,
    );
    if (packageId === 'speed-pool-king' || /speed-pool-king/i.test(rawUrl)) {
      return getSpeedPoolKingCdnUrl();
    }
  }

  if (!isFamobiGameUrl(rawUrl)) return rawUrl;

  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'games.cdn.famobi.com') {
      // Refresh beat so remounts aren't sticky-cached empty shells
      u.searchParams.set('fg_beat', String(Date.now() % 100000));
      if (!u.searchParams.get('original_ref')) {
        const pkg = parseFamobiPackageId(rawUrl) || 'speed-pool-king';
        u.searchParams.set(
          'original_ref',
          `https://play.famobi.com/${pkg}/${FAMOBI_DEFAULT_AFFILIATE}`,
        );
      }
      return u.toString();
    }

    const packageId = parseFamobiPackageId(rawUrl);
    if (packageId && FAMOBI_CDN_KNOWN[packageId]) {
      return buildFamobiCdnUrl(FAMOBI_CDN_KNOWN[packageId]);
    }

    // Unknown Famobi title — still avoid raw splash without affiliate when possible
    if (packageId) {
      // No CDN map: cannot safely skip splash; return play URL (caller may overlay Start)
      return `https://play.famobi.com/${packageId}/${FAMOBI_DEFAULT_AFFILIATE}`;
    }
  } catch {
    /* keep raw */
  }

  if (/speed-pool-king/i.test(rawUrl)) return getSpeedPoolKingCdnUrl();
  return rawUrl;
}

/**
 * Fetch play HTML and extract redirectUrl. On any failure / splash result,
 * fall back to hardcoded CDN for known games (never leave iframe on splash).
 */
export async function resolveFamobiEmbedUrl(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const fallback = toKidSafeGameUrl(rawUrl);
  if (!isFamobiGameUrl(rawUrl) && !/speed-pool-king/i.test(rawUrl)) {
    return fallback;
  }

  // Already CDN or known map — prefer hard CDN immediately; optional refresh below
  const packageId =
    parseFamobiPackageId(rawUrl.startsWith('http') ? rawUrl : `https://play.famobi.com/${rawUrl}`) ||
    (/speed-pool-king/i.test(rawUrl) ? 'speed-pool-king' : null);

  if (packageId && FAMOBI_CDN_KNOWN[packageId]) {
    // Try live resolve for fresher version path; always CDN result
    try {
      const playUrl = `https://play.famobi.com/${packageId}/${FAMOBI_DEFAULT_AFFILIATE}`;
      const res = await fetch(playUrl, {
        signal,
        credentials: 'omit',
        mode: 'cors',
        headers: { Accept: 'text/html' },
      });
      if (res.ok) {
        const html = await res.text();
        const m = html.match(
          /redirectUrl\s*=\s*"(https:\/\/games\.cdn\.famobi\.com\/html5games\/[^"]+)"/,
        );
        if (m?.[1]) {
          const cdn = new URL(m[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&'));
          cdn.searchParams.set('original_ref', playUrl);
          cdn.searchParams.set('fg_beat', String(Date.now() % 100000));
          if (!isFamobiSplashUrl(cdn.toString())) return cdn.toString();
        }
      }
    } catch {
      /* use hardcoded CDN */
    }
    return buildFamobiCdnUrl(FAMOBI_CDN_KNOWN[packageId]);
  }

  if (isFamobiCdnUrl(fallback)) return fallback;
  if (isFamobiSplashUrl(fallback) && packageId && FAMOBI_CDN_KNOWN[packageId]) {
    return buildFamobiCdnUrl(FAMOBI_CDN_KNOWN[packageId]);
  }
  return fallback;
}

/** If src is still a Famobi splash URL, rewrite to CDN when known. */
export function ensureFamobiCdnSrc(url: string): string {
  if (!url) return url;
  if (isFamobiCdnUrl(url)) return url;
  if (/speed-pool-king/i.test(url) || parseFamobiPackageId(url) === 'speed-pool-king') {
    return getSpeedPoolKingCdnUrl();
  }
  const packageId = parseFamobiPackageId(url);
  if (packageId && FAMOBI_CDN_KNOWN[packageId]) {
    return buildFamobiCdnUrl(FAMOBI_CDN_KNOWN[packageId]);
  }
  return toKidSafeGameUrl(url);
}

/** Parent-page hardening: noop window.open while a kid-safe game is mounted. */
export function installParentWindowOpenGuard(): () => void {
  if (typeof window === 'undefined') return () => {};
  const original = window.open;
  window.open = function kidSafeBlockedOpen(
    ..._args: Parameters<typeof window.open>
  ) {
    console.warn('🎮 Blocked window.open while kid-safe game is active');
    return null;
  } as typeof window.open;
  return () => {
    window.open = original;
  };
}

/** Shared iframe props. Famobi CDN: no sandbox (gameapi + boot). Others: kid-safe. */
export function kidSafeIframeProps(
  title: string,
  opts?: { famobiCdn?: boolean },
) {
  const famobiCdn = opts?.famobiCdn ?? false;
  const props: {
    title: string;
    allow: string;
    referrerPolicy: typeof KID_SAFE_REFERRER_POLICY;
    allowFullScreen: true;
    sandbox?: string;
  } = {
    title,
    allow: KID_SAFE_IFRAME_ALLOW,
    referrerPolicy: KID_SAFE_REFERRER_POLICY,
    allowFullScreen: true,
  };
  if (famobiCdn) {
    // Omit sandbox so Famobi gameapi can boot; do not set sandbox="" (that is max lockdown).
    if (FAMOBI_CDN_IFRAME_SANDBOX) props.sandbox = FAMOBI_CDN_IFRAME_SANDBOX;
  } else {
    props.sandbox = KID_SAFE_IFRAME_SANDBOX;
  }
  return props;
}
