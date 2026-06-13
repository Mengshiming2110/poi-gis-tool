import React, { useState, useMemo } from 'react';
import { CATEGORY_LIST } from '../../types/poi';

const CATEGORY_COLORS: Record<string, string> = {};
CATEGORY_LIST.forEach((c) => { CATEGORY_COLORS[c.name] = c.color; });

interface Props {
  pois: any[];
}

function MobileDataTab({ pois }: Props) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [detail, setDetail] = useState<any | null>(null);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    pois.forEach((p: any) => { if (p.category) seen.add(p.category); });
    return ['全部', ...Array.from(seen)];
  }, [pois]);

  const filtered = useMemo(() => {
    return pois.filter((p: any) => {
      if (catFilter !== 'all' && p.category !== catFilter) return false;
      if (search && !p.name?.includes(search) && !p.address?.includes(search)) return false;
      return true;
    });
  }, [pois, search, catFilter]);

  if (detail) {
    return (
      <div className="mobile-detail-push show">
        <div className="mobile-detail-header">
          <button onClick={() => setDetail(null)}>←</button>
          <span className="t">商户详情</span>
        </div>
        <div className="mobile-detail-body">
          <div className="mobile-info-card">
            <span className="mobile-tag cat" style={{ marginBottom: 8, display: 'inline-block' }}>{detail.category}</span>
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 10 }}>{detail.name}</h2>
            <div className="mobile-info-row"><span className="k">地址</span><span className="v">{detail.address || '—'}</span></div>
            <div className="mobile-info-row"><span className="k">POI ID</span><span className="v">{detail.id || '—'}</span></div>
            <div className="mobile-info-row"><span className="k">电话</span><span className="v">{detail.phone || '—'}</span></div>
            <div className="mobile-info-row"><span className="k">坐标</span><span className="v">{detail.lng?.toFixed(5)},{detail.lat?.toFixed(5)}</span></div>
          </div>
        </div>
        <div className="mobile-detail-actions">
          {detail.phone && <a href={`tel:${detail.phone}`} className="mobile-tab" style={{ textDecoration: 'none', color: 'inherit', flex: 1, padding: 10, borderRadius: 5, border: '1px solid var(--border)', textAlign: 'center', fontSize: 12 }}>📞 拨打电话</a>}
          <button onClick={() => setDetail(null)}>返回列表</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mobile-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6"><circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/></svg>
        <input type="text" placeholder="搜索商户名称、地址…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="mobile-filter-row">
        {categories.map(c => (
          <button key={c}
            className={`mobile-pill ${(c === '全部' ? catFilter === 'all' : catFilter === c) ? 'on' : ''}`}
            onClick={() => setCatFilter(c === '全部' ? 'all' : c)}
          >{c}</button>
        ))}
      </div>
      <div className="mobile-poi-cards">
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
            {pois.length === 0 ? '暂无数据，请先在地图页完成采集' : '无匹配结果'}
          </div>
        )}
        {filtered.map((p: any, i: number) => (
          <div key={i} className="mobile-poi-card" onClick={() => setDetail(p)}>
            <div className="n">{p.name}</div>
            <div className="a">{p.subcategory || p.category} {p.address ? '· ' + p.address : ''}</div>
            <div className="tags">
              <span className="mobile-tag cat">{p.category}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default MobileDataTab;
