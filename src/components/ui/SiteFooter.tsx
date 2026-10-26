import React from 'react';
import { openCookieSettings } from '../../consent';

export const POLICY_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/cookies', label: 'Cookie Policy' },
  { href: '/data-deletion', label: 'Data Deletion' },
  { href: '/refunds', label: 'Refund Policy' },
];

/** Footer with the policy links and cookie settings, shown on every page. */
export function SiteFooter({ note }: { note?: React.ReactNode }) {
  return (
    <footer className="border-t border-slate-200 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-600 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="font-serif text-sm font-semibold text-brand-900">Sifted</span>
          <span className="ml-2">Graduate admissions screening</span>
          {note && <span className="ml-2 text-slate-600">· {note}</span>}
        </div>
        <nav aria-label="Policies">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {POLICY_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="underline-offset-2 hover:text-brand-800 hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <button type="button" onClick={openCookieSettings} className="underline-offset-2 hover:text-brand-800 hover:underline">
                Cookie settings
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
