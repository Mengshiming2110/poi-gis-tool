import { useState, useCallback, useRef } from 'react';
import MapView from './components/MapView';
import ControlPanel from './components/ControlPanel';
import DrawToolbar from './components/DrawToolbar';
import ProgressDrawer from './components/ProgressDrawer';
import SettingsDialog from './components/SettingsDialog';
import { useCollection } from './hooks/useCollection';
import { useSSE } from './hooks/useSSE';
import { getExportUrl } from './services/api';
import type { TaskMode } from './types/poi';
import type { DrawMode, MapAPI, DrawnShape, GridCell } from './components/MapView';
import './App.css';

function App() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mode, setMode] = useState<TaskMode>('region');
  const [gridSize, setGridSize] = useState(0.01);
  const [gridSizeMeters, setGridSizeMeters] = useState(300);
  const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | null>('polygon');
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);

  const drawAPIRef = useRef<MapAPI | null>(null);
  const collection = useCollection();

  useSSE(collection.taskId, collection.onProgress, collection.onComplete, collection.onError);

  const showToast = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const disabled = selectedCategories.length === 0
    || collection.status === 'running'
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

  const handleStart = useCallback(() => {
    const bounds = drawAPIRef.current?.getBounds() || {
      southwest: { lng: 116.3, lat: 39.8 },
      northeast: { lng: 116.5, lat: 40.0 },
    };

    collection.start({
      mode,
      categories: selectedCategories,
      bounds,
      gridSize: mode === 'grid' ? gridSize : undefined,
    });
  }, [mode, selectedCategories, gridSize, collection]);

  const handleExport = useCallback((format: 'xlsx' | 'geojson') => {
    if (!collection.taskId) return;
    window.open(getExportUrl(collection.taskId, format), '_blank');
  }, [collection.taskId]);

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
          estimatedMinutes={Math.ceil(gridCells.length * 1.2 / 60)}
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

        <ProgressDrawer
          status={collection.status}
          progress={collection.progress}
          totalPois={collection.totalPois}
          taskId={collection.taskId}
          onPause={collection.pause}
          onResume={collection.resume}
          onCancel={collection.cancel}
          onExport={handleExport}
        />
      </MapView>

      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '8px 20px', borderRadius: 20,
          fontSize: 13, fontWeight: 600, color: '#fff',
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#22c55e' : '#1e293b',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', pointerEvents: 'none',
        }}>{toast.msg}</div>
      )}
    </>
  );
}

export default App;
