/**
 * Cookie and storage consent.
 *
 * Sifted itself only uses storage that is strictly necessary (the sign-in cookie, and short-lived
 * local storage for features the user asks for), which does not require consent. Optional
 * categories such as analytics are listed in OPTIONAL_CATEGORIES; there are none today. If one is
 * ever added, its scripts must be loaded through loadOptionalScript(), which refuses to load
 * anything until the visitor has opted in. Nothing optional is on by default.
 */

export interface OptionalCategory {
  id: 'analytics';
  label: string;
  description: string;
  scripts: string[];
}

// No optional technologies are in use. Add an entry here (and to the Cookie Policy) before
// introducing any analytics or similar tool.
export const OPTIONAL_CATEGORIES: OptionalCategory[] = [];

const KEY = 'sifted-consent';
export const CONSENT_VERSION = 1;

export interface ConsentRecord {
  version: number;
  decidedAt: string;
  granted: Partial<Record<OptionalCategory['id'], boolean>>;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // blocked by the browser
  }
}

export function getConsent(): ConsentRecord | null {
  try {
    const raw = storage()?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ConsentRecord) : null;
    return parsed && parsed.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function saveConsent(granted: ConsentRecord['granted']) {
  const record: ConsentRecord = { version: CONSENT_VERSION, decidedAt: new Date().toISOString(), granted };
  try {
    storage()?.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage blocked: the notice will simply show again next time
  }
  window.dispatchEvent(new Event('sifted-consent-changed'));
  return record;
}

/** Whether the visitor has opted in to an optional category. Defaults to no. */
export function hasConsent(category: OptionalCategory['id']): boolean {
  return getConsent()?.granted[category] === true;
}

/** Loads an optional script only after consent for its category. Returns whether it was loaded. */
export function loadOptionalScript(category: OptionalCategory['id'], src: string): boolean {
  if (!hasConsent(category)) return false;
  if (document.querySelector(`script[src="${CSS.escape(src)}"]`)) return true;
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  document.head.appendChild(script);
  return true;
}

export const openCookieSettings = () => window.dispatchEvent(new Event('sifted-open-cookie-settings'));
