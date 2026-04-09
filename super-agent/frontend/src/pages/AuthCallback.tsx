/**
 * OAuth Callback Page
 *
 * Handles the redirect from Cognito Hosted UI after successful authentication.
 * Exchanges the authorization code for tokens, then redirects to the app.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleCallback } from '@/services/cognito';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        return;
      }

      try {
        await handleCallback(code);
        // Force a full page reload to pick up the new auth state
        window.location.href = '/';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    processCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 border border-red-500/50 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-red-400 text-lg mb-2">Authentication Failed</div>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block py-2 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        <p className="mt-4 text-slate-400">Completing sign in...</p>
      </div>
    </div>
  );
}

export default AuthCallback;
