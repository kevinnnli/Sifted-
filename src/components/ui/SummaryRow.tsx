import React from 'react';

export interface SummaryItem {
  label: string;
  value: React.ReactNode;
  note?: string;
}

/** A row of headline figures: label, value, and a short note, separated by hairlines. */
export function SummaryRow({ items }: { items: SummaryItem[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`border-slate-200 p-5 ${i % 2 === 0 ? 'border-r' : ''} ${i < items.length - 2 ? 'border-b' : ''} lg:border-b-0 ${
            i < items.length - 1 ? 'lg:border-r' : 'lg:border-r-0'
          }`}
        >
          <dt className="text-sm text-slate-600">{item.label}</dt>
          <dd className="mt-1 font-serif text-2xl font-semibold text-slate-900">{item.value}</dd>
          {item.note && <dd className="mt-0.5 text-xs text-slate-500">{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
