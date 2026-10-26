import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { dismiss, Notice, subscribe } from '../../notify';

const STYLES: Record<Notice['kind'], { box: string; icon: React.ReactNode }> = {
  success: { box: 'border-emerald-200 bg-white text-slate-800', icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden /> },
  error: { box: 'border-rose-200 bg-white text-slate-800', icon: <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden /> },
  info: { box: 'border-slate-200 bg-white text-slate-800', icon: <Info className="h-5 w-5 shrink-0 text-brand-600" aria-hidden /> },
};

/** Status messages, announced to assistive technology (errors assertively). */
export function Notifications() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => subscribe(setNotices), []);

  const render = (kind: 'polite' | 'assertive') =>
    notices
      .filter((n) => (kind === 'assertive') === (n.kind === 'error'))
      .map((n) => (
        <div key={n.id} className={`fade-in pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 text-sm shadow-md ${STYLES[n.kind].box}`}>
          {STYLES[n.kind].icon}
          <p className="flex-1 leading-snug">{n.message}</p>
          <button onClick={() => dismiss(n.id)} className="rounded p-0.5 text-slate-600 hover:text-slate-800" aria-label="Dismiss message">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] mx-auto flex w-full max-w-md flex-col gap-2 px-4">
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {render('polite')}
      </div>
      <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
        {render('assertive')}
      </div>
    </div>
  );
}
