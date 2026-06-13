import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import MapView from './MapView';
import UpdatePrompt from './UpdatePrompt';
import { useCollection } from '../hooks/useCollection';
import { useSSE } from '../hooks/useSSE';
import { getExportUrl, queryPois } from '../services/api';
import { createCloudTask, insertCloudPois, getTasks, type CloudTask } from '../services/supabase';
import { checkForUpdate, CURRENT_VERSION, RELEASES_URL, type UpdateInfo } from '../services/updater';
import { CATEGORY_LIST, type PoiRecord } from '../types/poi';
import type { MapAPI, DrawnShape, GridCell } from './MapView';
import '../App.css';

const CAT_NAME: Record<string, string> = {};
const CAT_COLOR: Record<string, string> = {};
CATEGORY_LIST.forEach(c => { CAT_NAME[c.code] = c.name; CAT_COLOR[c.code] = c.color; });
function catName(code: string): string { return CAT_NAME[code] || code; }

function buildCSV(pois: any[]): string {
  const header = '名称,类别,子类别,地址,经度,纬度,电话';
  const rows = pois.map((p: any) =>
    [p.name, p.category, p.subcategory || '', p.address || '', p.lng, p.lat, p.phone || '']
      .map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return `﻿${[header, ...rows].join('\n')}`;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function ApiKeyField({ label, storageKey, placeholder }: { label: string; storageKey: string; placeholder: string }) {
  const [value, setValue] = useState(localStorage.getItem(storageKey) || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const v = value.trim();
    if (v) localStorage.setItem(storageKey, v);
    else localStorage.removeItem(storageKey);
    localStorage.removeItem('amap_quota_block_day');
    localStorage.removeItem('amap_quota_block_key');
    localStorage.removeItem('amap_quota_block_message');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input-field" type="password" value={value} onChange={e => setValue(e.target.value)}
          placeholder={placeholder} style={{ flex: 1 }} />
        <button className="desktop-btn primary" onClick={handleSave}
          style={{ justifyContent: 'center', fontSize: 11, padding: '0 14px', whiteSpace: 'nowrap' }}>
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>
    </div>
  );
}

function clientExport(pois: any[], format: 'csv' | 'geojson') {
  if (format === 'csv') {
    downloadBlob(buildCSV(pois), 'poi-data.csv', 'text/csv');
  } else {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: pois.map((p: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { name: p.name, category: p.category, address: p.address, phone: p.phone },
      })),
    }, null, 2);
    downloadBlob(geojson, 'pois.geojson', 'application/geo+json');
  }
}

type View = 'map' | 'search' | 'progress' | 'detail' | 'manage' | 'settings';

const NAV_WORKFLOW = [
  { id: 'map' as View, label: '地图工作台' },
  { id: 'search' as View, label: '搜索筛选' },
  { id: 'progress' as View, label: '采集进度' },
  { id: 'detail' as View, label: '商户详情' },
];
const NAV_MANAGE = [
  { id: 'manage' as View, label: '数据管理' },
  { id: 'settings' as View, label: '系统设置' },
];

// Data loading
const POLL_INTERVAL = 5000;

