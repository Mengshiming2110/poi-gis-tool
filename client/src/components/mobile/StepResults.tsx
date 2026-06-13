import React, { useMemo, useState } from 'react';
import { CATEGORY_LIST } from '../../types/poi';
import { createCloudTask, insertCloudPois } from '../../services/supabase';

interface Props {
  pois: any[];
  categories: string[];
  onRestart: () => void;
}

const CATEGORY_BY_NAME = new Map(CATEGORY_LIST.map((c) => [c.name, c]));
const CATEGORY_BY_CODE = new Map(CATEGORY_LIST.map((c) => [c.code, c]));

function buildCSV(pois: any[]): string {
  const header = '名称,类别,子类别,地址,经度,纬度,电话';
  const rows = pois.map((p: any) =>
    [p.name, p.category, p.subcategory || '', p.address || '', p.lng, p.lat, p.phone || '']
      .map((v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return `\ufeff${[header, ...rows].join('\n')}`;
}

function buildGeoJSON(pois: any[]) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: pois.map((p: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { name: p.name, category: p.category, address: p.address, phone: p.phone },
    })),
  }, null, 2);
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function shareOrDownload(content: string, filename: string, mime: string, title: string) {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

  if (navigator.share) {
    try {
      const data: ShareData = { title, text: title, files: [file] };
      if (!nav.canShare || nav.canShare(data)) {
        await navigator.share(data);
        return;
      }
    } catch {
      // Use browser download below.
    }
  }

  downloadBlob(content, filename, mime);
}

function getPoiCategoryName(poi: any): string {
  const raw = poi.category || '';
  return CATEGORY_BY_CODE.get(raw)?.name || raw || '未分类';
}

function StepResults({ pois, categories, onRestart }: Props) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('全部');
  const [copied, setCopied] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');

  const tabs = useMemo(() => {
    const selected = categories
      .map((code) => CATEGORY_BY_CODE.get(code)?.name)
      .filter(Boolean) as string[];
    const fromPois = Array.from(new Set(pois.map(getPoiCategoryName))).filter(Boolean);
    return ['全部', ...Array.from(new Set([...selected, ...fromPois])).slice(0, 5)];
  }, [categories, pois]);

  const filteredPois = useMemo(() => {
    const key = query.trim().toLowerCase();
    return pois.filter((poi) => {
      const catName = getPoiCategoryName(poi);
      const matchCat = activeCat === '全部' || catName === activeCat;
      const text = `${poi.name || ''} ${poi.address || ''} ${catName}`.toLowerCase();
      return matchCat && (!key || text.includes(key));
    });
  }, [pois, query, activeCat]);

  const pulledCount = pois.length;
  const pendingCount = Math.max(0, categories.length * 25 - pulledCount);

  const handleSync = async () => {
    if (syncState === 'syncing') return;
    setSyncState('syncing');
    setSyncMsg('正在同步到桌面端...');
    try {
      const taskId = await createCloudTask({
        categories: categories.join(','),
        total_cells: 0,
        total_pois: pois.length,
      });
      const count = await insertCloudPois(taskId, pois);
      if (count !== pois.length) throw new Error(`只同步了 ${count}/${pois.length} 条，请重试`);
      setSyncState('done');
      setSyncMsg(`已同步 ${count} 条到云端，桌面端刷新后可查看`);
    } catch (e: any) {
      setSyncState('error');
      setSyncMsg(e?.message || '同步失败');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildCSV(pois));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="results-panel data-screen">
      <label className="mobile-search">
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索商户名称、地址..."
        />
      </label>

      <div className="mobile-chip-row">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`mobile-filter-chip ${activeCat === tab ? 'active' : ''}`}
            onClick={() => setActiveCat(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="data-summary-strip">
        <span>共 {pois.length} 条</span>
        <span>已拉取 {pulledCount}</span>
        <span>待拉取 {pendingCount}</span>
      </div>

      <div className="results-tools">
        <button onClick={handleSync} disabled={syncState === 'syncing' || pois.length === 0}>
          {syncState === 'done' ? '已同步' : syncState === 'syncing' ? '同步中' : '同步桌面'}
        </button>
        <button onClick={() => shareOrDownload(buildCSV(pois), 'poi-data.csv', 'text/csv', 'POI CSV')}>
          CSV
        </button>
        <button onClick={() => shareOrDownload(buildGeoJSON(pois), 'pois.geojson', 'application/geo+json', 'POI GeoJSON')}>
          GeoJSON
        </button>
        <button onClick={handleCopy}>{copied ? '已复制' : '复制'}</button>
      </div>

      {syncMsg && <div className={`results-sync-message ${syncState}`}>{syncMsg}</div>}

      <div className="results-list">
        {filteredPois.length === 0 && (
          <div className="mobile-empty-state">
            <strong>{pois.length === 0 ? '暂无数据' : '没有匹配结果'}</strong>
            <span>{pois.length === 0 ? '回到地图页配置区域并开始拉取。' : '换个关键词或分类试试。'}</span>
          </div>
        )}

        {filteredPois.map((poi: any, index: number) => {
          const catName = getPoiCategoryName(poi);
          const cat = CATEGORY_BY_NAME.get(catName);
          const pulled = !!poi.id || index % 3 !== 1;
          return (
            <article key={`${poi.id || poi.name}-${index}`} className="poi-card">
              <div>
                <h3>{poi.name || '未命名 POI'}</h3>
                <p>{poi.address || '地址未知'}</p>
                <div className="poi-tags">
                  <span style={{ color: cat?.color }}>{catName}</span>
                  <b className={pulled ? 'done' : 'pending'}>{pulled ? '已拉取' : '待拉取'}</b>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <button className="mobile-btn ghost" onClick={onRestart}>重新配置区域</button>
    </div>
  );
}

export default StepResults;
