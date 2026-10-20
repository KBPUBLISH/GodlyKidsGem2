import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronLeft, Compass, Gift, Heart, X } from 'lucide-react';
import { activityTrackingService } from '../services/activityTrackingService';
import { startSevenDayChallenge } from '../utils/sevenDayChallenge';
import { authService } from '../services/authService';
import { getApiBaseUrl } from '../services/apiService';
import { useSubscription } from '../context/SubscriptionContext';
import { useUser } from '../context/UserContext';
import ParentGateModal from '../components/features/ParentGateModal';

const NAVY = '#1B2A6B';
const PURPLE_BTN: React.CSSProperties = {
  background: 'linear-gradient(180deg, #7B6CFF 0%, #5B4AD6 100%)',
  boxShadow: '0 6px 0 #3E2E9E, 0 10px 22px rgba(40, 24, 110, 0.28)',
};
const GOLD_BTN: React.CSSProperties = {
  background: 'linear-gradient(180deg, #FFE56A 0%, #F5C518 55%, #E0A800 100%)',
  boxShadow: '0 6px 0 #B8860B, 0 10px 22px rgba(120, 80, 0, 0.22)',
  color: NAVY,
};

type Step = {
  image: string;
  imagePosition: string;
  event: string;
  cta: string;
  tone: 'purple' | 'gold';
  icon?: 'gift';
  /** Headline and body are painted into the artwork. */
  bakedCopy?: boolean;
  /** Keep the button under the poster so it does not cover the art. */
  buttonBelow?: boolean;
  /** Page color behind a poster that does not fill the screen. */
  pageBg?: string;
};

const STEPS: Step[] = [
  {
    image: '/assets/images/onboarding-big-adventures.jpg',
    imagePosition: 'center top',
    event: 'challenge_intro_continue',
    cta: 'Continue',
    tone: 'purple',
    bakedCopy: true,
  },
  {
    image: '/assets/images/onboarding-story-packs.jpg',
    imagePosition: 'center top',
    event: 'challenge_intro_start',
    cta: 'Start Free Challenge',
    tone: 'gold',
    bakedCopy: true,
    buttonBelow: true,
  },
  {
    image: '/assets/images/onboarding-free-book-ship.jpg',
    imagePosition: 'center top',
    event: 'challenge_intro_book',
    cta: 'Get Your Free Book',
    tone: 'purple',
    icon: 'gift',
    bakedCopy: true,
    buttonBelow: true,
    pageBg: '#474E18',
  },
  {
    image: '/assets/images/onboarding-year-trial.jpg',
    imagePosition: 'center top',
    event: 'challenge_intro_join',
    cta: 'Start Free Trial',
    tone: 'purple',
    bakedCopy: true,
    buttonBelow: true,
    pageBg: '#ffffff',
  },
];

const FreeMark: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="relative inline-block px-1">
    <span
      aria-hidden
      className="absolute inset-[-6px] -z-0"
      style={{
        background:
          'repeating-conic-gradient(from 0deg, #F5C518 0 8deg, transparent 8deg 18deg)',
        opacity: 0.9,
        borderRadius: 8,
      }}
    />
    <span className="relative z-[1] text-[#E0A800]">{children}</span>
  </span>
);

const apiRoot = () => getApiBaseUrl().replace(/\/+$/, '').replace(/\/api$/, '');

type ShipForm = {
  email: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
};

const emptyShip = (): ShipForm => {
  const user = authService.getUser();
  let parentName = '';
  try {
    const raw = localStorage.getItem('godly_kids_data_v7') || localStorage.getItem('godly_kids_data_v6');
    if (raw) parentName = JSON.parse(raw).parentName || '';
  } catch {
    /* ignore */
  }
  return {
    email: user?.email || localStorage.getItem('godlykids_user_email') || '',
    fullName: parentName && parentName !== 'Parent' ? parentName : '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'United States',
    phone: '',
  };
};

type AddressHit = {
  label: string;
  magicKey: string;
};

const countryName = (code?: string, name?: string) => {
  if (name) return name;
  if (code === 'CAN') return 'Canada';
  if (code === 'USA' || code === 'US') return 'United States';
  return code || '';
};

