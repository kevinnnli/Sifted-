import React from 'react';

/** The Sifted name set in the serif face, with an optional descriptor. */
export function Wordmark({ subtitle, inverted = false }: { subtitle?: string; inverted?: boolean }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`font-serif text-xl font-semibold tracking-tight ${inverted ? 'text-white' : 'text-brand-900'}`}>Sifted</span>
      {subtitle && <span className={`mt-1 text-[11px] font-medium uppercase tracking-[0.12em] ${inverted ? 'text-brand-100' : 'text-slate-600'}`}>{subtitle}</span>}
    </span>
  );
}
