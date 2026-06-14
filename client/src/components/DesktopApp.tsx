import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import MapView from './MapView';
import UpdatePrompt from './UpdatePrompt';
import { useCollection } from '../hooks/useCollection';
import { useSSE } from '../hooks/useSSE';
import { getExportUrl, markPoisSynced, mergeCloudPois as mergePoisToDb, queryPoiLibrary, queryPoiLibraryStats, queryPois, type PoiLibraryStats } from '../services/api';
import { createCloudTask, insertCloudPois, getTasks, getPois, type CloudTask } from '../services/supabase';
import { checkForUpdate, CURRENT_VERSION, RELEASES_URL, type UpdateInfo } from '../services/updater';
import { CATEGORY_LIST, type PoiRecord } from '../types/poi';
import type { MapAPI, DrawnShape, GridCell } from './MapView';
import '../App.css';

const CAT_NAME: Record<string, string> = {};
const CAT_COLOR: Record<string, string> = {};
CATEGORY_LIST.forEach(c => { CAT_NAME[c.code] = c.name; CAT_COLOR[c.code] = c.color; });
function catName(code: string): string { return CAT_NAME[code] || code; }

function poiKey(p: Pick<PoiRecord, 'id' | 'name' | 'address' | 'lng' | 'lat'>): string {
  return p.id ? String(p.id) : `${p.name || ''}_${p.address || ''}_${Number(p.lng || 0).toFixed(5)}_${Number(p.lat || 0).toFixed(5)}`;
}

function formatPoiTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
}

