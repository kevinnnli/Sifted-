import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SiteFooter } from '../ui/SiteFooter';
import { Wordmark } from '../ui/Wordmark';
import { LAST_UPDATED, POLICIES, PolicyDocument, SiteInfo } from './policies';

/** A policy document, readable whether or not the visitor is signed in. */
export default function PolicyPage({ policy, site }: { policy: PolicyDocument; site: SiteInfo }) {
  useEffect(() => {
    document.title = `${policy.title} · Sifted`;
    return () => {
      document.title = 'Sifted';
    };
  }, [policy]);

  const sections = policy.sections(site);
  const needsReview = sections.filter((s) => s.review);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" aria-label="Sifted home">
            <Wordmark subtitle="Graduate admissions screening" />
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Sifted
          </a>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Policies" className="lg:sticky lg:top-8 lg:self-start">
          <h2 className="mb-3 font-sans text-xs font-semibold uppercase tracking-wider text-slate-600">Policies</h2>
          <ul className="space-y-1 text-sm">
            {POLICIES.map((p) => (
              <li key={p.slug}>
                <a
                  href={`/${p.slug}`}
                  aria-current={p.slug === policy.slug ? 'page' : undefined}
                  className={`block rounded-md px-3 py-1.5 ${p.slug === policy.slug ? 'bg-brand-50 font-semibold text-brand-900' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" className="min-w-0">
          <article className="max-w-3xl">
            <h1 className="text-3xl font-semibold sm:text-4xl">{policy.title}</h1>
            <p className="mt-3 text-lg leading-relaxed text-slate-600">{policy.summary}</p>
            <p className="mt-2 text-sm text-slate-600">Last updated {LAST_UPDATED}</p>

            <aside className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" aria-label="Draft status">
              <strong className="font-semibold">Draft, not yet legally reviewed.</strong> This document describes how the Sifted software handles information.
              {needsReview.length > 0 && (
                <> {needsReview.length} section{needsReview.length === 1 ? '' : 's'} below still need input from the operator or a lawyer, marked “Needs review”.</>
              )}
            </aside>

            <div className="mt-8 space-y-9 text-[15px] text-slate-700">
              {sections.map((section) => (
                <section key={section.title} aria-labelledby={`s-${slug(section.title)}`} className="space-y-3">
                  <h2 id={`s-${slug(section.title)}`} className="text-xl font-semibold">
                    {section.title}
                  </h2>
                  {section.body}
                  {section.review && (
                    <p className="rounded-md border-l-4 border-amber-400 bg-white px-3 py-2 text-sm text-slate-600">
                      <span className="font-semibold text-amber-800">Needs review: </span>
                      {section.review}
                    </p>
                  )}
                </section>
              ))}
            </div>
          </article>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
