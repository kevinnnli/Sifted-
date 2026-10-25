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

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.auth
      .me()
      .then((res) => setUser(res.user))
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
    return <LandingPage onAuthenticated={setUser} initialTab={params.get('role') || params.get('exam') ? 'login' : 'overview'} />;
  }

  if (user.mustChangePassword) {
    return <ForcedPasswordChange user={user} onChanged={setUser} onSignOut={handleSignOut} />;
  }

  switch (user.role) {
    case 'admin':
      return <AdminPortal currentAccount={user} onSignOut={handleSignOut} />;
    case 'professor':
      return <ProfessorWorkspace user={user} aiConfigured={aiConfigured} onSignOut={handleSignOut} onUserUpdated={setUser} />;
    case 'applicant':
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 relative">
          <StudentPortal user={user} onSignOut={handleSignOut} onUserUpdated={setUser} />
        </div>
      );
    default:
      return <LandingPage onAuthenticated={setUser} />;
  }
}
