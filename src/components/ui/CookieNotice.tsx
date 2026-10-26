import React, { useEffect, useRef, useState } from 'react';
import { getConsent, OPTIONAL_CATEGORIES, saveConsent } from '../../consent';

/**
 * Cookie notice and settings. Sifted uses only strictly necessary storage, so the notice informs
 * rather than asks; when optional categories exist they appear here as opt-in switches (off by
 * default) with equal "Accept" and "Reject" choices.
 */
export function CookieNotice() {
  const [showBanner, setShowBanner] = useState(() => getConsent() === null);
  const [showSettings, setShowSettings] = useState(false);
  const [choices, setChoices] = useState<Record<string, boolean>>(() => ({ ...(getConsent()?.granted || {}) }));
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasOptional = OPTIONAL_CATEGORIES.length > 0;

  useEffect(() => {
    const open = () => {
      setChoices({ ...(getConsent()?.granted || {}) });
      setShowSettings(true);
    };
    window.addEventListener('sifted-open-cookie-settings', open);
    return () => window.removeEventListener('sifted-open-cookie-settings', open);
  }, []);

  useEffect(() => {
    if (!showSettings) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowSettings(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSettings]);

  const decide = (granted: Record<string, boolean>) => {
    saveConsent(granted);
    setShowBanner(false);
    setShowSettings(false);
  };
  const allOptional = (value: boolean) => Object.fromEntries(OPTIONAL_CATEGORIES.map((c) => [c.id, value]));

  return (
    <>
      {showBanner && !showSettings && (
        // Reserves room at the end of the page so the notice never covers content
        <div aria-hidden className="h-36 md:h-24" />
      )}
      {showBanner && !showSettings && (
        <section
          aria-label="Cookie notice"
          className="fixed inset-x-0 bottom-0 z-[110] border-t border-slate-200 bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-sm text-slate-700 sm:px-6 md:flex-row md:items-center md:justify-between">
            <p className="max-w-3xl leading-relaxed">
              {hasOptional
                ? 'Sifted uses cookies that are necessary for signing in and security, and, only if you agree, optional cookies described in our '
                : 'Sifted uses only the cookies and browser storage needed to keep you signed in and to run tests. There are no analytics or advertising cookies. See our '}
              <a href="/cookies" className="font-medium text-brand-700 underline underline-offset-2">
                Cookie Policy
              </a>
              .
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              {hasOptional ? (
                <>
                  <button onClick={() => decide(allOptional(false))} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50">
                    Reject optional
                  </button>
                  <button onClick={() => decide(allOptional(true))} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50">
                    Accept optional
                  </button>
                  <button onClick={() => setShowSettings(true)} className="rounded-md px-4 py-2 font-semibold text-brand-700 underline underline-offset-2">
                    Choose
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowSettings(true)} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50">
                    Details
                  </button>
                  <button onClick={() => decide({})} className="rounded-md bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-800">
                    Understood
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={() => setShowSettings(false)}>
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-settings-title"
            onClick={(e) => e.stopPropagation()}
            className="fade-in w-full max-w-lg rounded-xl bg-white p-6 shadow-xl outline-none"
          >
            <h2 id="cookie-settings-title" className="text-xl font-semibold">
              Cookie settings
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-sans text-sm font-semibold text-slate-900">Strictly necessary</h3>
                  <span className="text-xs font-semibold text-slate-600">Always on</span>
                </div>
                <p className="mt-1.5 leading-relaxed text-slate-600">
                  Your sign-in session, and temporary storage used when you open a test in a new tab and to remember this choice. The site does not work
                  without them.
                </p>
              </div>
              {hasOptional ? (
                OPTIONAL_CATEGORIES.map((category) => (
                  <label key={category.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4">
                    <span>
                      <span className="block font-semibold text-slate-900">{category.label}</span>
                      <span className="mt-1.5 block leading-relaxed text-slate-600">{category.description}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 accent-brand-700"
                      checked={choices[category.id] === true}
                      onChange={(e) => setChoices((c) => ({ ...c, [category.id]: e.target.checked }))}
                    />
                  </label>
                ))
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-sans text-sm font-semibold text-slate-900">Analytics and advertising</h3>
                  <p className="mt-1.5 leading-relaxed text-slate-600">Not used. Sifted does not include any analytics, advertising or tracking tools.</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <a href="/cookies" className="mr-auto self-center text-sm font-medium text-brand-700 underline underline-offset-2">
                Cookie Policy
              </a>
              <button onClick={() => setShowSettings(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Close
              </button>
              <button onClick={() => decide(hasOptional ? choices : {})} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
