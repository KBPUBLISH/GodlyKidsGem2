/**
 * Subscription prices shown in the app (USD).
 *
 * These MUST match the store products configured in App Store Connect and
 * Google Play Console — the native payment sheet shows the store's price, and
 * the app cannot read it at runtime through the Despia bridge. If a store price
 * changes, change it here (only here).
 *
 *   Monthly: kbpublish.godlykids.monthly (iOS) / godlykidsmonthly:monthly (Android)
 *   Yearly:  kbpublish.godlykids.yearly  (iOS) / yearlymember:yearly        (Android)
 *
 * The lifetime product is no longer sold.
 */
export const ANNUAL_PRICE_USD = 49.99;
export const MONTHLY_PRICE_USD = 7.99;

/** Free-trial length attached to both subscriptions in the stores. */
export const TRIAL_DAYS = 14;

export const formatUsd = (amount: number): string => `$${amount.toFixed(2)}`;
