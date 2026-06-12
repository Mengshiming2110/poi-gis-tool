import { useState, useCallback, useMemo } from 'react';
import MapView from './components/MapView';
import ControlPanel from './components/ControlPanel';
import DrawToolbar from './components/DrawToolbar';
import ProgressDrawer from './components/ProgressDrawer';
import DataTable from './components/DataTable';
import { useCollection } from './hooks/useCollection';
import { useSSE } from './hooks/useSSE';
import { getExportUrl } from './services/api';
import type { TaskMode } from './types/poi';
import './App.css';

function App() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mode, setMode] = useState<TaskMode>('grid');
  const [gridSize, setGridSize] = useState(0.01);
  const [drawMode, setDrawMode] = useState<'polygon' | 'rectangle' | 'circle' | null>(null);

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

  const handleStart = useCallback(() => {
    const defaultBounds = {
      southwest: { lng: 116.3, lat: 39.8 },
      northeast: { lng: 116.5, lat: 40.0 },
    };
    collection.start({
      mode,
      categories: selectedCategories,
      bounds: defaultBounds,
      gridSize: mode === 'grid' ? gridSize : undefined,
    });
  }, [mode, selectedCategories, gridSize, collection]);

  const handleExport = useCallback((format: 'xlsx' | 'geojson') => {
    if (!collection.taskId) return;
    window.open(getExportUrl(collection.taskId, format), '_blank');
  }, [collection.taskId]);

  return (
    <>
      <MapView>
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
          <DrawToolbar activeMode={drawMode} onModeChange={setDrawMode} onClear={() => setDrawMode(null)} />
        )}

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

        {collection.taskId && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 9,
            background: '#fff', padding: '0 16px', borderRadius: '10px 10px 0 0',
            boxShadow: '0 -2px 12px rgba(0,0,0,0.08)', maxHeight: '40vh', overflowY: 'auto',
          }}>
            <DataTable taskId={collection.taskId} />
          </div>
        )}
      </MapView>
    </>
  );
}

export default App;
