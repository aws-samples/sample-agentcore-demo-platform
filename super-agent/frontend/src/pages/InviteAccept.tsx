/**
 * Invite Acceptance Page
 *
 * Handles the invite link flow:
 * 1. Validates the token from the URL
 * 2. Shows the invited email + org name
 * 3. User sets password + full name
 * 4. Creates account and logs in
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setLocalToken } from '@/services/auth';
import { useTranslation } from '@/i18n';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

interface InviteInfo {
  email: string;
  role: string;
  organizationName: string;
}

export function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/auth/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t('invite.invalidLink'));
        }
        return res.json();
      })
      .then((data) => setInfo(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('invite.passwordMismatch'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, fullName: fullName || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('invite.acceptFailed'));
      }
      const data = await res.json();
      setLocalToken(data.token);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">{t('invite.validating')}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
            <div className="text-red-400 text-4xl mb-4">✗</div>
            <h2 className="text-xl font-bold text-white mb-2">{t('invite.invalidTitle')}</h2>
            <p className="text-slate-400 text-sm mb-6">{error || t('invite.invalidDesc')}</p>
            <a href="/login" className="text-blue-400 hover:text-blue-300 text-sm">{t('invite.goToLogin')}</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('invite.joinOrg').replace('{name}', info.organizationName)}</h1>
          <p className="text-slate-400 mt-2">
            {t('invite.invitedAs')} <span className="text-cyan-400 font-medium">{info.role}</span>
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('invite.email')}</label>
              <input
                type="text"
                value={info.email}
                disabled
                className="w-full px-4 py-2.5 bg-slate-700/30 border border-slate-600 rounded-lg text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-1">{t('invite.fullName')}</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('invite.fullNamePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">{t('invite.password')}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('invite.passwordPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1">{t('invite.confirmPassword')}</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('invite.confirmPlaceholder')}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50"
            >
              {submitting ? t('invite.submitting') : t('invite.accept')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default InviteAccept;
