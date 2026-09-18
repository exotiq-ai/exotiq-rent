import { consentValue, attributionValue, ATTRIBUTION_FIELDS, type Consent } from './policy';
export const CONSENT_KEY = 'exotiq_tracking_consent_v1';
export const ATTRIBUTION_KEY = 'exotiq_tracking_attribution_v1';
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
const DAY = 86400000;
export function readChoice(s: Pick<StorageLike, 'getItem'> | undefined, gpc: boolean, now = Date.now()): Consent | null {
  try {
    const value = JSON.parse(s?.getItem(CONSENT_KEY) || 'null');
    if (!value || value.version !== 1 || typeof value.analytics !== 'boolean' || typeof value.marketing !== 'boolean' || !Number.isFinite(value.at) || now < value.at) return null;
    // Under the opt-out default, a choice that withholds anything is an
    // opt-out and MUST persist (CPRA): it never ages back into the default.
    // A full grant matches the default, so its 180-day expiry is harmless
    // and keeps the stored timestamp honest.
    if (value.analytics && value.marketing && now - value.at > 180 * DAY) return null;
    return consentValue(value, gpc);
  } catch { return null; }
}
export function saveChoice(s: StorageLike | undefined, c: Consent, now = Date.now()) {
  try { s?.setItem(CONSENT_KEY, JSON.stringify({ version: 1, ...c, at: now })); } catch { /* current-document in-memory choice only */ }
}
function cleanTouch(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const field of ATTRIBUTION_FIELDS) {
    const item = attributionValue((value as Record<string, unknown>)[field], field);
    if (item) out[field] = item;
  }
  return out;
}
/** Called only with an active analytics OR marketing grant. Never stores arbitrary query values. */
export function captureAttribution(s: StorageLike | undefined, query: string, now = Date.now()): Record<string, string> {
  let record: { at: number; first: Record<string, string>; last: Record<string, string> } = { at: now, first: {}, last: {} };
  try {
    const value = JSON.parse(s?.getItem(ATTRIBUTION_KEY) || 'null');
    if (value && Number.isFinite(value.at) && now >= value.at && now - value.at <= 30 * DAY) record = { at: value.at, first: cleanTouch(value.first), last: cleanTouch(value.last) };
  } catch { /* invalid/unavailable storage */ }
  const params = new URLSearchParams(query);
  const touch = cleanTouch(Object.fromEntries(ATTRIBUTION_FIELDS.map(field => [field, params.get(field)])));
  if (Object.keys(touch).length) {
    if (!Object.keys(record.first).length) record.first = touch;
    record.last = touch;
  }
  if (Object.keys(record.first).length) {
    try { s?.setItem(ATTRIBUTION_KEY, JSON.stringify(record)); } catch { /* no storage, only this event */ }
  } else { try { s?.removeItem(ATTRIBUTION_KEY); } catch { /* unavailable */ } }
  return Object.fromEntries(['first', 'last'].flatMap(kind => Object.entries(record[kind as 'first' | 'last']).map(([key, value]) => [`${kind}_${key}`, value])));
}
export function clearTrackingStorage(s: StorageLike | undefined, key: string) {
  try {
    if (!s) return;
    const owned = [`ph_${key}_posthog`, `ph_${key}_posthog_session`, `__ph_opt_in_out_${key}`];
    const keys = Array.from({ length: s.length }, (_, i) => s.key(i));
    for (const k of keys) if (k && (k === ATTRIBUTION_KEY || (key && owned.some(prefix => k === prefix || k.startsWith(`${prefix}_`))))) s.removeItem(k);
  } catch { /* storage unavailable */ }
}