function DesktopApp() {
  const [view, setView] = useState<View>('map');
  const [dark, setDark] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [gridSizeMeters, setGridSizeMeters] = useState(500);
  const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | null>('polygon');
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [apiStatus, setApiStatus] = useState<'idle' | 'busy' | 'error'>('idle');
  const [searchFilter, setSearchFilter] = useState({ type: '全部', region: 'all', query: '' });
  const [selectedPoi, setSelectedPoi] = useState<PoiRecord | null>(null);
  const [collectedPois, setCollectedPois] = useState<PoiRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [cloudTasks, setCloudTasks] = useState<CloudTask[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);

  const drawAPIRef = useRef<MapAPI | null>(null);
  const collection = useCollection();

  useEffect(() => {
    checkForUpdate().then((info) => {
      if (info.available) setUpdateInfo(info);
      else if (info.error) setUpdateInfo(info); // store error state for UI display
    });
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') { setDark(true); document.documentElement.classList.add('dark'); }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    if (collection.status === 'running') setApiStatus('busy');
    else if (collection.error) setApiStatus('error');
    else setApiStatus('idle');
  }, [collection.status, collection.error]);
  useSSE(collection.taskId, collection.onProgress, collection.onComplete, collection.onError);

  // Load POIs when taskId changes or collection status changes
  useEffect(() => {
    if (!collection.taskId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 3;

    const load = async () => {
      try {
        const result = await queryPois({ taskId: collection.taskId!, page: 1, pageSize: 500 });
        if (!cancelled) {
          console.log(`[Desktop] POI加载完成: ${result.pois.length} 条, total=${result.total}, status=${collection.status}`);
          setCollectedPois(result.pois);
        }
      } catch (e: any) {
        console.warn(`[Desktop] POI加载失败 (attempt ${attempts + 1}/${maxAttempts}):`, e?.message);
        attempts++;
      }
    };

    load();
    if (collection.status === 'running') {
      const interval = setInterval(load, POLL_INTERVAL);
      return () => { cancelled = true; clearInterval(interval); };
    }
    return () => { cancelled = true; };
  }, [collection.taskId, collection.status]);

  // Show POI markers on map when data or view changes
  useEffect(() => {
    if (collectedPois.length > 0 && drawAPIRef.current) {
      drawAPIRef.current.showPoiMarkers(
        collectedPois.map(p => ({
          lng: p.lng, lat: p.lat,
          name: p.name,
          color: CAT_COLOR[p.category] || 'var(--accent)',
        }))
      );
    }
  }, [collectedPois]);
  // Re-show markers when switching to map view (map may have resized/re-initialized)
  useEffect(() => {
    if (view === 'map' && collectedPois.length > 0 && drawAPIRef.current) {
      setTimeout(() => {
        drawAPIRef.current?.showPoiMarkers(
          collectedPois.map(p => ({
            lng: p.lng, lat: p.lat,
            name: p.name,
            color: CAT_COLOR[p.category] || 'var(--accent)',
          }))
        );
      }, 300);
    }
  }, [view]);

  // Computed stats from real data
  const { regionStats, duplicateCount } = useMemo(() => {
    const byCategory: Record<string, number> = {};
    let dups = 0;
    const seen = new Set<string>();
    collectedPois.forEach(p => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      const key = p.name + p.address;
      if (seen.has(key)) dups++;
      else seen.add(key);
    });
    const regions = [{ name: '当前区域', done: collectedPois.length, total: Math.max(collection.progress.totalPois, collectedPois.length, 1), cats: Object.entries(byCategory).map(([code, c]) => ({ n: catName(code), c })) }];
    return { regionStats: regions, duplicateCount: dups };
  }, [collectedPois, collection.progress.totalCells]);

  // POI helpers
  const filteredPois = useMemo(() => {
    return collectedPois.filter(p => {
      if (searchFilter.type !== '全部' && catName(p.category) !== searchFilter.type) return false;
      if (searchFilter.query && !p.name?.includes(searchFilter.query) && !p.address?.includes(searchFilter.query)) return false;
      return true;
    });
  }, [collectedPois, searchFilter]);

  const categories = useMemo(() => ['全部', ...new Set(collectedPois.map(p => catName(p.category)))], [collectedPois]);

  const showToast = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  }, []);
  useEffect(() => { if (collection.error) showToast(collection.error, 'error'); }, [collection.error, showToast]);

  const handleMapReady = useCallback((api: MapAPI) => { drawAPIRef.current = api; }, []);
  const handleShapeChange = useCallback((shape: DrawnShape | null) => { setDrawnShape(shape); setGridCells([]); }, []);
  const handleSplitGrid = useCallback(() => {
    const api = drawAPIRef.current;
    if (!api?.getDrawnShape()) { showToast('请先绘制区域', 'error'); return; }
    const count = api.splitGrid(gridSizeMeters);
    count > 0 ? showToast(`${count} 个网格`, 'success') : showToast('网格切分失败', 'error');
  }, [gridSizeMeters, showToast]);
  const handleStart = useCallback(() => {
    const bounds = drawAPIRef.current?.getBounds() || { southwest: { lng: 116.3, lat: 39.8 }, northeast: { lng: 116.5, lat: 40.0 } };
    const amapKey = (localStorage.getItem('amap_rest_key') || '').trim();
    const skipDuplicates = localStorage.getItem('amap_skip_dup') !== 'false';
    const debugMode = localStorage.getItem('amap_debug_mode') === 'true';
    if (!amapKey && !debugMode) { showToast('请先在系统设置中配置高德 Web 服务 Key，或开启调试模式', 'error'); return; }
    collection.start({ mode: 'region', categories: selectedCategories, bounds, gridSize: gridSizeMeters / 111320, skipDuplicates, amapKey: amapKey || 'debug', debug: debugMode });
    setView('progress');
    showToast('开始采集', 'info');
  }, [selectedCategories, gridSizeMeters, collection, showToast]);

  const disabled = selectedCategories.length === 0 || collection.status === 'running';

  const renderMapView = () => (
    <div className="desktop-map-view">
      <MapView onMapReady={handleMapReady} onShapeChange={handleShapeChange} onGridChange={setGridCells}>
        {/* Right panel: config */}
        <div className="desktop-map-panel">
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 6 }}>绘制工具</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {([
                { id: 'rectangle' as const, label: '□ 矩形' },
                { id: 'polygon' as const, label: '⬠ 多边形' },
                { id: 'circle' as const, label: '○ 圆形' },
              ]).map(m => (
                <button key={m.id}
                  className="desktop-btn"
                  style={{
                    flex: 1, justifyContent: 'center', fontSize: 11,
                    background: drawMode === m.id ? 'var(--accent)' : undefined,
                    color: drawMode === m.id ? '#fff' : undefined,
                    borderColor: drawMode === m.id ? 'var(--accent)' : undefined,
                  }}
                  onClick={() => {
                    if (drawMode === m.id) { setDrawMode(null); drawAPIRef.current?.setDrawMode(null); }
                    else { setDrawMode(m.id); drawAPIRef.current?.setDrawMode(m.id); }
                  }}
                >{m.label}</button>
              ))}
              <button className="desktop-btn" style={{
                justifyContent: 'center', fontSize: 11, color: 'var(--warn)',
              }} onClick={() => { drawAPIRef.current?.clearDrawings(); setDrawMode(null); setDrawnShape(null); setGridCells([]); }}>✕</button>
            </div>
            {drawMode && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '5px 8px', borderRadius: 4 }}>
                {drawMode === 'polygon'
                  ? '点击地图添加顶点，双击完成多边形'
                  : drawMode === 'rectangle'
                    ? '点击地图设第一个角，移动鼠标预览，再点击完成矩形'
                    : '点击地图设圆心，移动鼠标预览，再点击设半径'}
                <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: 'var(--muted)' }}>按 Esc 取消绘制</span>
              </div>
            )}
            {drawnShape && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--success)' }}>
                ✓ 已绘制 {drawnShape.type === 'circle' ? `圆形 (r${Math.round(drawnShape.geometry.radius)}m)` : drawnShape.type}
              </div>
            )}
          </div>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 6 }}>POI 分类</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {CATEGORY_LIST.map(c => (
                <button key={c.code}
                  onClick={() => setSelectedCategories(prev => prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code])}
                  className="desktop-btn" style={{
                    justifyContent: 'flex-start', fontSize: 11,
                    background: selectedCategories.includes(c.code) ? 'var(--accent-dim)' : 'var(--surface)',
                    borderColor: selectedCategories.includes(c.code) ? 'var(--accent)' : 'var(--border)',
                    color: selectedCategories.includes(c.code) ? 'var(--accent)' : 'var(--muted)',
                  }}
                >{c.name}</button>
              ))}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>网格精度</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{gridSizeMeters}m</span>
            </div>
            <input type="range" min={100} max={2000} step={50} value={gridSizeMeters} onChange={e => setGridSizeMeters(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: 4 }} />
            <div style={{ display: 'flex', gap: 3 }}>
              {[500, 1000, 1500].map(v => (
                <button key={v} onClick={() => setGridSizeMeters(v)} className="desktop-btn"
                  style={{ flex: 1, justifyContent: 'center', fontSize: 11, background: v === gridSizeMeters ? 'var(--accent-dim)' : undefined, borderColor: v === gridSizeMeters ? 'var(--accent)' : undefined, color: v === gridSizeMeters ? 'var(--accent)' : undefined }}
                >{v}m</button>
              ))}
            </div>
            <button onClick={handleSplitGrid} className="desktop-btn primary" style={{ width: '100%', marginTop: 6, justifyContent: 'center' }}>
              {drawnShape ? `切分 (${gridCells.length || '—'}格)` : '切分'}
            </button>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
              已选 {selectedCategories.length} 类 · {gridCells.length || 0} 格 · 预估 {selectedCategories.length * (gridCells.length || 0)} 次请求
            </div>
            <button onClick={handleStart} disabled={disabled}
              className="desktop-btn primary" style={{ width: '100%', justifyContent: 'center', padding: '8px 0', fontSize: 13, fontWeight: 600 }}>
              ▶ 开始采集
            </button>
          </div>
        </div>
      </MapView>
    </div>
  );

  const renderSearchView = () => (
    <div style={{ display: 'flex', height: '100%' }}>
      <div className="desktop-data-list">
        <div className="desktop-data-search">
          <input className="input-field" placeholder="搜索商户名称、地址..."
            value={searchFilter.query} onChange={e => setSearchFilter(prev => ({ ...prev, query: e.target.value }))} />
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>商户类型</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {categories.map(t => (
              <button key={t} className="desktop-btn" style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 99,
                background: searchFilter.type === t ? 'var(--accent)' : undefined,
                color: searchFilter.type === t ? '#fff' : undefined,
              }} onClick={() => setSearchFilter(prev => ({ ...prev, type: t }))}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: '4px 14px', fontSize: 11, color: 'var(--muted)' }}>{filteredPois.length} 条结果</div>
        <div className="scroll">
          {collectedPois.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              {collection.taskId ? '数据加载中...' : '暂无采集数据'}
            </div>
          )}
          {filteredPois.map((p, i) => (
            <div key={i} className="desktop-poi-row" onClick={() => { setSelectedPoi(p); setView('detail'); }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLOR[p.category] || 'var(--muted)', display: 'inline-block', flexShrink: 0 }} />
                  {catName(p.category) || '—'} · {p.address || '—'}
                </div>
              </div>
              <span className="badge badge-success">已采集</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
        {filteredPois.length > 0 ? `← 选择商户查看详情（点击行或切换到"商户详情"视图）` : (collectedPois.length > 0 ? '无匹配结果，尝试修改筛选条件' : '暂无采集数据，请先在地图工作台执行采集')}
      </div>
    </div>
  );

  const renderProgressView = () => {
    const { doneCells, totalCells, totalPois } = collection.progress;
    const totalAll = Math.max(totalPois, collectedPois.length, 1);
    const done = collectedPois.length;
    const remaining = Math.max(totalAll - done, 0);
    const pct = totalAll > 0 ? Math.round((done / totalAll) * 100) : 0;

    return (
      <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', width: '100%', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          <div className="stat-card"><div className="v">{totalAll || '—'}</div><div className="l">总数</div></div>
          <div className="stat-card"><div className="v" style={{ color: 'var(--accent)' }}>{done}</div><div className="l">已采集 · {pct}% 完成</div></div>
          <div className="stat-card"><div className="v">{remaining}</div><div className="l">待采集 · 剩余</div></div>
          <div className="stat-card"><div className="v" style={{ color: 'var(--warn)' }}>{duplicateCount}</div><div className="l">重复 · 需处理</div></div>
        </div>
        {regionStats.map(r => {
          const rPct = Math.round((r.done / Math.max(r.total, 1)) * 100);
          return r.done > 0 ? (
            <div key={r.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                <span style={{ fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{r.done}/{r.total}</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${rPct}%`, background: 'var(--accent)', borderRadius: 3 }} />
              </div>
              {r.cats.length > 0 && (
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                  {r.cats.map(c => <span key={c.n}>{c.n}: {c.c} 条</span>)}
                </div>
              )}
            </div>
          ) : null;
        })}
        {(collection.status === 'running' || collection.status === 'paused') && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {collection.status === 'running' && (
              <button className="desktop-btn" style={{ justifyContent: 'center' }}
                onClick={() => { collection.pause(); showToast('已暂停', 'info'); }}>
                ⏸ 暂停采集
              </button>
            )}
            {collection.status === 'paused' && (
              <button className="desktop-btn primary" style={{ justifyContent: 'center' }}
                onClick={() => { collection.resume(); showToast('已恢复', 'info'); }}>
                ▶ 继续采集
              </button>
            )}
            <button className="desktop-btn" style={{ justifyContent: 'center', color: 'var(--warn)' }}
              onClick={() => { collection.cancel(); showToast('已取消', 'info'); }}>
              ⏹ 取消采集
            </button>
          </div>
        )}
        {collectedPois.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['商户名称', '类别', '地址', '坐标', '状态'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {collectedPois.slice(0, 100).map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px', fontSize: 12 }}>{p.name}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--muted)', fontSize: 11 }}>{catName(p.category) || '—'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--muted)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address || '—'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{p.lng?.toFixed(4)},{p.lat?.toFixed(4)}</td>
                  <td style={{ padding: '6px 8px' }}><span className="badge badge-success">已采集</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {collectedPois.length === 0 && collection.status === 'done' && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ color: 'var(--success)', fontWeight: 600, marginBottom: 4 }}>采集完成</div>
            <div style={{ color: 'var(--muted)' }}>
              共 {collection.progress.totalPois || 0} 条 POI 已入库
              {collection.progress.totalPois === 0 ? '（该区域未搜索到匹配的 POI）' : ''}
            </div>
          </div>
        )}
        {collectedPois.length === 0 && collection.status !== 'done' && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
            {collection.taskId ? '数据加载中...' : '暂无数据，请先在地图工作台执行采集'}
          </div>
        )}
      </div>
    );
  };

  const renderDetailView = () => (
    <div style={{ display: 'flex', height: '100%' }}>
      <div className="desktop-data-list">
        <div style={{ padding: '14px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>商户列表</div>
        <div className="scroll">
          {collectedPois.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              {collection.taskId ? '数据加载中...' : '暂无采集数据'}
            </div>
          )}
          {collectedPois.map((p, i) => (
            <div key={i} className="desktop-poi-row" style={{ background: selectedPoi?.id === p.id ? 'var(--accent-dim)' : undefined }}
              onClick={() => setSelectedPoi(p)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLOR[p.category] || 'var(--muted)', display: 'inline-block', flexShrink: 0 }} />
                  {catName(p.category)} · {p.address || '—'}
                </div>
              </div>
              <span className="badge badge-success">已采集</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
          ← 选择左侧商户查看详情
        </div>
      </div>
      <div style={{ flex: 1, padding: 20 }}>
        {selectedPoi ? (
          <div className="card" style={{ maxWidth: 500 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: (CAT_COLOR[selectedPoi.category] || 'var(--accent)') + '20', color: CAT_COLOR[selectedPoi.category] || 'var(--accent)', marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLOR[selectedPoi.category] || 'var(--accent)' }} />
              {catName(selectedPoi.category)}
              {selectedPoi.subcategory ? ` · ${selectedPoi.subcategory}` : ''}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12 }}>{selectedPoi.name}</h2>
            {[
              ['地址', selectedPoi.address || '—'],
              ['电话', selectedPoi.phone || '—'],
              ['坐标', `${selectedPoi.lng?.toFixed(5)},${selectedPoi.lat?.toFixed(5)}`],
              ['采集时间', selectedPoi.collected_at?.replace('T', ' ').slice(0, 19) || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: 11 }}>{k}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: k === '坐标' || k === 'POI ID' ? 12 : 13 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {selectedPoi.phone && <a href={`tel:${selectedPoi.phone}`} className="desktop-btn primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>📞 拨打电话</a>}
              <button className="desktop-btn" style={{ flex: 1 }}
                onClick={() => {
                  const lng = selectedPoi.lng, lat = selectedPoi.lat;
                  if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
                    showToast('坐标数据无效', 'error'); return;
                  }
                  try { drawAPIRef.current?.flyTo(lng, lat); } catch (e) { console.warn('[Desktop] flyTo error:', e); }
                  setView('map');
                }}>
                📍 在地图中查看
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>
            ← 选择左侧商户查看详情
          </div>
        )}
      </div>
    </div>
  );

  const handleUpload = async () => {
    if (!collectedPois.length) return;
    setSyncStatus('syncing');
    try {
      const cats = [...new Set(collectedPois.map(p => p.category))].join(',');
      const taskId = await createCloudTask({ categories: cats, total_cells: 0, total_pois: collectedPois.length });
      await insertCloudPois(taskId, collectedPois.map(p => ({
        name: p.name, category: p.category || '', subcategory: p.subcategory || '',
        address: p.address || '', lng: p.lng, lat: p.lat, phone: p.phone || '',
      })));
      setSyncStatus('done');
      showToast(`已上传 ${collectedPois.length} 条到云端`, 'success');
    } catch (e: any) {
      setSyncStatus('error');
      showToast(e?.message || '上传失败', 'error');
    }
  };

  const handleUploadRef = useRef(handleUpload);
  handleUploadRef.current = handleUpload;

  // Auto-upload when collection completes and toggle is on
  const prevStatusRef = useRef(collection.status);
  useEffect(() => {
    const wasRunning = prevStatusRef.current === 'running';
    prevStatusRef.current = collection.status;
    if (wasRunning && collection.status === 'done' && collection.taskId && collectedPois.length > 0) {
      if (localStorage.getItem('amap_auto_upload') === 'true') {
        handleUploadRef.current();
      }
    }
  }, [collection.status, collectedPois.length]);

  const renderManageView = () => (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', width: '100%', overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card">
          <div style={{ fontSize: 28, marginBottom: 4 }}>☁</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>云端上传</h3>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>将已采集数据上传至云端服务器，支持增量同步。</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="desktop-btn primary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleUpload} disabled={collectedPois.length === 0 || syncStatus === 'syncing'}>
              {syncStatus === 'syncing' ? '上传中...' : syncStatus === 'done' ? '✅ 已上传' : syncStatus === 'error' ? '❌ 重试' : `上传全部 (${collectedPois.length}条)`}
            </button>
          </div>
          {syncStatus === 'done' && <p style={{ fontSize: 10, color: 'var(--success)', marginTop: 6 }}>上传成功</p>}
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>☁ 云端任务</h3>
            <button className="desktop-btn" style={{ padding: '3px 12px', fontSize: 11 }}
              onClick={async () => {
                setLoadingCloud(true);
                try { setCloudTasks(await getTasks()); } catch { showToast('获取云端数据失败', 'error'); }
                setLoadingCloud(false);
              }}>
              {loadingCloud ? '加载中...' : '🔄 刷新'}
            </button>
          </div>
          {cloudTasks.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              {loadingCloud ? '加载中...' : '点击刷新查看已上传到云端的任务'}
            </p>
          ) : (
            cloudTasks.slice(0, 5).map(t => (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 500 }}>{(() => {
                    try { return JSON.parse(t.categories).join('、'); } catch { return t.categories; }
                  })()}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                    {new Date(t.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                  {t.total_pois} 条 POI · {t.status === 'done' ? '✅ 已完成' : t.status}
                  <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{t.id.slice(0, 8)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <div style={{ fontSize: 28, marginBottom: 4 }}>📥</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>数据导出</h3>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
            {collection.taskId ? '通过服务端导出 Excel/GeoJSON 格式。' : '客户端导出 CSV/GeoJSON 格式。'}
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="desktop-btn primary" style={{ flex: 1, justifyContent: 'center' }}
              disabled={!collection.taskId && collectedPois.length === 0}
              onClick={() => {
                if (collection.taskId) window.open(getExportUrl(collection.taskId, 'xlsx'), '_blank');
                else clientExport(collectedPois, 'csv');
              }}>
              {collection.taskId ? '导出 Excel' : '导出 CSV'}
            </button>
            <button className="desktop-btn" style={{ flex: 1, justifyContent: 'center' }}
              disabled={!collection.taskId && collectedPois.length === 0}
              onClick={() => {
                if (collection.taskId) window.open(getExportUrl(collection.taskId, 'geojson'), '_blank');
                else clientExport(collectedPois, 'geojson');
              }}>
              导出 GeoJSON
            </button>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>📊 按区域存储</h3>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>已采集数据按类别分组统计。</p>
        {regionStats.map(r => (
          <div key={r.name} style={{ marginBottom: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{r.done} 条 · {Math.round((r.done / Math.max(r.total, 1)) * 100)}%</span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
              {r.cats.map(c => <span key={c.n}>{c.n}: {c.c} 条</span>)}
            </div>
          </div>
        ))}
        {collectedPois.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', padding: 12 }}>暂无数据</p>}
      </div>
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🔄 重复检测</h3>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>采集前自动比对已存储数据，避免同一商户被重复采集。</p>
        {duplicateCount > 0 ? (
          <>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>最近检测到 {duplicateCount} 条重复记录：</p>
            {collectedPois.filter((p, i, arr) => arr.findIndex(x => x.name === p.name && x.address === p.address) !== i).slice(0, 5).map((p, i) => (
              <div key={i} style={{ fontSize: 12, padding: '6px 10px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 4, marginBottom: 4 }}>
                ▲ {p.name} — 重复于当前区域
              </div>
            ))}
          </>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{collectedPois.length > 0 ? '未检测到重复记录 ✓' : '暂无数据'}</p>
        )}
      </div>
    </div>
  );

  const renderSettingsView = () => (
    <div style={{ padding: 20, maxWidth: 680, margin: '0 auto', width: '100%', overflow: 'auto' }}>
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>🔑 高德开放平台 API</h4>
        {(() => {
          const blockedDay = localStorage.getItem('amap_quota_block_day');
          const today = new Date().toISOString().slice(0, 10);
          if (blockedDay === today) {
            return (
              <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fff7ed', border: '1px solid #fed7aa', fontSize: 12, color: 'var(--warn)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⚠ 今日配额已用完</span>
                <button onClick={() => { localStorage.removeItem('amap_quota_block_day'); localStorage.removeItem('amap_quota_block_key'); localStorage.removeItem('amap_quota_block_message'); }}
                  style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #fed7aa', background: '#fff', color: 'var(--warn)', fontSize: 11, cursor: 'pointer' }}>清除</button>
              </div>
            );
          }
          return null;
        })()}
        <ApiKeyField label="API Key (Web服务)" storageKey="amap_rest_key" placeholder="输入高德 Web服务 Key" />
        <ApiKeyField label="API Key (JS API)" storageKey="amap_js_key" placeholder="输入高德 JS API Key" />
        <ApiKeyField label="安全密钥" storageKey="amap_security_code" placeholder="输入高德安全密钥（JS API用）" />
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>⚙ 采集参数</h4>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            搜索半径 · {localStorage.getItem('amap_search_radius') || '1000'}m
          </label>
          <input type="range" defaultValue={Number(localStorage.getItem('amap_search_radius')) || 1000} min={100} max={5000} step={100}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
            onChange={e => { localStorage.setItem('amap_search_radius', e.target.value); e.target.parentElement!.querySelector('label')!.textContent = `搜索半径 · ${e.target.value}m`; }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>单次请求上限</label>
            <input className="input-field" type="number" defaultValue={localStorage.getItem('amap_page_size') || '25'}
              onBlur={e => { const v = e.target.value.trim(); if (v) localStorage.setItem('amap_page_size', v); }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>请求间隔 (ms)</label>
            <input className="input-field" type="number" defaultValue={localStorage.getItem('amap_request_delay') || '200'}
              onBlur={e => { const v = e.target.value.trim(); if (v) localStorage.setItem('amap_request_delay', v); }} />
          </div>
        </div>
        <div className="desktop-set-row">
          <span>自动跳过重复项</span>
          <div className={`desktop-toggle ${localStorage.getItem('amap_skip_dup') !== 'false' ? 'on' : ''}`}
            onClick={e => { const t = e.currentTarget; t.classList.toggle('on'); localStorage.setItem('amap_skip_dup', t.classList.contains('on') ? 'true' : 'false'); }} />
        </div>
        <div className="desktop-set-row">
          <span>采集完成后自动上传</span>
          <div className={`desktop-toggle ${localStorage.getItem('amap_auto_upload') === 'true' ? 'on' : ''}`}
            onClick={e => { const t = e.currentTarget; t.classList.toggle('on'); localStorage.setItem('amap_auto_upload', t.classList.contains('on') ? 'true' : 'false'); }} />
        </div>
        <div className="desktop-set-row">
          <span>🔧 调试模式（模拟POI数据）</span>
          <div className={`desktop-toggle ${localStorage.getItem('amap_debug_mode') === 'true' ? 'on' : ''}`}
            onClick={e => { const t = e.currentTarget; t.classList.toggle('on'); localStorage.setItem('amap_debug_mode', t.classList.contains('on') ? 'true' : 'false'); }} />
        </div>
      </div>
      <div className="card">
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>📋 版本管理</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>v{CURRENT_VERSION}</span>
          <span style={{ fontSize: 11, color: updateInfo?.error ? 'var(--warn)' : updateInfo?.available ? 'var(--accent)' : 'var(--muted)' }}>
            {updateInfo?.error ? '⚠ 检查失败，点击下方按钮手动下载' : updateInfo?.available ? `发现 ${updateInfo.version}` : '✓ 已是最新'}
          </span>
        </div>
        <button className="desktop-btn" style={{ width: '100%', justifyContent: 'center', padding: '6px 0' }}
          onClick={() => checkForUpdate().then(i => {
            if (i.available) setUpdateInfo(i);
            else if (i.error) setUpdateInfo(i);
            else setUpdateInfo(null);
          })}>🔄 检查更新</button>
        {updateInfo?.error && (
          <a href={updateInfo.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 12, color: 'var(--accent)' }}>
            访问 GitHub Releases 页面手动下载 →
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="desktop-app">
      {/* Sidebar */}
      <nav className="desktop-sidebar">
        <div className="desktop-sidebar-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
          POI GIS 采集
        </div>
        <div className="desktop-nav-section">采集工作流</div>
        {NAV_WORKFLOW.map(item => (
          <button key={item.id}
            className={`desktop-nav-item ${view === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}>{item.label}</button>
        ))}
        <div className="desktop-nav-section">管理</div>
        {NAV_MANAGE.map(item => (
          <button key={item.id}
            className={`desktop-nav-item ${view === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}>{item.label}</button>
        ))}
        <div className="desktop-sidebar-footer">
          <button className="desktop-nav-item" onClick={() => setDark(!dark)}>
            {dark ? '☀️ 亮色模式' : '🌙 暗色模式'}
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="desktop-main">
        <div className="desktop-topbar">
          <span className="desktop-topbar-title">{NAV_WORKFLOW.concat(NAV_MANAGE).find(n => n.id === view)?.label}</span>
          <div className="desktop-topbar-spacer" />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>v{CURRENT_VERSION}</span>
        </div>

        <div className="desktop-viewport">
          <div className={`desktop-view ${view === 'map' ? 'active' : ''}`}>{renderMapView()}</div>
          <div className={`desktop-view ${view === 'search' ? 'active' : ''}`}>{renderSearchView()}</div>
          <div className={`desktop-view ${view === 'progress' ? 'active' : ''}`}>{renderProgressView()}</div>
          <div className={`desktop-view ${view === 'detail' ? 'active' : ''}`}>{renderDetailView()}</div>
          <div className={`desktop-view ${view === 'manage' ? 'active' : ''}`}>{renderManageView()}</div>
          <div className={`desktop-view ${view === 'settings' ? 'active' : ''}`}>{renderSettingsView()}</div>
        </div>

        <div className="desktop-statusbar">
          <span className={`desktop-status-dot ${apiStatus === 'idle' ? 'idle' : ''}`} style={{ background: apiStatus === 'busy' ? 'var(--accent)' : apiStatus === 'error' ? 'var(--warn)' : 'var(--muted)' }} />
          <span>采集状态: {apiStatus === 'busy' ? '采集中' : apiStatus === 'error' ? '异常' : '空闲'}</span>
          <span>{drawnShape ? (drawnShape.type === 'circle' ? `圆形 r${Math.round(drawnShape.geometry.radius)}m` : drawnShape.type) : '未圈选'}</span>
          <span>{collectedPois.length > 0 ? `${collectedPois.length}条 · ` : ''}{gridCells.length}格 · {selectedCategories.length}类</span>
          <span>API: {apiStatus === 'error' ? '异常' : '正常'}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>网格 {gridSizeMeters}m</span>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: '#fff',
          background: toast.type === 'error' ? 'var(--warn)' : toast.type === 'success' ? 'var(--success)' : '#1e293b',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)', pointerEvents: 'none',
        }}>{toast.msg}</div>
      )}
      {updateInfo && (
        <UpdatePrompt version={updateInfo.version} url={updateInfo.url} body={updateInfo.body} downloadUrl={updateInfo.downloadUrl} onDismiss={() => setUpdateInfo(null)} />
      )}
    </div>
  );
}

export default DesktopApp;
