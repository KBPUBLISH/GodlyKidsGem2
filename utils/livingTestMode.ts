/** Set only by the isolated preview build; normal releases stay opt-in. */
export const LIVING_TEST_BUILD = import.meta.env.VITE_LIVING_TEST === '1';
