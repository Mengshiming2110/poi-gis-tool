import { useState, useCallback, useMemo, useRef } from 'react';
import MapView from './components/MapView';
import ControlPanel from './components/ControlPanel';
import DrawToolbar from './components/DrawToolbar';
import ProgressDrawer from './components/ProgressDrawer';
import SettingsDialog from './components/SettingsDialog';
import { useCollection } from './hooks/useCollection';
import { useSSE } from './hooks/useSSE';
import { getExportUrl } from './services/api';
import type { TaskMode } from './types/poi';
import type { DrawMode } from './components/MapView';
import './App.css';

function App() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mode, setMode] = useState<TaskMode>('grid');
  const [gridSize, setGridSize] = useState(0.01);
  const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | null>(null);

  const drawAPIRef = useRef<{ setDrawMode: (mode: DrawMode) => void; clearDrawings: () => void; getDrawnShape: () => any } | null>(null);
  const getBoundsRef = useRef<(() => any) | null>(null);

  const collection = useCollection();

  useSSE(
    collection.taskId,
    collection.onProgress,
    collection.onComplete,
    collection.onError,
  );

  const estimatedCells = useMemo(() => 0, [mode, gridSize]);
  const estimatedMinutes = useMemo(() => Math.ceil((estimatedCells * 1.2) / 60), [estimatedCells]);

  const disabled = selectedCategories.length === 0 || collection.status === 'running';

  const handleDrawReady = useCallback((api: { setDrawMode: (mode: DrawMode) => void; clearDrawings: () => void; getDrawnShape: () => any }) => {
    drawAPIRef.current = api;
  }, []);

  const handleMapReady = useCallback((getBounds: () => any) => {
    getBoundsRef.current = getBounds;
  }, []);

  const handleStart = useCallback(() => {
    const bounds = getBoundsRef.current?.() || {
      southwest: { lng: 116.3, lat: 39.8 },
      northeast: { lng: 116.5, lat: 40.0 },
    };

    if (mode === 'region') {
      const region = drawAPIRef.current?.getDrawnShape();
      if (!region) {
        alert('请先在地图上绘制区域');
        return;
      }
    }

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
      <MapView onDrawReady={handleDrawReady} onMapReady={handleMapReady}>
        <ControlPanel
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          mode={mode}
          gridSize={gridSize}
          estimatedCells={estimatedCells}
          estimatedMinutes={estimatedMinutes}
          onModeChange={setMode}
          onGridSizeChange={setGridSize}
          onStart={handleStart}
          disabled={disabled}
        />

        {mode === 'region' && (
          <DrawToolbar
            activeMode={drawMode}
            onModeChange={setDrawMode}
            onClear={() => setDrawMode(null)}
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
    </>
  );
}

export default App;
