import React, { useState } from 'react';
import type { DrawnShape, DrawMode } from '../../hooks/useAmap';
import { CATEGORY_LIST } from '../../types/poi';

interface Props {
  amap: any;
  categories: string[];
  onCategoriesChange: (codes: string[]) => void;
  drawnShape: DrawnShape | null;
  onShapeChange: (shape: DrawnShape | null) => void;
  locating: boolean;
  onLocate: () => void;
  onCollectStart: () => void;
  onCollectProgress: (done: number, total: number, pois: number) => void;
  onCollectComplete: (pois: any[]) => void;
}

const DRAW_MODES: { id: DrawMode; label: string; sym: string }[] = [
  { id: 'rectangle', label: '矩形', sym: '▭' },
  { id: 'polygon', label: '多边形', sym: '⬠' },
  { id: 'circle', label: '圆形', sym: '◯' },
];

const CATEGORY_NAMES: Record<string, string> = {};
CATEGORY_LIST.forEach(c => { CATEGORY_NAMES[c.code] = c.name; });

function MobileMapTab({ amap, categories, onCategoriesChange, drawnShape, onShapeChange, locating, onLocate, onCollectStart, onCollectProgress, onCollectComplete }: Props) {
  const [sheet, setSheet] = useState<'config' | 'pull' | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [gridSizeMeters, setGridSizeMeters] = useState(500);
  const [pulling, setPulling] = useState(false);
  const [pullLog, setPullLog] = useState<string[]>([]);

  const toggleCategory = (code: string) => {
    onCategoriesChange(
      categories.includes(code) ? categories.filter(c => c !== code) : [...categories, code]
    );
  };

  const selectDrawMode = (mode: DrawMode) => {
    if (drawMode === mode) { setDrawMode(null); amap.setDrawMode(null); }
    else { setDrawMode(mode); amap.setDrawMode(mode); }
  };

  const handleSplit = () => {
    if (!drawnShape) return;
    amap.splitGrid(gridSizeMeters);
  };

  const handleStartPull = async () => {
    if (!drawnShape || categories.length === 0) return;
    setPulling(true);
    setSheet(null);
    onCollectStart();

    const cells = amap.gridCells;
    if (cells.length === 0) {
      handleSplit();
      await new Promise(r => setTimeout(r, 300));
    }

    try {
      const pois = await amap.collectPOIsClientSide(
        amap.gridCells, categories, CATEGORY_NAMES, gridSizeMeters,
        (d: number, t: number, p: number) => {
          onCollectProgress(d, t, p);
          setPullLog(prev => [...prev.slice(-19), `请求 ${d}/${t} · ${p} 条POI`]);
        }
      );
      onCollectComplete(pois);
    } catch (e: any) {
      setPullLog(prev => [...prev.slice(-19), `错误: ${e?.message}`]);
    }
    setPulling(false);
  };

  const estimated = categories.length * (amap.gridCells?.length || 0);

  return (
    <div className="mobile-map-wrap">
      <div id="mobile-map" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* FAB buttons */}
      <div className="mobile-map-fab top">
        <button className="mobile-fab accent" onClick={() => setSheet('config')} title="配置区域">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2"/></svg>
        </button>
      </div>
      <div className="mobile-map-fab bottom">
        <button className="mobile-fab" onClick={onLocate} disabled={locating} title="定位">
          {locating ? '⟳' : '⌖'}
        </button>
      </div>

      {/* Legend */}
      <div className="mobile-legend">
        <span><span className="dot pending" /> 待拉取</span>
        <span><span className="dot done" /> 已拉取</span>
      </div>

      {/* Draw tools — floating under the locate button */}
      <div style={{ position: 'absolute', bottom: 60, right: 10, zIndex: 5, display: 'flex', gap: 4 }}>
        {DRAW_MODES.map(m => (
          <button key={m.id}
            onClick={() => selectDrawMode(m.id)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid ' + (drawMode === m.id ? 'var(--accent)' : 'var(--border)'),
              background: drawMode === m.id ? 'var(--accent)' : 'var(--surface)',
              color: drawMode === m.id ? '#fff' : 'var(--fg)',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
            title={m.label}
          >{m.sym}</button>
        ))}
        {drawMode && (
          <button
            onClick={() => { amap.clearDrawings(); setDrawMode(null); onShapeChange(null); }}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--warn)', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >✕</button>
        )}
      </div>

      {/* Config Sheet */}
      <div className={`mobile-sheet-overlay ${sheet === 'config' ? 'show' : ''}`} onClick={() => setSheet(null)} />
      <div className={`mobile-sheet ${sheet === 'config' ? 'show' : ''}`}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-title">区域 & 类型配置</div>
        <div className="mobile-sheet-body">
          <div className="mobile-cfg-label">POI 分类</div>
          <div className="mobile-cfg">
            {CATEGORY_LIST.map(c => (
              <button key={c.code}
                className={`mobile-chip ${categories.includes(c.code) ? 'on' : ''}`}
                onClick={() => toggleCategory(c.code)}
              >{c.name}</button>
            ))}
          </div>

          <div className="mobile-cfg-label">网格精度 · {gridSizeMeters}m</div>
          <input type="range" min={100} max={2000} step={50} value={gridSizeMeters}
            onChange={e => setGridSizeMeters(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {[500, 1000, 1500].map(v => (
              <button key={v}
                onClick={() => setGridSizeMeters(v)}
                className={`mobile-chip ${gridSizeMeters === v ? 'on' : ''}`}
                style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
              >{v}m</button>
            ))}
          </div>

          <div className="mobile-cfg-row">
            <span>预估请求次数</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontSize: 12 }}>~{estimated || '—'} 次</span>
          </div>
          <div className="mobile-cfg-row">
            <span>已选区域</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontSize: 12 }}>
              {drawnShape ? (drawnShape.type === 'circle' ? `圆形 r${(drawnShape.geometry.radius || 0) | 0}m` : `${drawnShape.type}`) : '—'}
            </span>
          </div>
          <div className="mobile-cfg-row">
            <span>网格数</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontSize: 12 }}>{amap.gridCells?.length || '—'} 格</span>
          </div>

          <button onClick={handleSplit} className="mobile-btn primary" style={{ marginTop: 8 }}>
            生成网格
          </button>
          <button
            onClick={handleStartPull}
            disabled={!drawnShape || categories.length === 0 || pulling}
            className="mobile-btn primary"
            style={{ marginTop: 6, background: pulling ? 'var(--muted)' : undefined }}
          >
            {pulling ? '采集中...' : `▶ 开始拉取 (${categories.length}类 · ${amap.gridCells?.length || 0}格)`}
          </button>
        </div>
      </div>

      {/* Pull progress sheet */}
      <div className={`mobile-sheet-overlay ${sheet === 'pull' ? 'show' : ''}`} onClick={() => setSheet(null)} />
      <div className={`mobile-sheet ${sheet === 'pull' ? 'show' : ''}`}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-title">拉取进度</div>
        <div className="mobile-sheet-body">
          {pullLog.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>暂无拉取记录</p>}
          {pullLog.map((line, i) => (
            <div key={i} className="mobile-log-item" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MobileMapTab;
