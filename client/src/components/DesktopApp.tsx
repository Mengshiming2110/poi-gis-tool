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
import { CATEGORY_LIST, type TaskMode } from '../types/poi';
import type { MapAPI, DrawnShape, GridCell } from './MapView';
import '../App.css';

type View = 'map' | 'progress' | 'data' | 'export' | 'settings';

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: 'map', label: '区域配置' },
  { id: 'progress', label: '拉取进度' },
  { id: 'data', label: '数据浏览' },
  { id: 'export', label: '导出上传' },
  { id: 'settings', label: '系统设置' },
];

function DesktopApp() {
  const [view, setView] = useState<View>('map');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mode, setMode] = useState<TaskMode>('region');
  const [gridSizeMeters, setGridSizeMeters] = useState(500);
  const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | null>('polygon');
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [apiStatus, setApiStatus] = useState<'idle' | 'busy' | 'error'>('idle');

  const drawAPIRef = useRef<MapAPI | null>(null);
  const collection = useCollection();

  useEffect(() => {
    checkForUpdate().then((info) => { if (info.available) setUpdateInfo(info); });
  }, []);

  useEffect(() => {
    if (collection.status === 'running') setApiStatus('busy');
    else if (collection.status === 'done') setApiStatus('idle');
    else if (collection.error) setApiStatus('error');
    else setApiStatus('idle');
  }, [collection.status, collection.error]);

  useSSE(collection.taskId, collection.onProgress, collection.onComplete, collection.onError);

  const showToast = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    if (collection.error) showToast(collection.error, 'error');
  }, [collection.error, showToast]);

  const disabled = selectedCategories.length === 0 || collection.status === 'running' || (mode === 'region' && gridCells.length === 0);

  const handleMapReady = useCallback((api: MapAPI) => { drawAPIRef.current = api; }, []);

  const handleShapeChange = useCallback((shape: DrawnShape | null) => {
    setDrawnShape(shape); setGridCells([]);
    if (shape) showToast('区域已绘制', 'success');
  }, [showToast]);

  const handleGridChange = useCallback((cells: GridCell[]) => { setGridCells(cells); }, []);

  const handleSplitGrid = useCallback(() => {
    const api = drawAPIRef.current;
    if (!api?.getDrawnShape()) { showToast('请先绘制区域', 'error'); return; }
    const count = api.splitGrid(gridSizeMeters);
    count > 0 ? showToast(`${count} 个网格`, 'success') : showToast('网格切分失败', 'error');
  }, [gridSizeMeters, showToast]);

  const handleStart = useCallback(() => {
    const bounds = drawAPIRef.current?.getBounds() || { southwest: { lng: 116.3, lat: 39.8 }, northeast: { lng: 116.5, lat: 40.0 } };
    collection.start({ mode, categories: selectedCategories, bounds, gridSize: mode === 'grid' ? gridSizeMeters / 111320 : undefined });
    setView('progress');
    showToast('开始采集', 'info');
  }, [mode, selectedCategories, gridSizeMeters, collection, showToast]);

  const handleExport = useCallback((format: 'xlsx' | 'geojson') => {
    if (!collection.taskId) return;
    window.open(getExportUrl(collection.taskId, format), '_blank');
  }, [collection.taskId]);

  const renderMapView = () => (
    <div className="desktop-map-view">
      <MapView onMapReady={handleMapReady} onShapeChange={handleShapeChange} onGridChange={handleGridChange}>
        {/* Right panel */}
        <div className="desktop-map-panel">
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 8 }}>POI 分类</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {CATEGORY_LIST.map(c => (
                <div
                  key={c.code}
                  onClick={() => setSelectedCategories(prev => prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code])}
                  style={{
                    padding: '7px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
                    border: '1px solid ' + (selectedCategories.includes(c.code) ? c.color : 'var(--border)'),
                    background: selectedCategories.includes(c.code) ? c.color + '15' : 'var(--surface)',
                    color: selectedCategories.includes(c.code) ? c.color : 'var(--muted)',
                    fontWeight: selectedCategories.includes(c.code) ? 600 : 400,
                    transition: 'all .12s',
                  }}
                >{c.name}</div>
              ))}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>网格精度</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{gridSizeMeters}m</span>
            </div>
            <input type="range" min={100} max={2000} step={50} value={gridSizeMeters} onChange={e => setGridSizeMeters(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: 6 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[500, 1000, 1500].map(v => (
                <button key={v}
                  onClick={() => setGridSizeMeters(v)}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 4, fontSize: 11,
                    border: '1px solid ' + (v === gridSizeMeters ? 'var(--accent)' : 'var(--border)'),
                    background: v === gridSizeMeters ? 'var(--accent-dim)' : 'var(--surface)',
                    color: v === gridSizeMeters ? 'var(--accent)' : 'var(--muted)',
                  }}
                >{v}m</button>
              ))}
            </div>
            <button onClick={handleSplitGrid} className="desktop-btn" style={{ width: '100%', marginTop: 8, justifyContent: 'center', padding: '6px 0' }}>
              切分 {drawnShape ? '✓' : '—'}
            </button>
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>选中</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedCategories.length} 类 · {gridCells.length || '—'} 格</span>
            </div>
            <button onClick={handleStart} disabled={disabled}
              className="desktop-btn primary" style={{ width: '100%', justifyContent: 'center', padding: '8px 0', fontSize: 13, fontWeight: 600 }}>
              开始拉取
            </button>
          </div>
        </div>

        {mode === 'region' && (
          <DrawToolbar
            activeMode={drawMode}
            onModeChange={setDrawMode}
            onClear={() => { drawAPIRef.current?.clearDrawings(); setDrawMode(null); setDrawnShape(null); setGridCells([]); }}
            setDrawMode={(m) => drawAPIRef.current?.setDrawMode(m)}
          />
        )}
        <SettingsDialog />
        <CloudPanel />
      </MapView>
    </div>
  );

  const renderProgressView = () => (
    <div className="desktop-progress-view">
      <div className="desktop-progress">
        <div className="stat-card"><div className="v">{collection.progress.totalCells || '—'}</div><div className="l">网格总数</div></div>
        <div className="stat-card"><div className="v" style={{ color: 'var(--accent)' }}>{collection.progress.doneCells || 0}</div><div className="l">已完成</div></div>
        <div className="stat-card"><div className="v">{collection.totalPois}</div><div className="l">POI 总数</div></div>
        <div className="stat-card"><div className="v" style={{ color: 'var(--warn)' }}>—</div><div className="l">重复</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {collection.status === 'running' && (
          <button className="desktop-btn" onClick={collection.pause}>暂停</button>
        )}
        {collection.status === 'paused' && (
          <button className="desktop-btn primary" onClick={collection.resume}>继续</button>
        )}
        {collection.taskId && (
          <>
            <button className="desktop-btn" onClick={() => handleExport('xlsx')}>导出 Excel</button>
            <button className="desktop-btn" onClick={() => handleExport('geojson')}>导出 GeoJSON</button>
          </>
        )}
      </div>
    </div>
  );

  const renderExportView = () => (
    <div className="desktop-export-view">
      <div className="desktop-export-grid">
        <div className="desktop-export-card">
          <span style={{ fontSize: 28 }}>☁</span>
          <h3>云端上传</h3>
          <p>上传采集数据到 Supabase，手机端可同步查看</p>
        </div>
        <div className="desktop-export-card">
          <span style={{ fontSize: 28 }}>📥</span>
          <h3>数据导出</h3>
          <p>导出 Excel 或 GeoJSON 格式</p>
          {collection.taskId ? (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
              <button className="desktop-btn primary" onClick={() => handleExport('xlsx')}>Excel</button>
              <button className="desktop-btn" onClick={() => handleExport('geojson')}>GeoJSON</button>
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>请先完成一次采集</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="desktop-app">
      {/* Sidebar */}
      <nav className="desktop-sidebar">
        <div className="desktop-sidebar-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
          POI GIS
        </div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`desktop-nav-item ${view === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}
          >{item.label}</button>
        ))}
        <div className="desktop-nav-section">工具</div>
        <button className="desktop-nav-item" onClick={() => setView('export')}>
          {collection.taskId ? `任务 ${collection.taskId.slice(0, 8)}` : '无活跃任务'}
        </button>
        <div className="desktop-sidebar-footer">
          <button className="desktop-nav-item" onClick={() => setView('settings')}>
            设置 · API Key
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="desktop-main">
        <div className="desktop-topbar">
          <span className="desktop-topbar-title">{NAV_ITEMS.find(n => n.id === view)?.label}</span>
          <div className="desktop-topbar-spacer" />
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>v1.0.0</span>
          <button className="desktop-btn" onClick={() => setView('settings')}>⚙</button>
        </div>

        <div className="desktop-viewport">
          <div className={`desktop-view ${view === 'map' ? 'active' : ''}`}>{renderMapView()}</div>
          <div className={`desktop-view ${view === 'progress' ? 'active' : ''}`}>{renderProgressView()}</div>
          <div className={`desktop-view ${view === 'data' ? 'active' : ''}`} style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
            数据浏览 — 采集完成后可在此查看
          </div>
          <div className={`desktop-view ${view === 'export' ? 'active' : ''}`}>{renderExportView()}</div>
          <div className={`desktop-view ${view === 'settings' ? 'active' : ''}`}>
            <div className="desktop-settings">
              <div className="desktop-set-card">
                <h4>🔑 高德开放平台 API</h4>
                <div className="desktop-set-field"><label>API Key (Web 服务)</label><input className="input-field" type="password" defaultValue={localStorage.getItem('amap_rest_key') || '125c253ac5c0c03f9165bc3c721d130f'} onChange={e => localStorage.setItem('amap_rest_key', e.target.value)} /></div>
                <div className="desktop-set-field"><label>API Key (JS API)</label><input className="input-field" type="text" defaultValue={localStorage.getItem('amap_js_key') || '35f0e1144644fbfba405c109db466cdc'} onChange={e => localStorage.setItem('amap_js_key', e.target.value)} /></div>
                <div className="desktop-set-field"><label>安全密钥</label><input className="input-field" type="text" defaultValue={localStorage.getItem('amap_security_code') || '8d13a7d3f6ecff69f02dc1dea5855b0a'} onChange={e => localStorage.setItem('amap_security_code', e.target.value)} /></div>
              </div>
              <div className="desktop-set-card">
                <h4>⚙ 拉取参数</h4>
                <div className="desktop-set-row"><span>搜索半径</span><span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>1,000m</span></div>
                <div className="desktop-set-row"><span>请求间隔</span><span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>200ms</span></div>
              </div>
              <div className="desktop-set-card">
                <h4>📋 版本管理</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>v1.0.0</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>✓ 已是最新</span>
                </div>
                <button className="desktop-btn" style={{ width: '100%', justifyContent: 'center', padding: '8px 0' }} onClick={() => checkForUpdate().then(i => i.available && setUpdateInfo(i))}>🔄 检查更新</button>
              </div>
            </div>
          </div>
        </div>

        <div className="desktop-statusbar">
          <span className={`desktop-status-dot ${apiStatus === 'idle' ? 'idle' : ''}`} style={{ background: apiStatus === 'busy' ? 'var(--accent)' : apiStatus === 'error' ? 'var(--warn)' : 'var(--muted)' }} />
          <span>API: {apiStatus === 'busy' ? '采集中' : apiStatus === 'error' ? '异常' : '空闲'}</span>
          <span style={{ flex: 1 }} />
          <span>{collection.taskId ? `任务 ${collection.taskId.slice(0, 8)}` : '就绪'}</span>
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
