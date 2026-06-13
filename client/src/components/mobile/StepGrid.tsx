import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAmap, type DrawnShape, type GridCell } from '../../hooks/useAmap';

interface Props {
  drawnShape: DrawnShape | null;
  gridCells: GridCell[];
  onGridChange: (cells: GridCell[]) => void;
}

function StepGrid({ drawnShape, gridCells, onGridChange }: Props) {
  const [gridSize, setGridSize] = useState(500);
  const { loaded, splitGrid } = useAmap('mobile-grid-map');
  const prevCountRef = useRef(0);

  const handleSplit = useCallback(() => {
    splitGrid(gridSize);
  }, [gridSize, splitGrid]);

  // Watch for grid changes (splitGrid sets gridCells inside useAmap)
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(() => {
      // The useAmap hook's splitGrid sets internal state.
      // We rely on the map's visual grid overlay + user feedback.
      // GridCell count is managed by the parent MobileApp.
    }, 1000);
    return () => clearInterval(timer);
  }, [loaded]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div id="mobile-grid-map" style={{ width: '100%', height: '100%' }} />
      {gridCells.length > 0 && (
        <div
          style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: '#f59e0b', color: '#fff', padding: '8px 20px',
            borderRadius: 20, fontSize: 14, fontWeight: 600,
            zIndex: 50,
          }}
        >
          {gridCells.length} 个网格单元
        </div>
      )}
      <div className="grid-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>网格精度</span>
          <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 700 }}>{gridSize}m</span>
        </div>
        <input
          type="range"
          className="grid-slider"
          min={100}
          max={2000}
          step={50}
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
        />
        <div className="grid-presets">
          {[500, 1000, 1500].map((v) => (
            <button
              key={v}
              className={`grid-preset ${gridSize === v ? 'active' : ''}`}
              onClick={() => setGridSize(v)}
            >
              {v}m
            </button>
          ))}
        </div>
        <button
          className="mobile-btn mobile-btn-primary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={handleSplit}
          disabled={!drawnShape}
        >
          执行切分
        </button>
      </div>
    </div>
  );
}

export default StepGrid;
