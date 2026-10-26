import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { POLICIES } from '../../src/components/legal/policies';
import { ADMIN_RETURN_COOKIE, SESSION_COOKIE, SESSION_IDLE_MS, SESSION_MAX_AGE_MS } from '../security';
import { siteInfo } from '../app';

const DAY = 24 * 60 * 60 * 1000;
const text = (slug: string, site = { operator: null, contactEmail: null }) => {
  const policy = POLICIES.find((p) => p.slug === slug)!;
  return policy
    .sections(site)
    .map((s) => s.title + ' ' + renderToStaticMarkup(React.createElement(React.Fragment, null, s.body)) + ' ' + (s.review || ''))
    .join(' ')
    .replace(/<[^>]+>/g, ' ');
};

describe('policies describe the implementation', () => {
  test('the cookie policy names the cookies and storage keys the code uses', () => {
    const cookies = text('cookies');
    assert.match(cookies, new RegExp(SESSION_COOKIE));
    assert.match(cookies, new RegExp(ADMIN_RETURN_COOKIE));
    assert.match(cookies, /sifted-exam-launch/);
    assert.match(cookies, /sifted-consent/);
  });

  test('stated session lifetimes match the server constants', () => {
    const idleDays = SESSION_IDLE_MS / DAY;
    const maxDays = SESSION_MAX_AGE_MS / DAY;
    for (const slug of ['cookies', 'privacy']) {
      const t = text(slug);
      assert.match(t, new RegExp(`${idleDays} days without activity`), slug);
      assert.match(t, new RegExp(`${maxDays} days after sign-in`), slug);
    }
  });

  test('every policy page exists and none claims to be legally approved', () => {
    assert.deepEqual(POLICIES.map((p) => p.slug).sort(), ['cookies', 'data-deletion', 'privacy', 'refunds', 'terms']);
    for (const p of POLICIES) assert.doesNotMatch(text(p.slug), /legally approved|fully compliant|GDPR compliant/i, p.slug);
  });

  test('operator details come only from configuration', () => {
    assert.match(text('privacy'), /has not yet published their name and contact details/);
    const configured = text('privacy', { operator: 'Example University', contactEmail: 'privacy@example.edu' } as any);
    assert.match(configured, /Example University/);
    assert.match(configured, /privacy@example\.edu/);
  });

  test('site info rejects malformed contact addresses', () => {
    Object.assign(process.env, { SITE_OPERATOR: 'Example University', SITE_CONTACT_EMAIL: 'not an email' });
    assert.deepEqual(siteInfo(), { operator: 'Example University', contactEmail: null });
    delete process.env.SITE_OPERATOR;
    delete process.env.SITE_CONTACT_EMAIL;
    assert.deepEqual(siteInfo(), { operator: null, contactEmail: null });
  });
});

describe('consent', () => {
  test('optional scripts never load before the visitor opts in', async () => {
    const store = new Map<string, string>();
    const appended: string[] = [];
    Object.assign(globalThis, {
      window: { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) }, dispatchEvent: () => true },
      document: { querySelector: () => null, createElement: () => ({}), head: { appendChild: (el: { src: string }) => appended.push(el.src) } },
      CSS: { escape: (s: string) => s },
    });
    const consent = await import('../../src/consent');
    assert.equal(consent.hasConsent('analytics'), false, 'off by default');
    assert.equal(consent.loadOptionalScript('analytics', 'https://example.test/a.js'), false);
    assert.equal(appended.length, 0);
    consent.saveConsent({ analytics: false });
    assert.equal(consent.loadOptionalScript('analytics', 'https://example.test/a.js'), false, 'refusal is respected');
    consent.saveConsent({ analytics: true });
    assert.equal(consent.loadOptionalScript('analytics', 'https://example.test/a.js'), true);
    assert.deepEqual(appended, ['https://example.test/a.js']);
    assert.equal(consent.OPTIONAL_CATEGORIES.length, 0, 'no optional technologies are in use');
  });
});
