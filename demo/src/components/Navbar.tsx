import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import './Navbar.css';

interface Props {
  search?: string;
  onSearch?: (v: string) => void;
  showBack?: boolean;
}

/**
 * Attempt to fetch the current user's alias via Midway SSO.
 * Silently returns empty string on non-Amazon networks.
 */
async function fetchMidwayAlias(): Promise<string> {
  const url =
    'https://midway-auth.amazon.com/SSO?' +
    new URLSearchParams({
      scope: 'openid',
      response_type: 'id_token',
      client_id: window.location.origin,
      redirect_uri: window.location.href,
      nonce: Math.random().toString(36).slice(2),
    }).toString();
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return '';
  const token = await res.text();
  const payload = JSON.parse(
    atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
  );
  return (payload.sub as string) || '';
}

export default function Navbar({ search, onSearch, showBack }: Props) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [userAlias, setUserAlias] = useState('');

  useEffect(() => {
    fetchMidwayAlias().then(setUserAlias).catch(() => {});
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <button className="navbar__brand" onClick={() => navigate('/')}>
          <img src="/aws-icons/bedrock-agentcore.svg" width={22} height={22} alt="" style={{ borderRadius: 3 }} />
          <span className="navbar__name">AgentCore Catalyst</span>
          <span className="navbar__badge">Demo Gallery</span>
        </button>

        {showBack && (
          <button className="navbar__back" onClick={() => navigate('/')}>
            ← 返回目录
          </button>
        )}

        {onSearch && (
          <div className="navbar__search-wrap">
            <svg className="navbar__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.3" />
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              className="navbar__search"
              type="text"
              placeholder="搜索 Demo、服务、行业..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="搜索"
            />
            {search && (
              <button className="navbar__search-clear" onClick={() => onSearch('')} aria-label="清除搜索">
                ×
              </button>
            )}
          </div>
        )}

        <div className="navbar__actions">
          <button
            className="navbar__nav-link"
            onClick={() => navigate('/architecture')}
          >
            架构
          </button>
          <a
            className="navbar__icon-btn"
            href="https://github.com/aws-samples/sample-agentcore-demo-platform"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
          <button
            className="navbar__icon-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            title={theme === 'dark' ? '浅色模式' : '深色模式'}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="4" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M15.1 10.4A6.5 6.5 0 017.6 2.9a7 7 0 107.5 7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          {userAlias ? (
            <div className="navbar__user-badge" title={userAlias}>
              👤 {userAlias}
            </div>
          ) : (
            <div className="navbar__user-badge">👤 Guest</div>
          )}
        </div>
      </div>
    </nav>
  );
}
