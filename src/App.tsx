/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { UserAccount } from './types';
import { LandingPage } from './components/LandingPage';
import { ForcedPasswordChange } from './components/ChangePasswordForm';
import { Notifications } from './components/ui/Notifications';
import { CookieNotice } from './components/ui/CookieNotice';
import { policyForPath, SiteInfo } from './components/legal/policies';

// Each portal is loaded only for the people who use it, which keeps the first page light
const AdminPortal = lazy(() => import('./components/AdminPortal').then((m) => ({ default: m.AdminPortal })));
const ProfessorWorkspace = lazy(() => import('./components/ProfessorWorkspace').then((m) => ({ default: m.ProfessorWorkspace })));
const StudentPortal = lazy(() => import('./components/student/StudentPortal').then((m) => ({ default: m.StudentPortal })));
const PolicyPage = lazy(() => import('./components/legal/PolicyPage'));

function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm font-medium text-slate-600" role="status">
      {label}
    </div>
  );
}

/**
 * Authentication gate. Who someone is comes only from the server session; each account sees
 * exactly one portal, chosen by its role. Policy pages are public.
 */
export default function App() {
  // undefined while the session is being checked; null when nobody is signed in
  const [user, setUser] = useState<UserAccount | null | undefined>(undefined);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [site, setSite] = useState<SiteInfo>({ operator: null, contactEmail: null });
  // The administrator is inside a test account and can switch back
  const [testSession, setTestSession] = useState(false);
  const policy = policyForPath(window.location.pathname);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.auth
      .me()
      .then((res) => {
        setUser(res.user);
        setTestSession(Boolean(res.testSession));
      })
      .catch(() => setUser(null));
    api
      .health()
      .then((res) => {
        setAiConfigured(Boolean(res.aiConfigured));
        if (res.site) setSite(res.site);
      })
      .catch(() => setAiConfigured(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const handleSignOut = async () => {
    try {
      await api.auth.logout();
    } catch {
      // The session is cleared locally either way
    }
    setUser(null);
    setTestSession(false);
  };

  const signedIn = (account: UserAccount) => {
    setUser(account);
    setTestSession(false);
  };

  const openTestAccount = (account: UserAccount) => {
    setUser(account);
    setTestSession(true);
  };

  const returnToAdmin = async () => {
    try {
      const { user: admin } = await api.auth.returnToAdmin();
      setUser(admin);
    } catch {
      setUser(null);
    }
    setTestSession(false);
  };

  let page: React.ReactNode;
  if (policy) {
    page = <PolicyPage policy={policy} site={site} />;
  } else if (user === undefined) {
    page = <Loading />;
  } else if (!user) {
    const params = new URLSearchParams(window.location.search);
    page = <LandingPage onAuthenticated={signedIn} initialTab={params.get('role') || params.get('exam') ? 'login' : 'overview'} />;
  } else if (user.mustChangePassword) {
    page = <ForcedPasswordChange user={user} onChanged={setUser} onSignOut={handleSignOut} />;
  } else if (user.role === 'admin') {
    page = <AdminPortal currentAccount={user} onSignOut={handleSignOut} onOpenTestAccount={openTestAccount} />;
  } else if (user.role === 'professor') {
    page = <ProfessorWorkspace user={user} aiConfigured={aiConfigured} onSignOut={handleSignOut} onUserUpdated={setUser} />;
  } else if (user.role === 'applicant') {
    page = <StudentPortal user={user} onSignOut={handleSignOut} onUserUpdated={setUser} />;
  } else {
    page = <LandingPage onAuthenticated={signedIn} />;
  }

  return (
    <>
      {!policy && testSession && user && user.role !== 'admin' && <TestSessionBar user={user} onReturn={returnToAdmin} />}
      <Suspense fallback={<Loading />}>{page}</Suspense>
      <Notifications />
      <CookieNotice />
    </>
  );
}

/** Shown above everything while the administrator is using a test account. */
function TestSessionBar({ user, onReturn }: { user: UserAccount; onReturn: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div role="region" aria-label="Test account" className="border-b border-amber-300 bg-amber-50 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <span className="truncate">
          Using test account <strong className="font-semibold">{user.name}</strong>
        </span>
        <button
          onClick={() => {
            setBusy(true);
            onReturn();
          }}
          disabled={busy}
          className="shrink-0 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950 disabled:opacity-60"
        >
          {busy ? 'Switching…' : 'Back to admin'}
        </button>
      </div>
    </div>
  );
}
