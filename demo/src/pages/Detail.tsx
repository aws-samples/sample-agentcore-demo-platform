import { useParams, useNavigate } from 'react-router-dom';
import { demos, categoryMeta, demoTypeMeta } from '../data/projects';
import Navbar from '../components/Navbar';
import ArchDiagram from '../components/ArchDiagram';
import './Detail.css';

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const item = demos.find((d) => d.id === id);

  if (!item) {
    return (
      <div className="detail page-enter">
        <Navbar showBack />
        <div className="detail__not-found">
          <p>未找到该 Demo</p>
          <button onClick={() => navigate('/')}>返回目录</button>
        </div>
      </div>
    );
  }

  const meta = categoryMeta[item.category];
  const dtMeta = demoTypeMeta[item.demoType];

  return (
    <div className="detail page-enter">
      <Navbar showBack />
      <main className="detail__main">
        <nav className="detail__breadcrumb" aria-label="Breadcrumb">
          <button onClick={() => navigate('/')}>首页</button>
          <span className="detail__breadcrumb-sep">/</span>
          <span style={{ color: meta.color }}>{meta.label}</span>
          <span className="detail__breadcrumb-sep">/</span>
          <span style={{ color: meta.color, opacity: 0.7 }}>{item.subcategory}</span>
          <span className="detail__breadcrumb-sep">/</span>
          <span className="detail__breadcrumb-current">{item.title}</span>
        </nav>

        <div className="detail__layout">
          <div className="detail__content">
            <div className="detail__header">
              <span className="detail__header-icon">{item.icon}</span>
              <h1 className="detail__title">{item.title}</h1>
              {item.status === 'ready' && (
                <span className="detail__type-badge" style={{ color: dtMeta.color, borderColor: dtMeta.color + '40', background: dtMeta.color + '14' }}>
                  {dtMeta.icon} {dtMeta.label}
                </span>
              )}
              <span className={`chip ${item.status === 'ready' ? 'chip--green' : 'chip--muted'}`} style={{ fontSize: '0.76rem' }}>
                {item.status === 'coming-soon' ? '◌ 即将推出'
                  : item.demoType === 'interactive' ? '● 可体验'
                  : item.demoType === 'walkthrough' ? '● 可部署'
                  : item.demoType === 'notebook' ? '● 可学习'
                  : '● 可查看源码'}
              </span>
            </div>

            <p className="detail__desc">{item.description}</p>

            {/* Agents list */}
            {item.agents && item.agents.length > 0 && (
              <section className="detail__agents-section">
                <h2 className="detail__section-title">Agent 团队（{item.agents.length}）</h2>
                <div className="detail__agents-grid">
                  {item.agents.map((a) => (
                    <div
                      key={a.name}
                      className={`detail__agent-card ${a.demoUrl ? 'detail__agent-card--link' : ''}`}
                      onClick={() => a.demoUrl && window.open(a.demoUrl, '_blank')}
                      role={a.demoUrl ? 'link' : undefined}
                      style={a.demoUrl ? { cursor: 'pointer' } : undefined}
                    >
                      <span className="detail__agent-name">{a.name}</span>
                      <span className="detail__agent-role">{a.role}</span>
                      {a.demoUrl && <span className="detail__agent-link-hint">查看详情 →</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA */}
            {item.demoType === 'interactive' && item.status === 'ready' && (
              <section className="detail__cta-section">
                <button className="detail__cta detail__cta--primary" onClick={() => {
                  const url = item.agents?.[0]?.demoUrl || item.demoUrl;
                  if (url) window.open(url, '_blank');
                }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}><polygon points="5,3 15,9 5,15" fill="currentColor" /></svg>
                  启动在线演示
                </button>
                <div className="detail__cta-row">
                  <button className="detail__cta detail__cta--secondary" onClick={() => window.open(item.sourceUrl, '_blank')}>查看源码</button>
                </div>
              </section>
            )}

            {item.demoType === 'walkthrough' && item.status === 'ready' && (
              <section className="detail__cta-section">
                {item.deploySteps && (
                  <div className="detail__deploy">
                    <div className="detail__deploy-header">
                      <h3 className="detail__section-title" style={{ margin: 0 }}>部署步骤</h3>
                      <div className="detail__deploy-meta">
                        {item.estimatedTime && <span className="detail__deploy-tag">⏱ {item.estimatedTime}</span>}
                        {item.estimatedCost && <span className="detail__deploy-tag">💰 {item.estimatedCost}</span>}
                      </div>
                    </div>
                    <ol className="detail__steps">
                      {item.deploySteps.map((s) => (
                        <li key={s.step} className="detail__step">
                          <span className="detail__step-num">{s.step}</span>
                          <div className="detail__step-body">
                            <span className="detail__step-title">{s.title}</span>
                            {s.command && <code className="detail__step-cmd">{s.command}</code>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {!item.deploySteps && item.estimatedTime && (
                  <div className="detail__deploy-meta" style={{ marginBottom: 12 }}>
                    {item.estimatedTime && <span className="detail__deploy-tag">⏱ {item.estimatedTime}</span>}
                    {item.estimatedCost && <span className="detail__deploy-tag">💰 {item.estimatedCost}</span>}
                  </div>
                )}
                <div className="detail__cta-row">
                  <button className="detail__cta detail__cta--primary" onClick={() => window.open(item.sourceUrl, '_blank')}>
                    部署到我的 AWS 账号
                  </button>
                  <button className="detail__cta detail__cta--secondary" onClick={() => window.open(item.sourceUrl, '_blank')}>查看源码</button>
                </div>
              </section>
            )}

            {item.demoType === 'notebook' && (
              <section className="detail__cta-section">
                <button className="detail__cta detail__cta--notebook" onClick={() => window.open(item.sourceUrl, '_blank')}>
                  📓 打开 Notebook
                </button>
                <button className="detail__cta detail__cta--secondary" onClick={() => window.open(item.sourceUrl, '_blank')}>查看源码</button>
              </section>
            )}

            {item.demoType === 'opensource' && item.status === 'ready' && (
              <section className="detail__cta-section">
                <button className="detail__cta detail__cta--primary" onClick={() => window.open(item.sourceUrl, '_blank')}>
                  📦 查看源码
                </button>
              </section>
            )}

            {item.status === 'coming-soon' && (
              <section className="detail__cta-section">
                <div className="detail__coming-soon-banner">🚧 该场景正在建设中，敬请期待</div>
              </section>
            )}

            {/* Labs list for tutorials */}
            {item.labs && item.labs.length > 0 && (
              <section className="detail__labs-section">
                <h2 className="detail__section-title">教程内容（{item.labs.length}）</h2>
                <div className="detail__labs-list">
                  {item.labs.map((lab) => (
                    <a
                      key={lab.step}
                      className="detail__lab-card"
                      href={lab.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="detail__lab-step">{String(lab.step).padStart(2, '0')}</span>
                      <div className="detail__lab-body">
                        <span className="detail__lab-title">{lab.title}</span>
                        {lab.description && <span className="detail__lab-desc">{lab.description}</span>}
                      </div>
                      <span className="detail__lab-arrow">→</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Frameworks */}
            {item.frameworks && item.frameworks.length > 0 && (
              <section className="detail__frameworks-section">
                <h2 className="detail__section-title">支持框架</h2>
                <div className="detail__chip-list">
                  {item.frameworks.map((f) => <span key={f} className="chip chip--purple">{f}</span>)}
                </div>
              </section>
            )}

            {/* Architecture — show if project has its own image, or is a SuperAgent platform demo */}
            {(item.architectureImage || (item.demoUrl?.includes('thinkloop.me'))) && (
              <section className="detail__arch">
                <h2 className="detail__section-title">架构概览</h2>
                <ArchDiagram architectureImage={item.architectureImage} />
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="detail__sidebar">
            <div className="detail__panel">
              <h3 className="detail__panel-title">AgentCore 服务</h3>
              <div className="detail__chip-list">
                {item.agentcoreServices.map((s) => <span key={s} className="chip chip--orange">{s}</span>)}
              </div>
            </div>
            <div className="detail__panel">
              <h3 className="detail__panel-title">AWS 服务</h3>
              <div className="detail__chip-list">
                {item.awsServices.map((s) => <span key={s} className="chip chip--blue">{s}</span>)}
              </div>
            </div>
            <div className="detail__panel">
              <h3 className="detail__panel-title">分类</h3>
              <p className="detail__panel-value" style={{ color: meta.color }}>{meta.label} › {item.subcategory}</p>
            </div>
            <div className="detail__panel">
              <h3 className="detail__panel-title">使用框架</h3>
              <p className="detail__panel-value">{item.framework}</p>
            </div>
            <div className="detail__panel">
              <h3 className="detail__panel-title">源代码</h3>
              <a className="detail__link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                {item.sourceUrl.includes('gitlab') ? '在 GitLab 上查看' : '在 GitHub 上查看'}
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
