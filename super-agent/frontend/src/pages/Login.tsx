/**
 * Login Page
 *
 * Supports both Cognito (SSO redirect) and local (username/password) auth modes.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/services/AuthContext';
import { useTranslation } from '@/i18n';

export function Login() {
  const { isAuthenticated, isLoading, authMode, login, register, error, clearError } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(username, password, fullName || undefined);
      } else {
        await login(username, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSSOLogin = async () => {
    await login();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('login.title')}</h1>
          <p className="text-slate-400 mt-2">
            {authMode === 'cognito' ? t('login.ssoSubtitle') : (isRegister ? t('login.registerSubtitle') : t('login.signInSubtitle'))}
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {authMode === 'cognito' ? (
            <>
              <button
                onClick={handleSSOLogin}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all"
              >
                {t('login.ssoButton')}
              </button>
              <p className="mt-4 text-center text-xs text-slate-500">
                {t('login.ssoPoweredBy')}
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-1">{t('login.fullName')}</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('login.fullNamePlaceholder')}
                  />
                </div>
              )}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">{t('login.username')}</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('login.usernamePlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">{t('login.password')}</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('login.passwordPlaceholder')}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50"
              >
                {submitting ? t('login.submitting') : (isRegister ? t('login.createAccount') : t('login.signIn'))}
              </button>
              <p className="text-center text-sm text-slate-400">
                {isRegister ? t('login.hasAccount') : t('login.noAccount')}{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(!isRegister); clearError(); }}
                  className="text-blue-400 hover:text-blue-300"
                >
                  {isRegister ? t('login.signIn') : t('login.register')}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
