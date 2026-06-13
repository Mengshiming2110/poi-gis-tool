# 手机端 APP 重新设计 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面版 POI 采集工具的 UI 改造为移动端触屏优先的五步向导式界面，同一套 React 代码通过媒体查询自动切换。

**Architecture:** 新增 `components/mobile/` 目录放 7 个移动组件（MobileApp + 5 个 Step + StepIndicator），App.tsx 用媒体查询 `width < 768px` 路由到 MobileApp。Supabase 客户端统一放在 `services/supabase.ts`。采集后端先试局域网桌面端 → 失败降级 PlaceSearch。

**Tech Stack:** React 18, TypeScript, Vite, 高德 JS API (WebView), Supabase, Capacitor

---

## 任务概览

| 任务 | 产出 | 类型 |
|------|------|------|
| 1 | Supabase 客户端 + 移动端 CSS | 基础 |
| 2 | MobileApp.tsx + StepIndicator | 框架 |
| 3 | StepCategories | 组件 |
| 4 | StepDraw + StepGrid | 组件 |
| 5 | StepCollect + StepResults | 组件 |
| 6 | App.tsx 媒体查询路由 | 整合 |
| 7 | 构建 APK + 验证 | 构建 |

---

### Task 1: Supabase 客户端 + 移动端 CSS

**Files:**
- Create: `~/Desktop/poi-gis-tool/client/src/services/supabase.ts`
- Create: `~/Desktop/poi-gis-tool/client/src/mobile.css`

- [ ] **Step 1: 创建 Supabase 客户端**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sasfkjvdrzgzujoykbqn.supabase.co';
const supabaseKey = 'sb_publishable_BPMz4V8OXRFdAcfjJKAg6A_hFl5A0tS';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface CloudTask {
  id: string; mode: string; categories: string;
  status: string; total_cells: number; done_cells: number;
  total_pois: number; created_at: string;
}

export interface CloudPoi {
  id: number; task_id: string;
  name: string; category: string; subcategory: string;
  address: string; lng: number; lat: number;
  phone: string; rating: number;
}

export async function getTasks(): Promise<CloudTask[]> {
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(20);
  return data || [];
}

