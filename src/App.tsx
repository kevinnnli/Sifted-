/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { UserAccount } from './types';
import { LandingPage } from './components/LandingPage';
import { ForcedPasswordChange } from './components/ChangePasswordForm';
import { ProfessorWorkspace } from './components/ProfessorWorkspace';
import { StudentPortal } from './components/student/StudentPortal';
import { AdminPortal } from './components/AdminPortal';

/**
 * Authentication gate. Who someone is comes only from the server session; each account sees
 * exactly one portal, chosen by its role. There is no way to switch roles or accounts in the UI.
 */
export default function App() {
  // undefined while the session is being checked; null when nobody is signed in
  const [user, setUser] = useState<UserAccount | null | undefined>(undefined);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  // The administrator is inside a test account and can switch back
  const [testSession, setTestSession] = useState(false);

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
      .then((res) => setAiConfigured(Boolean(res.aiConfigured)))
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

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm font-semibold">
        Loading Sifted…
      </div>
    );
  }

  if (!user) {
    const params = new URLSearchParams(window.location.search);
    return <LandingPage onAuthenticated={signedIn} initialTab={params.get('role') || params.get('exam') ? 'login' : 'overview'} />;
  }

  const banner = testSession && user.role !== 'admin' && <TestSessionBanner user={user} onReturn={returnToAdmin} />;

  if (user.mustChangePassword) {
    return <ForcedPasswordChange user={user} onChanged={setUser} onSignOut={handleSignOut} />;
  }

  switch (user.role) {
    case 'admin':
      return <AdminPortal currentAccount={user} onSignOut={handleSignOut} onOpenTestAccount={openTestAccount} />;
    case 'professor':
      return (
        <>
          <ProfessorWorkspace user={user} aiConfigured={aiConfigured} onSignOut={handleSignOut} onUserUpdated={setUser} />
          {banner}
        </>
      );
    case 'applicant':
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 relative">
          <StudentPortal user={user} onSignOut={handleSignOut} onUserUpdated={setUser} />
          {banner}
        </div>
      );
    default:
      return <LandingPage onAuthenticated={signedIn} />;
  }
}

/** Shown while the administrator is using a test account. */
function TestSessionBanner({ user, onReturn }: { user: UserAccount; onReturn: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100%-2rem)] flex items-center gap-3 pl-4 pr-2 py-2 rounded-full bg-purple-700 text-white text-xs font-semibold shadow-2xl shadow-purple-900/50 border border-purple-400/40">
      <span className="truncate">
        Test account: <strong>{user.name}</strong>
      </span>
      <button
        onClick={() => {
          setBusy(true);
          onReturn();
        }}
        disabled={busy}
        className="shrink-0 px-3 py-1.5 rounded-full bg-white text-purple-800 font-bold hover:bg-purple-100 disabled:opacity-60"
      >
        {busy ? 'Switching…' : '← Back to admin'}
      </button>
    </div>
  );
}
