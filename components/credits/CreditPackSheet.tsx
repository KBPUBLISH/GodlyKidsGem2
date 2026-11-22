import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  tokenService,
  type BundleId,
  type TokenBundle,
} from '../../services/tokenService';

const NAVY = '#173A5E';
const CREAM = '#F7F0E6';
const MUTED = '#8A7A68';
const COIN = '/assets/ui/coin.png';

type CreditPackSheetProps = {
  currentBalance?: number;
  onClose: () => void;
  onPurchased?: (newBalance: number) => void;
};

const CreditPackSheet: React.FC<CreditPackSheetProps> = ({
  currentBalance,
  onClose,
}) => {
  const [bundles, setBundles] = useState<TokenBundle[]>(tokenService.getBundles());
  const [paymentsConfigured, setPaymentsConfigured] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<BundleId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [balance, setBalance] = useState(currentBalance ?? 0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [catalog, liveBalance] = await Promise.all([
        tokenService.fetchCatalog(),
        currentBalance == null ? tokenService.getBalance() : Promise.resolve(currentBalance),
      ]);
      if (cancelled) return;
      setBundles(catalog.bundles);
      setPaymentsConfigured(catalog.paymentsConfigured);
      setBalance(liveBalance);
      if (!catalog.paymentsConfigured) {
        setMessage(
          'These packs are ready, but card payments are not set up on this server. Credits will not be added until Stripe is configured.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentBalance]);

  const buy = async (bundleId: BundleId) => {
    setBusyId(bundleId);
    setMessage(null);
    const result = await tokenService.startCheckout(bundleId);
    setBusyId(null);
    if (result.url) {
      window.location.href = result.url;
      return;
    }
    setPaymentsConfigured(result.paymentsConfigured ?? false);
    setMessage(
      result.error ||
        'Card payments are not set up on this server. Credits were not added.',
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      <div
        className="relative w-full max-w-md rounded-t-[1.75rem] px-5 pt-5"
        style={{
          background: CREAM,
          paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 1.25rem)',
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display font-black text-[1.05rem]" style={{ color: NAVY }}>
            Buy credit packs
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center"
            aria-label="Close credit packs"
          >
            <X size={16} style={{ color: NAVY }} />
          </button>
        </div>

        <div
          className="mt-3 flex items-center gap-3 rounded-[1.1rem] px-3 py-3"
          style={{ background: '#F8EBDA' }}
        >
          <img src={COIN} alt="" className="w-8 h-8" />
          <div>
            <p className="font-display text-[11px]" style={{ color: MUTED }}>
              Your credits
            </p>
            <p className="font-display font-black text-lg leading-none" style={{ color: NAVY }}>
              {balance}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {bundles.map((bundle) => (
            <button
              key={bundle.bundleId}
              type="button"
              disabled={busyId != null}
              onClick={() => void buy(bundle.bundleId)}
              className="w-full flex items-center justify-between rounded-[1.1rem] bg-white px-3 py-3 text-left shadow-[0_2px_8px_rgba(23,58,94,0.06)] active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black"
                  style={{ background: '#F8EBDA', color: NAVY }}
                >
                  {bundle.tokens}
                </span>
                <div>
                  <p className="font-display font-black text-sm" style={{ color: NAVY }}>
                    {bundle.name}
                  </p>
                  <p className="font-display text-[11px]" style={{ color: MUTED }}>
                    {bundle.tokens} credits
                    {bundle.bonus ? ` • ${bundle.bonus}` : ''}
                  </p>
                </div>
              </div>
              <span className="font-display font-black text-sm" style={{ color: NAVY }}>
                {busyId === bundle.bundleId ? '…' : `$${bundle.price.toFixed(0)}`}
              </span>
            </button>
          ))}
        </div>

        {message && (
          <p className="mt-3 font-display text-[12px] leading-snug" style={{ color: '#8A5A12' }}>
            {message}
          </p>
        )}

        {paymentsConfigured === false && !message && (
          <p className="mt-3 font-display text-[12px] leading-snug" style={{ color: '#8A5A12' }}>
            Card payments are not set up on this server. Credits were not added.
          </p>
        )}

        <p className="mt-3 font-display text-[10px] text-center leading-snug" style={{ color: MUTED }}>
          Credits unlock creator stories. You are only charged if checkout completes.
        </p>
      </div>
    </div>
  );
};

export default CreditPackSheet;
