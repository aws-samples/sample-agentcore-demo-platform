import './PlatformArch.css';

export default function PlatformArch() {
  return (
    <div className="plat-arch">
      {/* ── Title ── */}
      <div className="plat-arch__title">
        <span className="plat-arch__hex">⬡</span>
        AgentCore Demo Platform — 架构概览
      </div>

      <div className="plat-arch__canvas">
        {/* ── Row 1: Demo Platform (Frontend) ── */}
        <div className="plat-arch__row">
          <div className="plat-arch__box plat-arch__box--platform">
            <div className="plat-arch__box-label">Demo Platform</div>
            <div className="plat-arch__box-sub">React + Vite · 静态前端</div>
            <div className="plat-arch__chips">
              <span className="plat-arch__chip plat-arch__chip--blue">通用场景</span>
              <span className="plat-arch__chip plat-arch__chip--orange">行业场景</span>
              <span className="plat-arch__chip plat-arch__chip--green">功能教程</span>
            </div>
          </div>
        </div>

        {/* ── Connector ── */}
        <div className="plat-arch__connector">
          <svg width="2" height="32" viewBox="0 0 2 32">
            <line x1="1" y1="0" x2="1" y2="32" stroke="var(--accent-orange)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
          </svg>
          <span className="plat-arch__connector-label">链接跳转 / 未来：内嵌 Chat</span>
        </div>

        {/* ── Row 2: Three lanes ── */}
        <div className="plat-arch__row plat-arch__row--three">
          {/* General */}
          <div className="plat-arch__lane">
            <div className="plat-arch__box plat-arch__box--general">
              <div className="plat-arch__box-label">通用场景 Agents</div>
              <div className="plat-arch__box-sub">独立部署 · 各自仓库</div>
              <div className="plat-arch__items">
                <span>客服助手</span>
                <span>运维 Agent</span>
                <span>SRE Agent</span>
                <span>成本优化</span>
                <span>…</span>
              </div>
            </div>
          </div>

          {/* Industry — Super Agent */}
          <div className="plat-arch__lane">
            <div className="plat-arch__box plat-arch__box--industry">
              <div className="plat-arch__box-label">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4, verticalAlign: -2 }}>
                  <path d="M7 1l5.5 3.25v5.5L7 13l-5.5-3.25v-5.5L7 1z" stroke="#FF9900" strokeWidth="1" />
                </svg>
                Super Agent 平台
              </div>
              <div className="plat-arch__box-sub">统一多智能体平台 · 多租户</div>
              <div className="plat-arch__items plat-arch__items--orange">
                <span>HR 智能助手</span>
                <span>IT 运维</span>
                <span>营销内容</span>
                <span>销售助手</span>
                <span>客户服务</span>
              </div>
              <div className="plat-arch__tech-stack">
                Fastify · PostgreSQL · Redis · Claude Agent SDK
              </div>
            </div>
          </div>

          {/* Tutorials */}
          <div className="plat-arch__lane">
            <div className="plat-arch__box plat-arch__box--tutorial">
              <div className="plat-arch__box-label">功能教程</div>
              <div className="plat-arch__box-sub">Notebook · GitHub 仓库</div>
              <div className="plat-arch__items plat-arch__items--green">
                <span>Runtime</span>
                <span>Gateway</span>
                <span>Identity</span>
                <span>Memory</span>
                <span>Tools</span>
                <span>…</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Connector ── */}
        <div className="plat-arch__connector">
          <svg width="2" height="32" viewBox="0 0 2 32">
            <line x1="1" y1="0" x2="1" y2="32" stroke="var(--accent-orange)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
          </svg>
        </div>

        {/* ── Row 3: AgentCore ── */}
        <div className="plat-arch__row">
          <div className="plat-arch__box plat-arch__box--agentcore">
            <div className="plat-arch__box-label">
              <span className="plat-arch__hex plat-arch__hex--sm">⬡</span>
              Amazon Bedrock AgentCore
            </div>
            <div className="plat-arch__services">
              {['Runtime', 'Gateway', 'Identity', 'Memory', 'Tools', 'Observability', 'Policy'].map((s) => (
                <span key={s} className="plat-arch__svc">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Connector ── */}
        <div className="plat-arch__connector">
          <svg width="2" height="24" viewBox="0 0 2 24">
            <line x1="1" y1="0" x2="1" y2="24" stroke="var(--accent-blue)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
          </svg>
        </div>

        {/* ── Row 4: AWS Services ── */}
        <div className="plat-arch__row">
          <div className="plat-arch__box plat-arch__box--aws">
            <div className="plat-arch__box-label">AWS 基础服务</div>
            <div className="plat-arch__services plat-arch__services--aws">
              {['Bedrock', 'Aurora', 'S3', 'Cognito', 'CloudWatch', 'CDK'].map((s) => (
                <span key={s} className="plat-arch__svc plat-arch__svc--aws">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="plat-arch__legend">
        <div className="plat-arch__legend-item">
          <span className="plat-arch__legend-dot" style={{ background: '#4FC3F7' }} />
          <span>第一阶段（当前）：静态展示 + 链接跳转</span>
        </div>
        <div className="plat-arch__legend-item">
          <span className="plat-arch__legend-dot" style={{ background: '#FF9900' }} />
          <span>第二阶段（规划）：内嵌 Chat + AgentCore Runtime 按需启动</span>
        </div>
      </div>
    </div>
  );
}
