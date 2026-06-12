import { useState, useCallback, useRef } from 'react';
import MapView from './components/MapView';
import ControlPanel from './components/ControlPanel';
import DrawToolbar from './components/DrawToolbar';
import ProgressDrawer from './components/ProgressDrawer';
import SettingsDialog from './components/SettingsDialog';
import { getExportUrl } from './services/api';
import type { TaskMode } from './types/poi';
import { CATEGORY_LIST } from './types/poi';
import type { DrawMode, MapAPI, DrawnShape, GridCell } from './components/MapView';
import './App.css';

const CATEGORY_NAMES: Record<string, string> = {};
CATEGORY_LIST.forEach(c => { CATEGORY_NAMES[c.code] = c.name; });

function App() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mode, setMode] = useState<TaskMode>('region');
  const [gridSize, setGridSize] = useState(0.01);
  const [gridSizeMeters, setGridSizeMeters] = useState(300);
  const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | null>('polygon');
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Client-side collection state
  const [collStatus, setCollStatus] = useState<'pending' | 'running' | 'paused' | 'done'>('pending');
  const [collProgress, setCollProgress] = useState({ done: 0, total: 0 });
  const [collPois, setCollPois] = useState<any[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  const drawAPIRef = useRef<MapAPI | null>(null);

  const showToast = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const disabled = selectedCategories.length === 0
    || collStatus === 'running'
    || (mode === 'region' && gridCells.length === 0);

  const handleMapReady = useCallback((api: MapAPI) => {
    drawAPIRef.current = api;
  }, []);

  const handleShapeChange = useCallback((shape: DrawnShape | null) => {
    setDrawnShape(shape);
    setGridCells([]);
    if (shape) showToast('区域已绘制，请进行网格切分', 'success');
  }, [showToast]);

  const handleGridChange = useCallback((cells: GridCell[]) => {
    setGridCells(cells);
  }, []);

  const handleSplitGrid = useCallback(() => {
    const api = drawAPIRef.current;
    if (!api || !api.getDrawnShape()) {
      showToast('请先在地图上绘制区域', 'error');
      return;
    }
    const count = api.splitGrid(gridSizeMeters);
    if (count > 0) {
      showToast(`网格切分完成：${count} 个网格单元`, 'success');
    } else {
      showToast('网格切分失败，请重试', 'error');
    }
  }, [gridSizeMeters, showToast]);

  // Client-side collection using PlaceSearch
  const handleStart = useCallback(async () => {
    const api = drawAPIRef.current;
    if (!api) return;

    if (mode === 'region' && gridCells.length === 0) {
      showToast('请先执行网格切分', 'error');
      return;
    }

    const cells = mode === 'region' ? gridCells : []; // grid mode: use map bounds?
    if (mode === 'grid') {
      showToast('网格模式下请使用区域模式', 'info');
      return;
    }

    const totalTasks = cells.length * selectedCategories.length;
    setCollStatus('running');
    setCollProgress({ done: 0, total: totalTasks });
    setCollPois([]);
    setTaskId('client-' + Date.now());

    console.log('[Client] 开始客户端采集:', { cells: cells.length, categories: selectedCategories, gridSizeMeters });

    const pois = await api.collectPOIsClientSide(
      cells, selectedCategories, CATEGORY_NAMES, gridSizeMeters,
      (done, total) => setCollProgress({ done, total })
    );

    setCollPois(pois);
    setCollStatus('done');
    showToast(`采集完成：共获取 ${pois.length} 条POI`, 'success');
  }, [mode, gridCells, selectedCategories, gridSizeMeters, showToast]);

  const handlePause = useCallback(() => {
    drawAPIRef.current?.stopCollecting();
    setCollStatus('paused');
  }, []);

  const handleResume = useCallback(() => {
    // Re-trigger collection with remaining cells
    setCollStatus('running');
  }, []);

  const handleCancel = useCallback(() => {
    drawAPIRef.current?.stopCollecting();
    setCollStatus('pending');
    setCollProgress({ done: 0, total: 0 });
  }, []);

  // Export: use client-side data directly
  const handleExport = useCallback((format: 'xlsx' | 'geojson') => {
    if (collPois.length === 0) return;

    if (format === 'geojson') {
      const geojson = {
        type: 'FeatureCollection',
        features: collPois.map((p: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { name: p.name, category: p.category, subcategory: p.subcategory, address: p.address, phone: p.phone },
        })),
      };
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `pois-${taskId}.geojson`; a.click();
      URL.revokeObjectURL(url);
    } else {
      // Simple CSV as fallback (browser-side Excel needs a library)
      const header = '名称,类别,中类,地址,经度,纬度,电话\n';
      const csv = header + collPois.map((p: any) =>
        `"${p.name}","${p.category}","${p.subcategory}","${p.address}",${p.lng},${p.lat},"${p.phone}"`
      ).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `pois-${taskId}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
    showToast('导出成功', 'success');
  }, [collPois, taskId, showToast]);

  return (
    <>
      <MapView onMapReady={handleMapReady} onShapeChange={handleShapeChange} onGridChange={handleGridChange}>
        <ControlPanel
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          mode={mode}
          gridSize={gridSize}
          gridSizeMeters={gridSizeMeters}
          estimatedCells={gridCells.length}
          estimatedMinutes={Math.ceil(gridCells.length * 0.5 / 60)}
          drawnShape={drawnShape}
          gridCells={gridCells}
          onModeChange={setMode}
          onGridSizeChange={setGridSize}
          onGridSizeMetersChange={setGridSizeMeters}
          onSplitGrid={handleSplitGrid}
          onStart={handleStart}
          disabled={disabled}
        />

        {mode === 'region' && (
          <DrawToolbar
            activeMode={drawMode}
            onModeChange={setDrawMode}
            onClear={() => { drawAPIRef.current?.clearDrawings(); setDrawMode(null); setDrawnShape(null); setGridCells([]); }}
            setDrawMode={(m) => drawAPIRef.current?.setDrawMode(m)}
          />
        )}

        <SettingsDialog />

        {collStatus !== 'pending' && (
          <ProgressDrawer
            status={collStatus}
            progress={{ doneCells: collProgress.done, totalCells: collProgress.total, totalPois: collPois.length }}
            totalPois={collPois.length}
            taskId={taskId}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
            onExport={handleExport}
          />
        )}
      </MapView>

      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '8px 20px', borderRadius: 20,
          fontSize: 13, fontWeight: 600, color: '#fff',
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#22c55e' : '#1e293b',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}>{toast.msg}</div>
      )}
    </>
  );
}

export default App;