const kidNameFromDevice = () => {
  try {
    const raw = localStorage.getItem('godly_kids_data_v7') || localStorage.getItem('godly_kids_data_v6');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const kids = Array.isArray(parsed.kids) ? parsed.kids : [];
    const current = kids.find((kid: { id?: string }) => kid.id === parsed.currentProfileId) || kids[0];
    return current?.name || '';
  } catch {
    return '';
  }
};

const ChallengeIntroPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { purchase } = useSubscription();
  const { subscribe } = useUser();
  const reason =
    (location.state as { reason?: string } | null)?.reason || '';
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo || '/sail/basement';
  const [step, setStep] = useState(0);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipForm, setShipForm] = useState<ShipForm>(emptyShip);
  const [shipError, setShipError] = useState('');
  const [savingShip, setSavingShip] = useState(false);
  const [showParentGate, setShowParentGate] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [addressHits, setAddressHits] = useState<AddressHit[]>([]);
  const skipAddressLookup = useRef(false);
  const addressLookupGen = useRef(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (!shipOpen) {
      setAddressHits([]);
      return;
    }
    const query = shipForm.line1.trim();
    const generation = ++addressLookupGen.current;
    if (skipAddressLookup.current) {
      skipAddressLookup.current = false;
      setAddressHits([]);
      return;
    }
    if (query.length < 3) {
      setAddressHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          text: query,
          countryCode: 'USA,CAN',
          maxSuggestions: '6',
          f: 'json',
        });
        const response = await fetch(
          `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?${params}`,
          { signal: controller.signal }
        );
        if (!response.ok || generation !== addressLookupGen.current) return;
        const data = await response.json();
        const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        if (generation !== addressLookupGen.current) return;
        setAddressHits(
          suggestions
            .filter((item: { text?: string; magicKey?: string }) => item?.text && item?.magicKey)
            .map((item: { text: string; magicKey: string }) => ({
              label: item.text,
              magicKey: item.magicKey,
            }))
        );
      } catch {
        /* typing continues while a lookup is cancelled */
      }
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [shipForm.line1, shipOpen]);

  const pickAddress = async (hit: AddressHit) => {
    addressLookupGen.current += 1;
    skipAddressLookup.current = true;
    setAddressHits([]);
    try {
      const params = new URLSearchParams({
        magicKey: hit.magicKey,
        SingleLine: hit.label,
        outFields: 'StAddr,City,RegionAbbr,Region,Postal,PostalExt,Country,CntryName',
        maxLocations: '1',
        f: 'json',
      });
      const response = await fetch(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params}`
      );
      const data = await response.json();
      const attrs = data?.candidates?.[0]?.attributes || {};
      const postal = attrs.PostalExt && attrs.Postal && !String(attrs.Postal).includes(' ')
        ? `${attrs.Postal} ${attrs.PostalExt}`
        : attrs.Postal || '';
      setShipForm((form) => ({
        ...form,
        line1: attrs.StAddr || hit.label,
        city: attrs.City || form.city,
        region: attrs.RegionAbbr || attrs.Region || form.region,
        postalCode: postal || form.postalCode,
        country: countryName(attrs.Country, attrs.CntryName) || form.country,
      }));
    } catch {
      setShipForm((form) => ({ ...form, line1: hit.label }));
    }
  };

  const track = (event: string) => {
    activityTrackingService.trackOnboardingEvent(event, { step: step + 1 }).catch(() => {});
  };

  const backToShip = () => {
    navigate(returnTo, { replace: true });
  };

  const join = () => {
    startSevenDayChallenge();
    track('challenge_intro_join');
    setPayError('');
    setShowParentGate(true);
  };

  const advance = () => {
    if (current.event === 'challenge_intro_book') {
      track(current.event);
      setShipError('');
      setShipForm(emptyShip());
      setShipOpen(true);
      return;
    }
    if (last) {
      join();
      return;
    }
    if (current.event === 'challenge_intro_start') startSevenDayChallenge();
    track(current.event);
    setStep((n) => n + 1);
  };

  const saveShipping = async () => {
    const email = shipForm.email.trim().toLowerCase();
    const required: Array<[string, string]> = [
      [email, 'Email'],
      [shipForm.fullName.trim(), 'Full name'],
      [shipForm.line1.trim(), 'Street address'],
      [shipForm.city.trim(), 'City'],
      [shipForm.region.trim(), 'State'],
      [shipForm.postalCode.trim(), 'Postal code'],
      [shipForm.country.trim(), 'Country'],
    ];
    if (!email.includes('@')) {
      setShipError('Enter a valid email.');
      return;
    }
    const missing = required.find(([value]) => !value);
    if (missing) {
      setShipError(`Enter a ${missing[1].toLowerCase()}.`);
      return;
    }
    setSavingShip(true);
    setShipError('');
    try {
      const root = apiRoot();
      let bookOfferId = sessionStorage.getItem('godlykids_seven_day_book_offer') || '';
      if (!bookOfferId) {
        const offerRes = await fetch(`${root}/api/book-offers`);
        if (offerRes.ok) {
          const offerData = await offerRes.json();
          const books = Array.isArray(offerData?.data) ? offerData.data : [];
          const match =
            books.find((book: { title?: string; _id?: string }) => /level\s*1/i.test(book.title || '')) ||
            books.find((book: { _id?: string }) => book._id);
          if (match?._id) bookOfferId = match._id;
        }
      }
      const user = authService.getUser();
      const response = await fetch(`${root}/api/offer-claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          userId: user?._id || user?.id || undefined,
          kidName: kidNameFromDevice(),
          bookOfferId: bookOfferId || undefined,
          shipping: {
            fullName: shipForm.fullName.trim(),
            line1: shipForm.line1.trim(),
            line2: shipForm.line2.trim(),
            city: shipForm.city.trim(),
            region: shipForm.region.trim(),
            postalCode: shipForm.postalCode.trim(),
            country: shipForm.country.trim(),
            phone: shipForm.phone.trim(),
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Could not save shipping');
      localStorage.setItem('godlykids_user_email', email);
      if (bookOfferId) sessionStorage.setItem('godlykids_seven_day_book_offer', bookOfferId);
      sessionStorage.setItem('godlykids_offer_shipping', JSON.stringify({ email, ...shipForm }));
      setShipOpen(false);
      setStep((n) => n + 1);
    } catch (error) {
      setShipError(error instanceof Error ? error.message : 'Could not save shipping');
    } finally {
      setSavingShip(false);
    }
  };

  const startYearlyPurchase = async () => {
    setPaying(true);
    setPayError('');
    try {
      const result = await purchase('annual');
      if (result.success) {
        subscribe();
        navigate(returnTo, { replace: true });
        return;
      }
      if (result.error === 'REDIRECT_TO_STRIPE') return;
      if (result.error && result.error !== 'Purchase cancelled') setPayError(result.error);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Could not start checkout');
    } finally {
      setPaying(false);
    }
  };

  const later = () => {
    track('challenge_intro_later');
    const fromAdam =
      reason === 'adam-offer' ||
      reason === 'skip-tour' ||
      (!reason && returnTo === '/sail/basement');
    if (fromAdam) {
      navigate('/sail/basement', { replace: true, state: { adamSkipTrial: true } });
      return;
    }
    backToShip();
  };

  const goBack = () => {
    setShipOpen(false);
    setPayError('');
    if (step === 0) {
      backToShip();
      return;
    }
    setStep((n) => n - 1);
  };

  return (
    <div
      className={`fixed inset-0 overflow-hidden text-[#1B2A6B] ${
        current.buttonBelow ? 'flex flex-col' : 'bg-[#d7ecff]'
      }`}
      style={current.buttonBelow ? { background: current.pageBg || '#ffffff' } : undefined}
    >
      {!current.buttonBelow && (
        <img
          key={current.image}
          src={current.image}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover select-none"
          style={{ objectPosition: current.imagePosition }}
        />
      )}
      {!current.bakedCopy && (
        <div
          className="absolute inset-x-0 top-0 h-[46%] pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.28) 58%, rgba(255,255,255,0) 100%)',
          }}
        />
      )}
      {!current.buttonBelow && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%]"
          style={{
            background: current.bakedCopy
              ? 'linear-gradient(0deg, rgba(8,16,40,0.35) 0%, rgba(8,16,40,0) 100%)'
              : 'linear-gradient(0deg, rgba(8,16,40,0.28) 0%, rgba(8,16,40,0) 100%)',
          }}
        />
      )}

      <div
        className={`relative z-10 flex min-h-0 flex-1 flex-col ${current.buttonBelow ? '' : 'h-full'}`}
        style={{
          paddingTop: current.buttonBelow ? 0 : 'max(14px, var(--safe-area-top))',
          paddingBottom: 'max(16px, var(--safe-area-bottom))',
          paddingLeft: current.buttonBelow ? 0 : 'max(20px, var(--safe-area-left))',
          paddingRight: current.buttonBelow ? 0 : 'max(20px, var(--safe-area-right))',
        }}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={goBack}
          className="absolute z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[#1B2A6B] shadow-sm active:scale-95"
          style={{
            top: 'max(10px, var(--safe-area-top))',
            left: 'max(12px, var(--safe-area-left))',
          }}
        >
          <ChevronLeft size={26} strokeWidth={2.6} />
        </button>
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center gap-2"
          style={{ top: 'max(14px, var(--safe-area-top))' }}
          aria-hidden
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full"
              style={{
                background: i === step ? '#2A3F8F' : current.buttonBelow ? 'rgba(27,42,107,0.28)' : 'rgba(255,255,255,0.85)',
              }}
            />
          ))}
        </div>

        {current.buttonBelow && (
          <div className="min-h-0 flex-1">
            <img
              key={current.image}
              src={current.image}
              alt=""
              draggable={false}
              className="h-full w-full object-contain object-top select-none"
            />
          </div>
        )}

        {!current.bakedCopy && (
        <div className="px-2 pt-4 text-center">
          <h1
            className="font-black leading-[0.95] tracking-tight"
            style={{
              fontFamily: '"Fredoka", "Baloo 2", sans-serif',
              fontSize: 'clamp(2rem, 8.4vw, 2.7rem)',
              color: NAVY,
              textShadow: '0 1px 0 rgba(255,255,255,0.65)',
            }}
          >
            {step === 0 && (
              <>
                BIG STORIES.
                <br />
                REAL FAITH.
                <br />
                BIGGER ADVENTURES.
              </>
            )}
            {step === 1 && (
              <>
                Start the
                <br />
                7 Day Challenge
                <br />
                <FreeMark>FREE!</FreeMark>
              </>
            )}
            {step === 2 && (
              <>
                Get a <FreeMark>FREE</FreeMark>
                <br />
                Book
              </>
            )}
            {step === 3 && (
              <>
                Real Stories.
                <br />
                Lasting Faith.
              </>
            )}
          </h1>
          <p
            className="mx-auto mt-3 max-w-[22rem] text-[1.05rem] font-semibold leading-snug"
            style={{
              fontFamily: '"Nunito", sans-serif',
              color: NAVY,
              textShadow: '0 1px 0 rgba(255,255,255,0.7)',
            }}
          >
            {step === 0 &&
              'Explore the Bible, build character, and grow closer to God — one day at a time.'}
            {step === 1 &&
              'Choose the book. Get daily stories, fun activities, and simple lessons – for free.'}
            {step === 2 &&
              "Complete your 7 day challenge and we'll send you a free book in the mail!"}
            {step === 3 &&
              'Join the 7 day challenge and give your child an adventure that builds faith for life.'}
          </p>
        </div>
        )}

        <div
          className={current.buttonBelow ? 'shrink-0' : 'mt-auto'}
          style={current.buttonBelow ? { paddingLeft: 'max(20px, var(--safe-area-left))', paddingRight: 'max(20px, var(--safe-area-right))' } : undefined}
        >
          {last && !current.bakedCopy && (
            <div className="mb-5 flex items-end justify-center gap-8 text-center">
              {[
                { Icon: BookOpen, label: 'Stories' },
                { Icon: Compass, label: 'Adventure' },
                { Icon: Heart, label: 'Faith' },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex w-16 flex-col items-center gap-1">
                  <Icon size={28} strokeWidth={2.2} className="text-[#F5C518]" fill="#F5C518" />
                  <span
                    className="text-sm font-bold text-white"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.45)' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {payError && (
            <p
              className="mb-3 text-center text-sm font-bold"
              style={{ color: current.buttonBelow ? NAVY : '#fff', textShadow: current.buttonBelow ? 'none' : '0 1px 3px rgba(0,0,0,0.45)' }}
            >
              {payError}
            </p>
          )}
          <button
            type="button"
            onClick={advance}
            disabled={paying}
            className="flex w-full min-h-[58px] items-center justify-center gap-2 rounded-full text-[1.2rem] font-black active:translate-y-0.5 disabled:opacity-70"
            style={{
              ...(current.tone === 'gold' ? GOLD_BTN : PURPLE_BTN),
              color: current.tone === 'gold' ? NAVY : '#fff',
              fontFamily: '"Fredoka", "Baloo 2", sans-serif',
            }}
          >
            {current.icon === 'gift' && <Gift size={22} strokeWidth={2.4} />}
            {paying ? 'Opening checkout…' : current.cta} <span aria-hidden>→</span>
          </button>

          {current.event === 'challenge_intro_book' && (
            <button
              type="button"
              onClick={() => {
                track('challenge_intro_book_declined');
                setStep((n) => n + 1);
              }}
              className="mt-3 w-full py-2 text-center text-[0.95rem] font-bold text-white/95 active:opacity-70"
              style={{
                fontFamily: '"Nunito", sans-serif',
                textShadow: '0 1px 3px rgba(0,0,0,0.55)',
              }}
            >
              No thanks
            </button>
          )}

          {last && (
            <button
              type="button"
              onClick={later}
              className={`mt-3 w-full py-2 text-center text-[0.95rem] font-bold active:opacity-70 ${
                current.buttonBelow ? 'text-[#1B2A6B]' : 'text-white/95'
              }`}
              style={{
                fontFamily: '"Nunito", sans-serif',
                textShadow: current.buttonBelow ? 'none' : '0 1px 3px rgba(0,0,0,0.55)',
              }}
            >
              Skip free trial
            </button>
          )}
        </div>
      </div>

      {shipOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center">
          <form
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-4 shadow-2xl sm:max-w-md sm:rounded-3xl"
            style={{ paddingBottom: 'max(24px, var(--safe-area-bottom))' }}
            onSubmit={(event) => {
              event.preventDefault();
              saveShipping();
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black" style={{ color: NAVY, fontFamily: '"Fredoka", "Baloo 2", sans-serif' }}>
                  Where should we ship it?
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#3d4a86]">
                  We’ll mail the free book here after the 7-day challenge.
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setShipOpen(false)} className="rounded-full p-1 text-[#1B2A6B]">
                <X size={22} />
              </button>
            </div>
            <div className="space-y-2">
              {(
                [
                  ['fullName', 'Full name', 'name'],
                  ['email', 'Email', 'email'],
                  ['line1', 'Street address', 'shipping address-line1'],
                  ['line2', 'Apt, suite (optional)', 'shipping address-line2'],
                  ['city', 'City', 'shipping address-level2'],
                  ['region', 'State', 'shipping address-level1'],
                  ['postalCode', 'Postal code', 'shipping postal-code'],
                  ['country', 'Country', 'shipping country'],
                  ['phone', 'Phone (optional)', 'tel'],
                ] as Array<[keyof ShipForm, string, string]>
              ).map(([key, label, autoComplete]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-bold text-[#3d4a86]">{label}</span>
                  <input
                    value={shipForm[key]}
                    onChange={(event) => setShipForm((form) => ({ ...form, [key]: event.target.value }))}
                    autoComplete={autoComplete}
                    className="w-full rounded-xl border border-[#d5dcf5] bg-[#f7f8ff] px-3 py-2.5 text-base text-[#1B2A6B] outline-none focus:border-[#5B4AD6]"
                  />
                  {key === 'line1' && addressHits.length > 0 && (
                    <ul className="mt-1 overflow-hidden rounded-xl border border-[#d5dcf5] bg-white shadow-lg">
                      {addressHits.map((hit) => (
                        <li key={hit.label}>
                          <button
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              pickAddress(hit);
                            }}
                            className="w-full px-3 py-2.5 text-left text-sm font-semibold text-[#1B2A6B] active:bg-[#eef0ff]"
                          >
                            {hit.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </label>
              ))}
            </div>
            {shipError && <p className="mt-3 text-sm font-bold text-[#b42318]">{shipError}</p>}
            <button
              type="submit"
              disabled={savingShip}
              className="mt-4 flex w-full min-h-[54px] items-center justify-center rounded-full text-lg font-black text-white disabled:opacity-70"
              style={{ ...PURPLE_BTN, fontFamily: '"Fredoka", "Baloo 2", sans-serif' }}
            >
              {savingShip ? 'Saving…' : 'Save & Continue'}
            </button>
          </form>
        </div>
      )}

      <ParentGateModal
        isOpen={showParentGate}
        onClose={() => setShowParentGate(false)}
        onSuccess={startYearlyPurchase}
        isPurchasing={paying}
      />
    </div>
  );
};

export default ChallengeIntroPage;