function uniqueDuplicateKeys(pois: PoiRecord[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  pois.forEach((p) => {
    const key = `${p.name || ''}_${p.address || ''}`.trim();
    if (!key || key === '_') return;
    if (seen.has(key)) duplicates.add(poiKey(p));
    else seen.add(key);
  });
  return duplicates;
}

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
  const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | 'marker' | null>('polygon');
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [apiStatus, setApiStatus] = useState<'idle' | 'busy' | 'error'>('idle');
  const [searchFilter, setSearchFilter] = useState({ type: '全部', region: 'all', query: '' });
  const [selectedPoi, setSelectedPoi] = useState<PoiRecord | null>(null);
  const [collectedPois, setCollectedPois] = useState<PoiRecord[]>([]);
  const [manualDuplicateKeys, setManualDuplicateKeys] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [libraryPois, setLibraryPois] = useState<PoiRecord[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryStats, setLibraryStats] = useState<PoiLibraryStats | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [districtDrill, setDistrictDrill] = useState<string | null>(null);
  const [drillPois, setDrillPois] = useState<PoiRecord[]>([]);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [cloudTasks, setCloudTasks] = useState<CloudTask[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [lastLibrarySync, setLastLibrarySync] = useState<string | null>(localStorage.getItem('poi_last_cloud_sync'));

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
  const buildMarkers = (pois: typeof collectedPois) => pois.map(p => ({
    lng: p.lng, lat: p.lat,
    name: p.name,
    category: catName(p.category),
    address: p.address || undefined,
    phone: p.phone || undefined,
    color: CAT_COLOR[p.category] || 'var(--accent)',
  }));

  useEffect(() => {
    if (collectedPois.length > 0 && drawAPIRef.current) {
      drawAPIRef.current.showPoiMarkers(buildMarkers(collectedPois));
    }
  }, [collectedPois]);

  useEffect(() => {
    if (view === 'map' && collectedPois.length > 0 && drawAPIRef.current) {
      setTimeout(() => { drawAPIRef.current?.showPoiMarkers(buildMarkers(collectedPois)); }, 300);
    }
  }, [view]);

  // Computed stats from real data
  const autoDuplicateKeys = useMemo(() => uniqueDuplicateKeys(collectedPois), [collectedPois]);
  const duplicateKeys = useMemo(() => new Set([...autoDuplicateKeys, ...manualDuplicateKeys]), [autoDuplicateKeys, manualDuplicateKeys]);

  const { regionStats, duplicateCount } = useMemo(() => {
    const byCategory: Record<string, number> = {};
    collectedPois.forEach(p => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    });
    const total = Math.max(collection.progress.totalPois, collectedPois.length, collection.progress.totalCells || 0, 1);
    const regions = [{ name: '区域 A — 当前圈选', done: collectedPois.length, total, cats: Object.entries(byCategory).map(([code, c]) => ({ n: catName(code), c })) }];
    return { regionStats: regions, duplicateCount: duplicateKeys.size };
  }, [collectedPois, collection.progress.totalCells, collection.progress.totalPois, duplicateKeys]);

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

  const loadPoiLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const [result, stats] = await Promise.all([
        queryPoiLibrary({ page: 1, pageSize: 500 }),
        queryPoiLibraryStats(),
      ]);
      setLibraryPois(result.pois);
      setLibraryTotal(result.total);
      setLibraryStats(stats);
    } catch (e: any) {
      showToast(e?.message || '读取本地数据库失败', 'error');
    } finally {
      setLoadingLibrary(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (view === 'manage') loadPoiLibrary();
  }, [view, loadPoiLibrary]);

  useEffect(() => {
    if (collection.status === 'done') loadPoiLibrary();
  }, [collection.status, loadPoiLibrary]);

  useEffect(() => { if (collection.error) showToast(collection.error, 'error'); }, [collection.error, showToast]);

  useEffect(() => {
    if (!selectedPoi && collectedPois.length > 0) setSelectedPoi(collectedPois[0]);
    if (selectedPoi && collectedPois.length > 0 && !collectedPois.some(p => poiKey(p) === poiKey(selectedPoi))) {
      setSelectedPoi(collectedPois[0]);
    }
  }, [collectedPois, selectedPoi]);

  const toggleDuplicate = useCallback((poi: PoiRecord) => {
    const key = poiKey(poi);
    setManualDuplicateKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        showToast('已取消重复标记', 'info');
      } else {
        next.add(key);
        showToast('已标记为重复', 'success');
      }
      return next;
    });
  }, [showToast]);

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
      <MapView onMapReady={handleMapReady} onShapeChange={handleShapeChange} onGridChange={setGridCells} onDrawModeChange={setDrawMode}>
        {/* Right panel: config */}
        <div className="desktop-map-panel">
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 6 }}>绘制工具</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {([
                { id: 'rectangle' as const, label: '□ 矩形' },
                { id: 'polygon' as const, label: '⬠ 多边形' },
                { id: 'circle' as const, label: '○ 圆形' },
                { id: 'marker' as const, label: '• 标注点' },
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
                    : drawMode === 'circle'
                      ? '点击地图设圆心，移动鼠标预览，再点击设半径'
                      : '点击地图添加一个人工标注点，添加后自动退出'}
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


  const renderProgressProductView = () => {
    const { doneCells, totalCells, totalPois } = collection.progress;
    const totalAll = Math.max(totalPois, collectedPois.length, totalCells, 1);
    const done = collectedPois.length;
    const remaining = Math.max(totalAll - done, 0);
    const pct = Math.min(100, Math.round((done / Math.max(totalAll, 1)) * 100));
    const progressAngle = `${pct * 3.6}deg`;
    const rows = collectedPois.slice(0, 100);

    return (
      <div className="desktop-progress-page">
        <div className="progress-stat-grid">
          <div className="progress-stat-card"><span>总数</span><strong>{totalAll}</strong><em>区域 A</em></div>
          <div className="progress-stat-card"><span>已采集</span><strong>{done}</strong><em>{pct}% 完成</em></div>
          <div className="progress-stat-card"><span>待采集</span><strong>{remaining}</strong><em>剩余</em></div>
          <div className="progress-stat-card"><span>重复</span><strong className="warn">{duplicateCount}</strong><em className="warn">需处理</em></div>
        </div>

        <div className="progress-overview">
          <div className="progress-ring" style={{ background: `conic-gradient(var(--accent) ${progressAngle}, var(--border) 0)` }}>
            <div>{pct}%</div>
          </div>
          <div className="progress-region-list">
            {regionStats.map((r) => {
              const rPct = Math.min(100, Math.round((r.done / Math.max(r.total, 1)) * 100));
              return (
                <div key={r.name} className="progress-region-row">
                  <div><span>{r.name}</span><b>{r.done}/{r.total}</b></div>
                  <div className="progress-track"><i style={{ width: `${rPct}%` }} /></div>
                  {r.cats.length > 0 && <p>{r.cats.map(c => `${c.n} ${c.c}条`).join(' · ')}</p>}
                </div>
              );
            })}
            <div className="progress-region-meta">
              网格 {doneCells}/{Math.max(totalCells, doneCells, 0)} · API {apiStatus === 'error' ? '异常' : apiStatus === 'busy' ? '调用中' : '正常'}
            </div>
          </div>
        </div>

        {(collection.status === 'running' || collection.status === 'paused') && (
          <div className="progress-actions">
            {collection.status === 'running' && <button className="desktop-btn" onClick={() => { collection.pause(); showToast('已暂停', 'info'); }}>暂停采集</button>}
            {collection.status === 'paused' && <button className="desktop-btn primary" onClick={() => { collection.resume(); showToast('已恢复', 'info'); }}>继续采集</button>}
            <button className="desktop-btn danger" onClick={() => { collection.cancel(); showToast('已取消', 'info'); }}>取消采集</button>
          </div>
        )}

        <div className="progress-table-card">
          {rows.length > 0 ? (
            <table className="progress-table">
              <thead><tr>{['商户名称', '类型', '区域', '地址', '状态', '采集时间'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((p) => {
                  const duplicated = duplicateKeys.has(poiKey(p));
                  return (
                    <tr key={poiKey(p)} onClick={() => { setSelectedPoi(p); setView('detail'); }}>
                      <td>{p.name}</td>
                      <td>{catName(p.category) || '—'}</td>
                      <td>区域 A</td>
                      <td>{p.address || '—'}</td>
                      <td><span className={`status-pill ${duplicated ? 'warn' : 'done'}`}>{duplicated ? '重复' : '已采集'}</span></td>
                      <td>{formatPoiTime(p.collected_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="desktop-empty-state">
              <strong>{collection.taskId ? '等待采集结果' : '暂无采集任务'}</strong>
              <span>{collection.taskId ? '采集中的 POI 会显示在这里。' : '请先在地图工作台圈选区域并开始采集。'}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMerchantDetailView = () => {
    const detailPois = filteredPois.length > 0 ? filteredPois : collectedPois;
    const activePoi = selectedPoi || detailPois[0] || null;
    const locatePoi = (poi: PoiRecord) => {
      if (typeof poi.lng !== 'number' || typeof poi.lat !== 'number' || isNaN(poi.lng) || isNaN(poi.lat)) {
        showToast('坐标数据无效', 'error');
        return;
      }
      try { drawAPIRef.current?.flyTo(poi.lng, poi.lat); } catch (e) { console.warn('[Desktop] flyTo error:', e); }
      setSelectedPoi(poi);
      setView('map');
    };

    return (
      <div className="merchant-detail-page">
        <aside className="merchant-list-pane">
          <div className="merchant-list-title">商户列表</div>
          <div className="merchant-list-scroll">
            {detailPois.length === 0 && (
              <div className="desktop-empty-state compact">
                <strong>暂无商户</strong>
                <span>{collection.taskId ? '数据加载中...' : '请先执行采集。'}</span>
              </div>
            )}
            {detailPois.map((p) => {
              const duplicated = duplicateKeys.has(poiKey(p));
              const active = !!activePoi && poiKey(activePoi) === poiKey(p);
              return (
                <button key={poiKey(p)} className={`merchant-list-item ${active ? 'active' : ''}`} onClick={() => setSelectedPoi(p)}>
                  <strong>{p.name}</strong>
                  <span>{p.address || '地址未知'}</span>
                  <div>
                    <em className={`status-pill ${duplicated ? 'warn' : 'done'}`}>{duplicated ? '重复' : '已采集'}</em>
                    <em>{catName(p.category) || '—'}</em>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="merchant-detail-pane">
          {activePoi ? (
            <>
              <section className="merchant-detail-card">
                <span className="merchant-category-pill">{catName(activePoi.category) || '—'}</span>
                <h2>{activePoi.name}</h2>
                <div className="merchant-info-grid">
                  <div><span>地址</span><strong>{activePoi.address || '—'}</strong></div>
                  <div><span>电话</span><strong>{activePoi.phone || '—'}</strong></div>
                  <div><span>营业时间</span><strong>—</strong></div>
                  <div><span>坐标</span><strong>{Number(activePoi.lng).toFixed(5)}, {Number(activePoi.lat).toFixed(5)}</strong></div>
                </div>
                <div className="merchant-map-preview">
                  <span>地图缩略图 · {Number(activePoi.lng).toFixed(3)}, {Number(activePoi.lat).toFixed(3)}</span>
                </div>
              </section>
              <div className="merchant-actions">
                <a className={`desktop-btn primary ${activePoi.phone ? '' : 'disabled'}`} href={activePoi.phone ? `tel:${activePoi.phone}` : undefined}>拨打电话</a>
                <button className="desktop-btn" onClick={() => locatePoi(activePoi)}>在地图中查看</button>
                <button className={`desktop-btn ${duplicateKeys.has(poiKey(activePoi)) ? 'danger' : ''}`} onClick={() => toggleDuplicate(activePoi)}>
                  {duplicateKeys.has(poiKey(activePoi)) ? '取消重复' : '标记重复'}
                </button>
              </div>
            </>
          ) : (
            <div className="desktop-empty-state">
              <strong>选择商户查看详情</strong>
              <span>采集完成后，商户资料会在这里展示。</span>
            </div>
          )}
        </main>
      </div>
    );
  };

  const handleUpload = async (poisToUpload: PoiRecord[] = collectedPois) => {
    if (!poisToUpload.length) return;
    setSyncStatus('syncing');
    try {
      const cats = [...new Set(poisToUpload.map(p => p.category))].join(',');
      const taskId = await createCloudTask({ categories: cats, total_cells: 0, total_pois: poisToUpload.length });
      await insertCloudPois(taskId, poisToUpload.map(p => ({
        name: p.name, category: p.category || '', subcategory: p.subcategory || '',
        address: p.address || '', lng: p.lng, lat: p.lat, phone: p.phone || '',
      })));
      const syncedAt = new Date().toISOString();
      localStorage.setItem('poi_last_cloud_sync', syncedAt);
      setLastLibrarySync(syncedAt);
      // Mark uploaded POIs as synced in local DB
      await markPoisSynced(poisToUpload.filter(p => p.id).map(p => p.id));
      setSyncStatus('done');
      showToast(`已上传 ${poisToUpload.length} 条到云端`, 'success');
      loadPoiLibrary(); // refresh stats
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

  const renderDataManageProductView = () => {
    const sourcePois = libraryPois.length > 0 ? libraryPois : collectedPois;
    const sourceTotal = libraryTotal || sourcePois.length;
    const dbStats = libraryStats;
    const incrementalPois = collectedPois.length > 0 ? collectedPois : sourcePois;
    const unsyncedCount = dbStats?.unsyncedCount ?? sourceTotal;
    const syncedCount = dbStats?.syncedCount ?? 0;
    const lastSyncText = lastLibrarySync
      ? new Date(lastLibrarySync).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-')
      : '—';

    return (
      <div className="data-manage-page">
        {/* Compact stat bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { v: sourceTotal, l: '本地库', c: 'var(--fg)' },
            { v: syncedCount, l: '已同步', c: 'var(--success)' },
            { v: unsyncedCount, l: '待上传', c: 'var(--accent)' },
            { v: dbStats?.duplicateCount ?? 0, l: '重复项', c: 'var(--warn)' },
          ].map(s => (
            <div key={s.l} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.c, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Two-column main layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Left: Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <section className="data-card">
              <h3>☁ 云同步</h3>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <button className="desktop-btn primary" style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => handleUpload(sourcePois)} disabled={sourcePois.length === 0 || syncStatus === 'syncing'}>
                    {syncStatus === 'syncing' ? '↑ 上传中...' : `↑ 上传全部 (${sourceTotal}条)`}
                  </button>
                  <button className="desktop-btn" style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => handleUpload(incrementalPois)} disabled={incrementalPois.length === 0 || syncStatus === 'syncing'}>
                    仅增量 ({incrementalPois.length}条)
                  </button>
                </div>
                <div className="data-meta-line" style={{ fontSize: 11 }}>
                  上次同步：{lastSyncText}{syncStatus === 'done' ? ' ✅' : ''}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>从云端拉取</span>
                  <button className="desktop-btn" style={{ padding: '2px 10px', fontSize: 10 }}
                    onClick={async () => {
                      setLoadingCloud(true);
                      try { setCloudTasks(await getTasks()); } catch { showToast('获取云端任务失败', 'error'); }
                      setLoadingCloud(false);
                    }}>
                    {loadingCloud ? '...' : '🔄 刷新'}
                  </button>
                </div>
                {cloudTasks.length === 0 ? (
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>{loadingCloud ? '加载中...' : '暂无云端任务，点击刷新检查'}</p>
                ) : (
                  cloudTasks.slice(0, 4).map(t => (
                    <div key={t.id} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <span style={{ fontWeight: 500 }}>{(() => { try { return JSON.parse(t.categories).join('、'); } catch { return t.categories; } })()}</span>
                        <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{t.total_pois}条</span>
                      </span>
                      <button className="desktop-btn" style={{ padding: '2px 8px', fontSize: 10 }}
                        onClick={async () => {
                          try {
                            const cloudPois = await getPois(t.id);
                            const mapped = cloudPois.map((cp: any) => ({
                              name: cp.name, category: cp.category || '',
                              subcategory: cp.subcategory || '', address: cp.address || '',
                              lng: cp.lng, lat: cp.lat, phone: cp.phone || '', rating: cp.rating ?? null,
                            }));
                            const result = await mergePoisToDb(mapped);
                            showToast(`合并: +${result.inserted} 跳过${result.skipped}`, 'success');
                            loadPoiLibrary();
                          } catch (e: any) { showToast('失败: ' + (e?.message || ''), 'error'); }
                        }}>
                        ↓ 同步
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="data-card">
              <h3>📥 数据导出</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="desktop-btn primary" style={{ flex: 1, justifyContent: 'center' }}
                  disabled={!collection.taskId && sourcePois.length === 0}
                  onClick={() => collection.taskId ? window.open(getExportUrl(collection.taskId, 'xlsx'), '_blank') : clientExport(sourcePois, 'csv')}>
                  Excel
                </button>
                <button className="desktop-btn" style={{ flex: 1, justifyContent: 'center' }}
                  disabled={sourcePois.length === 0} onClick={() => clientExport(sourcePois, 'csv')}>CSV</button>
                <button className="desktop-btn" style={{ flex: 1, justifyContent: 'center' }}
                  disabled={sourcePois.length === 0} onClick={() => clientExport(sourcePois, 'geojson')}>GeoJSON</button>
              </div>
            </section>
          </div>

          {/* Right: Data */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <section className="data-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h3>📊 按区域存储</h3>
                <button className="desktop-btn" onClick={loadPoiLibrary} disabled={loadingLibrary} style={{ padding: '2px 10px', fontSize: 10 }}>
                  {loadingLibrary ? '...' : '刷新'}
                </button>
              </div>
              {districtDrill ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{districtDrill} · {drillPois.length} 条</strong>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="desktop-btn" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => clientExport(drillPois, 'csv')}>CSV</button>
                      <button className="desktop-btn" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => clientExport(drillPois, 'geojson')}>GeoJSON</button>
                      <button className="desktop-btn" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => { setDistrictDrill(null); setDrillPois([]); }}>← 返回</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead><tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
                        {['名称', '类别', '地址', '坐标'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '3px 6px', fontSize: 10, fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {drillPois.slice(0, 100).map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => { setSelectedPoi(p); setView('detail'); }}>
                            <td style={{ padding: '3px 6px', fontWeight: 500, fontSize: 12 }}>{p.name}</td>
                            <td style={{ padding: '3px 6px', color: 'var(--muted)', fontSize: 11 }}>{catName(p.category)}</td>
                            <td style={{ padding: '3px 6px', color: 'var(--muted)', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address || '—'}</td>
                            <td style={{ padding: '3px 6px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{p.lng?.toFixed(4)},{p.lat?.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  {dbStats && dbStats.byDistrict.length > 0 ? dbStats.byDistrict.map((d) => (
                    <div key={d.district} className="area-store-card" style={{ cursor: 'pointer', padding: '8px 10px' }}
                      onClick={async () => {
                        setDistrictDrill(d.district);
                        setLoadingDrill(true);
                        try { const r = await queryPoiLibrary({ page: 1, pageSize: 200, district: d.district }); setDrillPois(r.pois); } catch {}
                        setLoadingDrill(false);
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 13 }}>{d.district}</strong>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{d.count} 条</span>
                      </div>
                      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round((d.count / Math.max(dbStats.total, 1)) * 100)}%`, background: 'var(--accent)', borderRadius: 2 }} />
                      </div>
                    </div>
                  )) : (
                    <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 16 }}>暂无数据，完成采集后自动归类</p>
                  )}
                </>
              )}
            </section>

            <section className="data-card">
              <h3>🔄 重复检测</h3>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                本地库 <b>{dbStats?.total || sourceTotal}</b> 条 · 同名同地址重复 <b style={{ color: 'var(--warn)' }}>{dbStats?.duplicateCount || 0}</b> 条
              </p>
              {dbStats && dbStats.duplicateCount > 0 ? (
                <div style={{ padding: '6px 10px', borderRadius: 6, background: '#fff7ed', border: '1px solid #fed7aa', fontSize: 12, color: 'var(--warn)' }}>
                  可在商户详情页逐条处理重复项。
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>✓ 暂未检测到重复</p>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  };

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
          <div className={`desktop-view ${view === 'progress' ? 'active' : ''}`}>{renderProgressProductView()}</div>
          <div className={`desktop-view ${view === 'detail' ? 'active' : ''}`}>{renderMerchantDetailView()}</div>
          <div className={`desktop-view ${view === 'manage' ? 'active' : ''}`}>{renderDataManageProductView()}</div>
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
