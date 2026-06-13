import { useState, useCallback, useRef, useEffect } from 'react';
import MapView from './MapView';
import DrawToolbar from './DrawToolbar';
import SettingsDialog from './SettingsDialog';
import CloudPanel from './CloudPanel';
import UpdatePrompt from './UpdatePrompt';
import { useCollection } from '../hooks/useCollection';
import { useSSE } from '../hooks/useSSE';
import { getExportUrl } from '../services/api';
import { checkForUpdate, type UpdateInfo } from '../services/updater';
import { CATEGORY_LIST } from '../types/poi';
import type { MapAPI, DrawnShape, GridCell } from './MapView';
import '../App.css';

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

// Mock data for UI display
const MOCK_POIS = [
  { name: '川西坝子火锅', category: '餐饮', address: '高新区天府三街288号', status: 'pending' },
  { name: '蜀九香火锅', category: '餐饮', address: '高新区天府大道1199号银泰城3F', status: 'pending' },
  { name: '红旗连锁', category: '零售', address: '高新区科华路56号', status: 'done' },
  { name: '大蓉和酒楼', category: '餐饮', address: '高新区天府二街78号', status: 'done' },
  { name: '巴蜀风川菜', category: '餐饮', address: '锦江区红星路三段12号', status: 'pending' },
  { name: '永辉超市', category: '零售', address: '锦江区东大街99号', status: 'done' },
  { name: '龙抄手小吃', category: '餐饮', address: '青羊区宽窄巷子12号', status: 'pending' },
];
const MOCK_REGIONS = [
  { name: '区域 A — 高新区南', done: 42, total: 56, cats: [{ n: '餐饮', c: 28 }, { n: '零售', c: 9 }, { n: '生活服务', c: 5 }] },
  { name: '区域 B — 锦江区', done: 30, total: 48, cats: [{ n: '餐饮', c: 18 }, { n: '零售', c: 8 }, { n: '酒店住宿', c: 4 }] },
  { name: '区域 C — 青羊区', done: 15, total: 38, cats: [{ n: '餐饮', c: 10 }, { n: '零售', c: 3 }, { n: '生活服务', c: 2 }] },
];
const MOCK_DUPS = ['红旗连锁 — 已存在于区域 A', '永辉超市 — 已存在于区域 B', '麦当劳 — 已存在于区域 A'];

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
  const [searchFilter, setSearchFilter] = useState({ type: 'all', region: 'all', status: 'all', query: '' });
  const [selectedPoi, setSelectedPoi] = useState<any | null>(null);

  const drawAPIRef = useRef<MapAPI | null>(null);
  const collection = useCollection();

  useEffect(() => {
    checkForUpdate().then((info) => { if (info.available) setUpdateInfo(info); });
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  useEffect(() => {
    if (collection.status === 'running') setApiStatus('busy');
    else if (collection.error) setApiStatus('error');
    else setApiStatus('idle');
  }, [collection.status, collection.error]);
  useSSE(collection.taskId, collection.onProgress, collection.onComplete, collection.onError);

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
    collection.start({ mode: 'region', categories: selectedCategories, bounds, gridSize: gridSizeMeters / 111320 });
    setView('progress');
    showToast('开始采集', 'info');
  }, [selectedCategories, gridSizeMeters, collection, showToast]);

  const disabled = selectedCategories.length === 0 || collection.status === 'running';

  // Filter mock data
  const filteredPois = MOCK_POIS.filter(p => {
    if (searchFilter.type !== 'all' && p.category !== searchFilter.type) return false;
    if (searchFilter.status !== 'all' && p.status !== searchFilter.status) return false;
    if (searchFilter.query && !p.name.includes(searchFilter.query) && !p.address.includes(searchFilter.query)) return false;
    return true;
  });

  const renderMapView = () => (
    <div className="desktop-map-view">
      <MapView onMapReady={handleMapReady} onShapeChange={handleShapeChange} onGridChange={setGridCells}>
        {/* Left toolbar: draw tools */}
        {drawnShape === null && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <DrawToolbar
              activeMode={drawMode}
              onModeChange={setDrawMode}
              onClear={() => { drawAPIRef.current?.clearDrawings(); setDrawMode(null); setDrawnShape(null); setGridCells([]); }}
              setDrawMode={(m) => drawAPIRef.current?.setDrawMode(m)}
            />
          </div>
        )}
        {/* Right panel: config */}
        <div className="desktop-map-panel">
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 6 }}>POI 分类</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {CATEGORY_LIST.slice(0, 8).map(c => (
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
        <SettingsDialog />
        <CloudPanel />
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
            {['all', ...CATEGORY_LIST.slice(0, 6).map(c => c.name)].map(t => (
              <button key={t} className="desktop-btn" style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 99,
                background: searchFilter.type === t ? 'var(--accent)' : undefined,
                color: searchFilter.type === t ? '#fff' : undefined,
                borderColor: searchFilter.type === t ? 'var(--accent)' : undefined,
              }} onClick={() => setSearchFilter(prev => ({ ...prev, type: t === 'all' ? 'all' : t }))}>{t === 'all' ? '全部' : t}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>采集区域</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {['all', '区域 A', '区域 B', '区域 C'].map(r => (
              <button key={r} className="desktop-btn" style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 99,
                background: searchFilter.region === r ? 'var(--accent)' : undefined,
                color: searchFilter.region === r ? '#fff' : undefined,
                borderColor: searchFilter.region === r ? 'var(--accent)' : undefined,
              }} onClick={() => setSearchFilter(prev => ({ ...prev, region: r }))}>{r === 'all' ? '全部' : r}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>状态</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ v: 'all', l: '全部' }, { v: 'pending', l: '待采集' }, { v: 'done', l: '已采集' }, { v: 'dup', l: '重复' }].map(s => (
              <button key={s.v} className="desktop-btn" style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 99,
                background: searchFilter.status === s.v ? 'var(--accent)' : undefined,
                color: searchFilter.status === s.v ? '#fff' : undefined,
                borderColor: searchFilter.status === s.v ? 'var(--accent)' : undefined,
              }} onClick={() => setSearchFilter(prev => ({ ...prev, status: s.v }))}>{s.l}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: '4px 14px', fontSize: 11, color: 'var(--muted)' }}>{filteredPois.length} 条结果</div>
        <div className="scroll">
          {filteredPois.map((p, i) => (
            <div key={i} className="desktop-poi-row" onClick={() => { setSelectedPoi(p); setView('detail'); }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.category} · {p.address}</div>
              </div>
              <span className={`badge ${p.status === 'done' ? 'badge-success' : 'badge-accent'}`}>
                {p.status === 'done' ? '已采集' : '待采集'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
        ← 选择左侧商户查看详情
      </div>
    </div>
  );

  const renderProgressView = () => (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', width: '100%', overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <div className="stat-card"><div className="v">142</div><div className="l">总数 · 区域 A+B+C</div></div>
        <div className="stat-card"><div className="v" style={{ color: 'var(--accent)' }}>87</div><div className="l">已采集 · 61.3% 完成</div></div>
        <div className="stat-card"><div className="v">55</div><div className="l">待采集 · 剩余</div></div>
        <div className="stat-card"><div className="v" style={{ color: 'var(--warn)' }}>3</div><div className="l">重复 · 需处理</div></div>
      </div>
      <div style={{ marginBottom: 20 }}>
        {MOCK_REGIONS.map(r => {
          const pct = Math.round((r.done / r.total) * 100);
          return (
            <div key={r.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                <span style={{ fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{r.done}/{r.total}</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
          {['商户名称', '类型', '区域', '地址', '状态', '采集时间'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {MOCK_POIS.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}>{p.name}</td>
              <td style={{ padding: '8px', color: 'var(--muted)' }}>{p.category}</td>
              <td style={{ padding: '8px', color: 'var(--muted)' }}>{p.address.includes('高新区') ? '区域 A' : p.address.includes('锦江') ? '区域 B' : '区域 C'}</td>
              <td style={{ padding: '8px', color: 'var(--muted)', fontSize: 11 }}>{p.address}</td>
              <td style={{ padding: '8px' }}><span className={`badge ${p.status === 'done' ? 'badge-success' : 'badge-accent'}`}>{p.status === 'done' ? '已采集' : '待采集'}</span></td>
              <td style={{ padding: '8px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{p.status === 'done' ? `06-13 09:${String(12 - i * 4).padStart(2, '0')}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderDetailView = () => (
    <div style={{ display: 'flex', height: '100%' }}>
      <div className="desktop-data-list">
        <div style={{ padding: '14px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>商户列表</div>
        <div className="scroll">
          {MOCK_POIS.map((p, i) => (
            <div key={i} className="desktop-poi-row" style={{ background: selectedPoi?.name === p.name ? 'var(--accent-dim)' : undefined }}
              onClick={() => setSelectedPoi(p)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.address}</div>
              </div>
              <span className={`badge ${p.status === 'done' ? 'badge-success' : 'badge-accent'}`}>{p.status === 'done' ? '已采集' : '待采集'}</span>
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
            <span className={`badge ${selectedPoi.status === 'done' ? 'badge-success' : 'badge-accent'}`} style={{ marginBottom: 8, display: 'inline-block' }}>
              {selectedPoi.category}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12 }}>{selectedPoi.name}</h2>
            {[
              ['地址', selectedPoi.address],
              ['POI ID', 'B0FFGXXXXX'],
              ['电话', '028-8888 8888'],
              ['坐标', '104.05827, 30.54286'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: 11 }}>{k}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: k === '坐标' || k === 'POI ID' ? 12 : 13 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button className="desktop-btn primary">📞 拨打电话</button>
              <button className="desktop-btn">📍 在地图中查看</button>
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

  const renderManageView = () => (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', width: '100%', overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Cloud upload */}
        <div className="card">
          <div style={{ fontSize: 28, marginBottom: 4 }}>☁</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>云端上传</h3>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>将已采集数据上传至云端服务器，支持增量同步。</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="desktop-btn primary" style={{ flex: 1, justifyContent: 'center' }}>上传全部 (87条)</button>
            <button className="desktop-btn" style={{ flex: 1, justifyContent: 'center' }}>仅上传增量 (12条)</button>
          </div>
          <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>上次同步：2026-06-13 09:42:15</p>
        </div>
        {/* Export */}
        <div className="card">
          <div style={{ fontSize: 28, marginBottom: 4 }}>📥</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>数据导出</h3>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>导出为 Excel (.xlsx) 或 CSV 格式，支持按区域筛选导出。</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="desktop-btn primary" style={{ flex: 1, justifyContent: 'center' }}>导出 Excel</button>
            <button className="desktop-btn" style={{ flex: 1, justifyContent: 'center' }}>导出 CSV</button>
          </div>
          <button className="desktop-btn" style={{ width: '100%', marginTop: 6, justifyContent: 'center' }}>按区域导出</button>
        </div>
      </div>
      {/* Region storage */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>📊 按区域存储</h3>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>已采集数据按地图区域分组存储，避免跨区域重复采集。</p>
        {MOCK_REGIONS.map(r => (
          <div key={r.name} style={{ marginBottom: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{r.done} 条 · {Math.round((r.done / r.total) * 100)}%</span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
              {r.cats.map(c => <span key={c.n}>{c.n}: {c.c} 条</span>)}
            </div>
          </div>
        ))}
      </div>
      {/* Duplicate detection */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🔄 重复检测</h3>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>采集前自动比对已存储数据，避免同一商户被重复采集。</p>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>最近检测到 {MOCK_DUPS.length} 条重复记录：</p>
        {MOCK_DUPS.map((d, i) => (
          <div key={i} style={{ fontSize: 12, padding: '6px 10px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 4, marginBottom: 4 }}>
            ▲ {d}
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettingsView = () => (
    <div style={{ padding: 20, maxWidth: 680, margin: '0 auto', width: '100%', overflow: 'auto' }}>
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>🔑 高德开放平台 API</h4>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>API Key (Web服务)</label>
          <input className="input-field" type="password" defaultValue={localStorage.getItem('amap_rest_key') || ''} onChange={e => localStorage.setItem('amap_rest_key', e.target.value)} placeholder="输入高德 Web服务 Key" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>API Key (JS API)</label>
          <input className="input-field" type="text" defaultValue={localStorage.getItem('amap_js_key') || ''} onChange={e => localStorage.setItem('amap_js_key', e.target.value)} placeholder="输入高德 JS API Key" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <span style={{ fontSize: 13 }}>使用代理转发</span>
          <div className={`desktop-toggle on`} onClick={(e: any) => e.currentTarget.classList.toggle('on')} />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>⚙ 采集参数</h4>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>POI 类型范围</label>
          <select className="input-field" defaultValue="all"><option>全部类型</option><option>仅餐饮</option></select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>搜索半径 · 1,000m</label>
          <input type="range" defaultValue={1000} min={100} max={5000} step={100} style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>单次请求上限</label><input className="input-field" defaultValue={25} type="number" /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>请求间隔 (ms)</label><input className="input-field" defaultValue={200} type="number" /></div>
        </div>
        <div className="desktop-set-row"><span>自动跳过重复项</span><div className="desktop-toggle on" onClick={(e: any) => e.currentTarget.classList.toggle('on')} /></div>
        <div className="desktop-set-row"><span>采集完成后自动上传</span><div className="desktop-toggle" onClick={(e: any) => e.currentTarget.classList.toggle('on')} /></div>
      </div>
      <div className="card">
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>📋 版本管理</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>v2.1.0</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>✓ 已是最新</span>
        </div>
        <button className="desktop-btn" style={{ width: '100%', justifyContent: 'center', padding: '6px 0' }}
          onClick={() => checkForUpdate().then(i => i.available && setUpdateInfo(i))}>🔄 检查更新</button>
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
            🌙 暗色模式
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="desktop-main">
        <div className="desktop-topbar">
          <span className="desktop-topbar-title">{NAV_WORKFLOW.concat(NAV_MANAGE).find(n => n.id === view)?.label}</span>
          <div className="desktop-topbar-spacer" />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>v2.1.0</span>
          <button className="desktop-btn primary" onClick={handleStart} style={{ fontWeight: 600 }}>
            ▶ 开始采集
          </button>
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
          <span>采集状态: {apiStatus === 'busy' ? '采集中' : '空闲'}</span>
          <span>区域 A</span>
          <span>42/56</span>
          <span>API: {apiStatus === 'error' ? '异常' : '正常'}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>116.397° E, 39.908° N</span>
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
        <UpdatePrompt version={updateInfo.version} url={updateInfo.url} body={updateInfo.body} onDismiss={() => setUpdateInfo(null)} />
      )}
    </div>
  );
}

export default DesktopApp;
