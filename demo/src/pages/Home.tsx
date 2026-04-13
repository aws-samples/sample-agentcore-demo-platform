import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { demos, categoryMeta, demoTypeMeta, type DemoItem } from '../data/projects';
import Navbar from '../components/Navbar';
import './Home.css';

type Cat = DemoItem['category'];
const categories: Cat[] = ['enterprise', 'industry', 'capability'];

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<Cat, boolean>>({
    enterprise: false,
    industry: false,
    capability: false,
    tutorial: false,
  });

  const filtered = useMemo(() => {
    const ready = demos.filter((d) => d.status !== 'coming-soon');
    if (!search.trim()) return ready;
    const q = search.toLowerCase();
    return ready.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.subcategory.toLowerCase().includes(q) ||
        d.agentcoreServices.some((s) => s.toLowerCase().includes(q)) ||
        d.awsServices.some((s) => s.toLowerCase().includes(q)) ||
        d.framework.toLowerCase().includes(q) ||
        d.demoType.toLowerCase().includes(q) ||
        demoTypeMeta[d.demoType].label.toLowerCase().includes(q) ||
        d.agents?.some((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)),
    );
  }, [search]);

  const toggle = (cat: Cat) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const byCategory = (cat: Cat) => filtered.filter((d) => d.category === cat);

  // Group items by subcategory within a category
  const groupBySubcategory = (items: DemoItem[]) => {
    const groups: Record<string, DemoItem[]> = {};
    for (const item of items) {
      const key = item.subcategory;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  };

  // Sort items: ready first, coming-soon last
  const sortByStatus = (items: DemoItem[]) =>
    [...items].sort((a, b) => (a.status === 'ready' ? 0 : 1) - (b.status === 'ready' ? 0 : 1));

  // Fixed industry subcategory order and icons
  const industryOrder = ['游戏', '零售', '汽车', '制造', '金融', '医疗', '媒体', '教育'];
  const industryIcons: Record<string, string> = {
    '游戏': '🎮', '零售': '👗', '汽车': '🚗', '制造': '🏭',
    '金融': '🏦', '医疗': '🏥', '媒体': '📺', '教育': '🎓',
  };

  return (
    <div className="home page-enter">
      <Navbar search={search} onSearch={setSearch} />

      <main className="home__main">
        <div className="home__hero">
          <h1 className="home__title">
            <span className="home__title--accent">AgentCore Catalyst</span> Demo Gallery
          </h1>
          <p className="home__desc">
            精选企业职能与行业场景方案，搭配核心能力教程，全方位体验 Amazon Bedrock AgentCore。
          </p>
        </div>

        {categories.map((cat) => {
          const items = byCategory(cat);
          const meta = categoryMeta[cat];
          if (items.length === 0 && search.trim()) return null;

          const groups = groupBySubcategory(items);
          const isIndustry = cat === 'industry';
          const isTutorial = cat === 'tutorial';

          return (
            <section key={cat} className="home__section">
              <button
                className="home__section-header"
                onClick={() => toggle(cat)}
                aria-expanded={!collapsed[cat]}
              >
                <span className="home__section-bar" style={{ background: meta.color }} />
                <span className="home__section-icon" style={{ color: meta.color }}>{meta.icon}</span>
                <span className="home__section-label">{meta.label}</span>
                <span className="home__section-count">{items.length}</span>
                <span className={`home__section-chevron ${collapsed[cat] ? '' : 'home__section-chevron--open'}`}>›</span>
              </button>
              {!collapsed[cat] && <p className="home__section-desc">{meta.description}</p>}
              {!collapsed[cat] && (
                isTutorial ? (
                  /* Tutorial: flat grid, no subgroups */
                  <div className="home__grid">
                    {sortByStatus(items).map((item, i) => (
                      <DemoCard key={item.id} item={item} index={i} onClick={() => navigate(`/demo/${item.id}`)} />
                    ))}
                    {items.length === 0 && <p className="home__empty">未找到匹配的 Demo</p>}
                  </div>
                ) : (
                  /* All other categories: always show subgroups */
                  <>
                    {(isIndustry ? industryOrder : Object.keys(groups)).map((sub) => {
                      const subItems = groups[sub] || [];
                      if (subItems.length === 0) return null;
                      return (
                        <div key={sub} className="home__subgroup">
                          <div className="home__subgroup-header">
                            <span className="home__subgroup-icon">{isIndustry ? (industryIcons[sub] || '◈') : (subItems[0]?.icon || '◈')}</span>
                            <span className="home__subgroup-label">{sub}</span>
                            <span className="home__subgroup-count">{subItems.length}</span>
                          </div>
                          <div className="home__grid">
                            {sortByStatus(subItems).map((item, i) => (
                              <DemoCard key={item.id} item={item} index={i} onClick={() => navigate(`/demo/${item.id}`)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}

function DemoCard({ item, index, onClick }: { item: DemoItem; index: number; onClick: () => void }) {
  const dtMeta = demoTypeMeta[item.demoType];
  const catMeta = categoryMeta[item.category];
  const chipColor = item.category === 'enterprise' ? 'chip--blue' : item.category === 'industry' ? 'chip--orange' : item.category === 'capability' ? 'chip--purple' : 'chip--green';

  return (
    <article
      className={`card ${item.status === 'coming-soon' ? 'card--muted' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={item.status === 'ready' ? onClick : undefined}
      tabIndex={item.status === 'ready' ? 0 : -1}
      role={item.status === 'ready' ? 'button' : undefined}
      onKeyDown={(e) => item.status === 'ready' && e.key === 'Enter' && onClick()}
    >
      <div className="card__top">
        <div className="card__title-row">
          <span className="card__icon">{item.icon}</span>
          <h3 className="card__title">{item.title}</h3>
        </div>
        {item.status === 'ready' && (
          <span
            className="card__demo-type"
            style={{ color: dtMeta.color, borderColor: dtMeta.color + '40', background: dtMeta.color + '14' }}
          >
            {dtMeta.icon} {dtMeta.label}
          </span>
        )}
      </div>
      <p className="card__desc">{item.description}</p>
      {item.agents && item.agents.length > 0 && (
        <div className="card__agents">
          <span className="card__agents-count">{item.agents.length} Agent{item.agents.length > 1 ? 's' : ''}</span>
          <span className="card__agents-names">{item.agents.slice(0, 3).map(a => a.name).join(' · ')}{item.agents.length > 3 ? ' …' : ''}</span>
        </div>
      )}
      <div className="card__tags">
        {item.agentcoreServices.slice(0, 3).map((s) => (
          <span key={s} className={`chip ${chipColor}`}>{s}</span>
        ))}
        {item.agentcoreServices.length > 3 && (
          <span className="chip chip--muted">+{item.agentcoreServices.length - 3}</span>
        )}
      </div>
      <div className="card__footer">
        <span className="card__framework">{item.framework}</span>
        <span className="card__subcategory" style={{ color: catMeta.color }}>{item.subcategory}</span>
        {item.status === 'coming-soon' && <span className="card__coming-soon">即将推出</span>}
      </div>
    </article>
  );
}
