/** Safe operational diagnosis: never return Google's raw payload or credentials to clients. */
function classifyTranslationError(status, payload) {
  const error = payload && typeof payload === 'object' ? payload.error : null;
  const reasons = (Array.isArray(error?.details) ? error.details : [])
    .map(item => item?.reason).filter(reason => typeof reason === 'string');
  const message = typeof error?.message === 'string' ? error.message : '';
  const evidence = `${reasons.join(' ')} ${message}`;
  if (/API_KEY_INVALID|API key not valid|invalid api key/i.test(evidence)) return 'TRANSLATION_KEY_INVALID';
  if (/SERVICE_DISABLED|accessNotConfigured|has not been used|is disabled/i.test(evidence)) return 'TRANSLATION_API_DISABLED';
  if (/BILLING_DISABLED|billing/i.test(evidence)) return 'TRANSLATION_BILLING_REQUIRED';
  if (/API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|PERMISSION_DENIED/i.test(evidence)) return 'TRANSLATION_ACCESS_DENIED';
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(evidence)) return 'TRANSLATION_QUOTA_EXCEEDED';
  if (status >= 500) return 'TRANSLATION_PROVIDER_UNAVAILABLE';
  return 'TRANSLATION_REQUEST_REJECTED';
}
module.exports = {classifyTranslationError};