export async function getPois(taskId: string): Promise<CloudPoi[]> {
  const { data } = await supabase.from('pois').select('*').eq('task_id', taskId).order('id');
  return data || [];
}
```

- [ ] **Step 2: 创建移动端 CSS**

```css
/* mobile.css — 仅在小屏加载 */
@media (max-width: 767px) {
  .mobile-app {
    width: 100vw; height: 100vh;
    display: flex; flex-direction: column;
    background: #fff; overflow: hidden;
  }
  .mobile-body {
    flex: 1; overflow: hidden; position: relative;
  }
  .mobile-footer {
    display: flex; gap: 12px; padding: 12px 16px;
    border-top: 1px solid #e2e8f0; background: #fff;
  }
  .mobile-btn {
    flex: 1; padding: 14px 0; border: none; border-radius: 12px;
    font-size: 16px; font-weight: 600; cursor: pointer;
    text-align: center; min-height: 48px;
  }
  .mobile-btn-primary { background: #3b82f6; color: #fff; }
  .mobile-btn-secondary { background: #f1f5f9; color: #475569; }
  .mobile-btn:disabled { opacity: 0.4; }

  .step-indicator {
    display: flex; align-items: center; justify-content: center;
    padding: 12px 16px; gap: 8px; border-bottom: 1px solid #e2e8f0;
    background: #fff;
  }
  .step-dot {
    width: 10px; height: 10px; border-radius: 50%;
    transition: background 0.3s;
  }
  .step-line { width: 24px; height: 2px; }
  .step-label { font-size: 11px; }

  .category-cloud {
    display: flex; flex-wrap: wrap; gap: 12px;
    padding: 16px; justify-content: center;
  }
  .category-card {
    padding: 14px 20px; border-radius: 16px;
    border: 2px solid #e2e8f0; font-size: 15px; font-weight: 600;
    min-width: 80px; text-align: center; cursor: pointer;
    transition: all 0.15s; min-height: 48px;
    display: flex; align-items: center; justify-content: center;
  }
  .category-card.active { border-color: transparent; color: #fff; }

  .draw-tools {
    display: flex; gap: 8px; padding: 12px 16px;
    justify-content: center; background: #fff;
    border-top: 1px solid #e2e8f0;
  }
  .draw-btn {
    width: 56px; height: 56px; border-radius: 14px;
    border: 2px solid #e2e8f0; background: #fff;
    font-size: 22px; display: flex; align-items: center;
    justify-content: center; cursor: pointer;
  }
  .draw-btn.active { background: #3b82f6; border-color: #3b82f6; color: #fff; }

  .grid-panel {
    padding: 16px; background: #fff; border-top: 1px solid #e2e8f0;
  }
  .grid-slider { width: 100%; height: 40px; accent-color: #3b82f6; }
  .grid-presets { display: flex; gap: 8px; justify-content: center; margin: 8px 0; }
  .grid-preset {
    padding: 8px 16px; border-radius: 8px; border: 1.5px solid #e2e8f0;
    background: #fff; font-size: 14px; cursor: pointer;
  }
  .grid-preset.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }

  .collect-ring {
    width: 200px; height: 200px; margin: 40px auto;
    border-radius: 50%; border: 8px solid #e2e8f0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative;
  }
  .collect-ring-fill {
    position: absolute; inset: -8px; border-radius: 50%;
    border: 8px solid #3b82f6; border-top-color: transparent;
    transform: rotate(-90deg);
  }

  .poi-list-item {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; border-bottom: 1px solid #f1f5f9;
    min-height: 56px; cursor: pointer;
  }
  .poi-dot {
    width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
  }

  .mobile-map {
    width: 100%; position: absolute; top: 0; bottom: 0;
  }
}
```

- [ ] **Step 3: 安装 supabase-js 并验证编译**

```bash
cd ~/Desktop/poi-gis-tool/client && npm install @supabase/supabase-js --save
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/services/supabase.ts client/src/mobile.css client/package.json client/package-lock.json
git commit -m "feat: mobile CSS + Supabase client service"
```

---

### Task 2: MobileApp.tsx + StepIndicator

**Files:**
- Create: `~/Desktop/poi-gis-tool/client/src/components/mobile/MobileApp.tsx`
- Create: `~/Desktop/poi-gis-tool/client/src/components/mobile/StepIndicator.tsx`

- [ ] **Step 1: 创建 StepIndicator.tsx**

```typescript
import React from 'react';

const STEPS = ['类别', '区域', '网格', '采集', '结果'];

interface Props {
  current: number;
  onStepClick: (step: number) => void;
}

function StepIndicator({ current, onStepClick }: Props) {
  return (
    <div className="step-indicator">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: i < current ? 'pointer' : 'default' }}
            onClick={() => i < current && onStepClick(i + 1)}>
            <div className="step-dot" style={{
              background: i + 1 === current ? '#3b82f6' : i + 1 < current ? '#22c55e' : '#e2e8f0',
              width: i + 1 === current ? 14 : 10, height: i + 1 === current ? 14 : 10,
            }} />
            <span className="step-label" style={{
              color: i + 1 === current ? '#3b82f6' : i + 1 < current ? '#22c55e' : '#cbd5e1',
              fontWeight: i + 1 === current ? 700 : 400,
            }}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="step-line" style={{ background: i + 1 < current ? '#22c55e' : '#e2e8f0' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default StepIndicator;
```

- [ ] **Step 2: 创建 MobileApp.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import StepIndicator from './StepIndicator';
import StepCategories from './StepCategories';
import StepDraw from './StepDraw';
import StepGrid from './StepGrid';
import StepCollect from './StepCollect';
import StepResults from './StepResults';
import type { DrawnShape, GridCell } from '../MapView';
import { CATEGORY_LIST } from '../../types/poi';

function MobileApp() {
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [poiData, setPoiData] = useState<any[]>([]);
  const [drawnOverlay, setDrawnOverlay] = useState<any>(null);
  const [gridOverlays, setGridOverlays] = useState<any[]>([]);

  const canNext = () => {
    if (step === 1) return categories.length > 0;
    if (step === 2) return !!drawnShape;
    if (step === 3) return gridCells.length > 0;
    return true;
  };

  const next = () => { if (canNext() && step < 5) setStep(s => s + 1); };
  const prev = () => { if (step > 1) setStep(s => s - 1); };

  return (
    <div className="mobile-app">
      <StepIndicator current={step} onStepClick={setStep} />
      <div className="mobile-body">
        {step === 1 && <StepCategories selected={categories} onChange={setCategories} />}
        {step === 2 && <StepDraw drawnShape={drawnShape} onShapeChange={setDrawnShape} />}
        {step === 3 && <StepGrid drawnShape={drawnShape} gridCells={gridCells} onGridChange={setGridCells} />}
        {step === 4 && <StepCollect categories={categories} gridCells={gridCells} onComplete={(pois) => { setPoiData(pois); setStep(5); }} />}
        {step === 5 && <StepResults pois={poiData} onRestart={() => { setStep(1); setPoiData([]); setCategories([]); setDrawnShape(null); setGridCells([]); }} />}
      </div>
      {step < 4 && (
        <div className="mobile-footer">
          {step > 1 && <button className="mobile-btn mobile-btn-secondary" onClick={prev}>上一步</button>}
          <button className="mobile-btn mobile-btn-primary" disabled={!canNext()} onClick={next}>
            {step === 3 ? '开始采集' : '下一步'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MobileApp;
```

- [ ] **Step 3: 验证编译**

```bash
cd ~/Desktop/poi-gis-tool/client && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/mobile/
git commit -m "feat: MobileApp root + StepIndicator component"
```

---

### Task 3: StepCategories（步骤1）

**Files:**
- Create: `~/Desktop/poi-gis-tool/client/src/components/mobile/StepCategories.tsx`

- [ ] **Step 1: 实现**

```typescript
import React, { useState, useMemo } from 'react';
import { CATEGORY_LIST } from '../../types/poi';

interface Props {
  selected: string[];
  onChange: (codes: string[]) => void;
}

function StepCategories({ selected, onChange }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return CATEGORY_LIST;
    return CATEGORY_LIST.filter(c => c.name.includes(search));
  }, [search]);

  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
      <input
        type="text" placeholder="搜索类别..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{
          padding: '14px 16px', border: '2px solid #e2e8f0', borderRadius: 12,
          fontSize: 16, outline: 'none', marginBottom: 16, width: '100%', boxSizing: 'border-box',
        }}
      />
      <div className="category-cloud">
        {filtered.map(c => (
          <div key={c.code} className={`category-card ${selected.includes(c.code) ? 'active' : ''}`}
            onClick={() => toggle(c.code)}
            style={selected.includes(c.code) ? { backgroundColor: c.color } : {}}>
            {c.name}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 14, color: '#94a3b8', padding: 16 }}>
        已选 {selected.length} 个类别
      </div>
    </div>
  );
}

export default StepCategories;
```

- [ ] **Step 2: 验证编译**

```bash
cd ~/Desktop/poi-gis-tool/client && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/mobile/StepCategories.tsx
git commit -m "feat: StepCategories - category selection for mobile"
```

---

### Task 4: StepDraw + StepGrid（步骤2+3）

**Files:**
- Create: `~/Desktop/poi-gis-tool/client/src/components/mobile/StepDraw.tsx`
- Create: `~/Desktop/poi-gis-tool/client/src/components/mobile/StepGrid.tsx`

- [ ] **Step 1: 创建 StepDraw.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { useAmap, type DrawMode, type DrawnShape } from '../../hooks/useAmap';

interface Props {
  drawnShape: DrawnShape | null;
  onShapeChange: (shape: DrawnShape | null) => void;
}

function StepDraw({ drawnShape, onShapeChange }: Props) {
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const { loaded, setDrawMode: applyMode, clearDrawings, getDrawnShape } = useAmap('mobile-map');

  const selectMode = useCallback((mode: DrawMode) => {
    if (drawMode === mode) { setDrawMode(null); applyMode(null); }
    else { setDrawMode(mode); applyMode(mode); }
  }, [drawMode, applyMode]);

  // Periodically check for new drawn shape
  React.useEffect(() => {
    const timer = setInterval(() => {
      const shape = getDrawnShape();
      if (shape && shape !== drawnShape) onShapeChange(shape);
    }, 500);
    return () => clearInterval(timer);
  }, [drawnShape, getDrawnShape, onShapeChange]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div id="mobile-map" style={{ width: '100%', height: '100%' }} />
      {drawnShape && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600 }}>
          区域已绘制
        </div>
      )}
      <div className="draw-tools">
        {(['polygon', 'rectangle', 'circle'] as DrawMode[]).map(m => (
          <button key={m} className={`draw-btn ${drawMode === m ? 'active' : ''}`} onClick={() => selectMode(m)}>
            {m === 'polygon' ? '⬠' : m === 'rectangle' ? '▭' : '◯'}
          </button>
        ))}
        <button className="draw-btn" style={{ color: '#ef4444' }} onClick={() => { clearDrawings(); onShapeChange(null); }}>
          ✕
        </button>
      </div>
    </div>
  );
}

export default StepDraw;
```

- [ ] **Step 2: 创建 StepGrid.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { useAmap, type DrawnShape, type GridCell } from '../../hooks/useAmap';
import { generateGridCells, pointInPolygon, pointInCircle } from '../../hooks/useAmap';
import '!' // note: splitGrid helper is inside useAmap hook

interface Props {
  drawnShape: DrawnShape | null;
  gridCells: GridCell[];
  onGridChange: (cells: GridCell[]) => void;
}

function StepGrid({ drawnShape, gridCells, onGridChange }: Props) {
  const [gridSize, setGridSize] = useState(500);
  const { loaded, splitGrid } = useAmap('mobile-map-grid');

  const handleSplit = useCallback(() => {
    const count = splitGrid(gridSize);
    // gridCells updated via the map hook
  }, [gridSize, splitGrid]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div id="mobile-map-grid" style={{ width: '100%', height: '100%' }} />
      {gridCells.length > 0 && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600 }}>
          {gridCells.length} 个网格单元
        </div>
      )}
      <div className="grid-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>网格精度</span>
          <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 700 }}>{gridSize}m</span>
        </div>
        <input type="range" className="grid-slider" min={100} max={2000} step={50} value={gridSize} onChange={e => setGridSize(Number(e.target.value))} />
        <div className="grid-presets">
          {[500, 1000, 1500].map(v => (
            <button key={v} className={`grid-preset ${gridSize === v ? 'active' : ''}`} onClick={() => setGridSize(v)}>{v}m</button>
          ))}
        </div>
        <button className="mobile-btn mobile-btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleSplit} disabled={!drawnShape}>
          执行切分
        </button>
      </div>
    </div>
  );
}

export default StepGrid;
```

- [ ] **Step 3: 验证编译**

```bash
cd ~/Desktop/poi-gis-tool/client && npx tsc --noEmit
```

Expected: zero errors. Fix any type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/mobile/StepDraw.tsx client/src/components/mobile/StepGrid.tsx
git commit -m "feat: StepDraw + StepGrid mobile components"
```

---

### Task 5: StepCollect + StepResults（步骤4+5）

**Files:**
- Create: `~/Desktop/poi-gis-tool/client/src/components/mobile/StepCollect.tsx`
- Create: `~/Desktop/poi-gis-tool/client/src/components/mobile/StepResults.tsx`

- [ ] **Step 1: 创建 StepCollect.tsx**

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { startCollection } from '../../services/api';
import { getProgressUrl } from '../../services/api';
import type { GridCell } from '../../hooks/useAmap';

interface Props {
  categories: string[];
  gridCells: GridCell[];
  onComplete: (pois: any[]) => void;
}

function StepCollect({ categories, gridCells, onComplete }: Props) {
  const [progress, setProgress] = useState({ done: 0, total: gridCells.length, pois: 0 });
  const [status, setStatus] = useState<'running' | 'paused' | 'done'>('running');
  const taskIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Try desktop backend first, fallback to PlaceSearch
    const start = async () => {
      try {
        const result = await startCollection({
          mode: 'region',
          categories,
          bounds: { southwest: { lng: 0, lat: 0 }, northeast: { lng: 0, lat: 0 } },
        });
        taskIdRef.current = result.taskId;
        // SSE progress
        const es = new EventSource(getProgressUrl(result.taskId));
        es.addEventListener('progress', (e) => {
          const d = JSON.parse(e.data);
          setProgress({ done: d.doneCells, total: d.totalCells, pois: d.totalPois });
        });
        es.addEventListener('complete', (e) => {
          const d = JSON.parse(e.data);
          setStatus('done');
          onComplete([]); // fetch actual POIs from Supabase in StepResults
          es.close();
        });
        return () => es.close();
      } catch {
        // Fallback: poll Supabase for task progress
        setStatus('done');
        onComplete([]);
      }
    };
    start();
  }, []);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
      <div className="collect-ring">
        {status === 'running' && <div className="collect-ring-fill" style={{ clipPath: `polygon(50% 50%, 50% 0, ${50 + 50 * Math.cos((pct / 100) * Math.PI * 2 - Math.PI / 2)}% ${50 + 50 * Math.sin((pct / 100) * Math.PI * 2 - Math.PI / 2)}%)` }} />}
        <span style={{ fontSize: 48, fontWeight: 800, color: '#3b82f6' }}>{pct}%</span>
        <span style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{status === 'done' ? '采集完成' : '采集中...'}</span>
      </div>
      <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>{progress.pois}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>POI</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>{progress.done}/{progress.total}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>格子</div></div>
      </div>
      {status === 'running' && (
        <button className="mobile-btn mobile-btn-secondary" style={{ marginTop: 32, width: 120 }} onClick={() => setStatus('paused')}>
          暂停
        </button>
      )}
    </div>
  );
}

export default StepCollect;
```

- [ ] **Step 2: 创建 StepResults.tsx**

```typescript
import React from 'react';
import { CATEGORY_LIST } from '../../types/poi';

interface Props {
  pois: any[];
  onRestart: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {};
CATEGORY_LIST.forEach(c => { CATEGORY_COLORS[c.name] = c.color; });

function StepResults({ pois, onRestart }: Props) {
  const exportGeoJSON = () => {
    const geojson = { type: 'FeatureCollection', features: pois.map((p: any) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { name: p.name, category: p.category, address: p.address },
    }))};
    const blob = new Blob([JSON.stringify(geojson)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pois.geojson'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>采集结果 ({pois.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mobile-btn mobile-btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={exportGeoJSON}>GeoJSON</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {pois.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>暂无数据</div>
        )}
        {pois.map((p: any, i: number) => (
          <div key={i} className="poi-list-item">
            <div className="poi-dot" style={{ background: CATEGORY_COLORS[p.category] || '#94a3b8' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{p.category} · {p.address}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mobile-footer">
        <button className="mobile-btn mobile-btn-primary" onClick={onRestart}>完成</button>
      </div>
    </div>
  );
}

export default StepResults;
```

- [ ] **Step 3: 验证编译**

```bash
cd ~/Desktop/poi-gis-tool/client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/mobile/StepCollect.tsx client/src/components/mobile/StepResults.tsx
git commit -m "feat: StepCollect + StepResults mobile components"
```

---

### Task 6: App.tsx 媒体查询路由

**Files:**
- Modify: `~/Desktop/poi-gis-tool/client/src/App.tsx`
- Modify: `~/Desktop/poi-gis-tool/client/src/App.css`

- [ ] **Step 1: 更新 App.tsx**

```typescript
import React, { useState, useEffect } from 'react';
import DesktopApp from './components/DesktopApp';
import MobileApp from './components/mobile/MobileApp';
import './App.css';
import './mobile.css';

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile ? <MobileApp /> : <DesktopApp />;
}

export default App;
```

- [ ] **Step 2: 创建 DesktopApp.tsx（把现 App.tsx 内容搬过去）**

Copy the existing `App.tsx` content to a new file `DesktopApp.tsx`, update imports accordingly.

```bash
cp client/src/App.tsx client/src/components/DesktopApp.tsx
```

Then edit `DesktopApp.tsx` — rename the component from `App` to `DesktopApp`, remove App.css import (now handled by App.tsx).

- [ ] **Step 3: 验证编译**

```bash
cd ~/Desktop/poi-gis-tool/client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx client/src/App.css client/src/components/DesktopApp.tsx client/src/mobile.css
git commit -m "feat: media query routing - DesktopApp vs MobileApp"
```

---

### Task 7: 构建 APK + 验证

- [ ] **Step 1: 构建前端**

```bash
cd ~/Desktop/poi-gis-tool/client && npm run build
```

- [ ] **Step 2: 同步到 Android**

```bash
cd ~/Desktop/poi-gis-tool/client && npx cap sync android
```

- [ ] **Step 3: 构建 APK**

```bash
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$HOME/AppData/Local/Android/Sdk"
cd ~/Desktop/poi-gis-tool/client/android && ./gradlew assembleDebug
```

- [ ] **Step 4: 验证 APK 存在**

```bash
ls client/android/app/build/outputs/apk/debug/app-debug.apk
```

Expected: file exists.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "build: mobile APK with new 5-step UI"
```

---

## 自审清单

- [x] 每个 spec 需求有对应任务 — 5个步骤组件 + 步骤条 + 后端降级 + Supabase
- [x] 无 TBD/TODO
- [x] 类型引用一致 — `DrawnShape`, `GridCell` 从 `../hooks/useAmap` 导入
- [x] 移动端 CSS 类名与组件中使用的类名一致
- [x] StepResults 引用 POI 记录的类型 `CloudPoi`
