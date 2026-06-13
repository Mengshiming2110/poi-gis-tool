import React, { useState, useCallback } from 'react';
import type { DrawnShape, GridCell } from '../../hooks/useAmap';

interface Props {
  loaded: boolean;
  drawnShape: DrawnShape | null;
  gridCells: GridCell[];
  splitGrid: (meters: number) => number;
}

function StepGrid({ loaded, drawnShape, gridCells, splitGrid }: Props) {
  const [gridSize, setGridSize] = useState(500);

  const handleSplit = useCallback(() => {
    if (!loaded || !drawnShape) return;
    splitGrid(gridSize);
  }, [gridSize, splitGrid, loaded, drawnShape]);

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 }}>
      {gridCells.length > 0 && (
        <div style={{
          margin: '0 auto 8px', width: 'fit-content',
          background: '#f59e0b', color: '#fff', padding: '6px 16px',
          borderRadius: 20, fontSize: 13, fontWeight: 600,
        }}>
          {gridCells.length} 个网格单元
        </div>
      )}
      {!loaded && (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 8 }}>地图加载中...</div>
      )}
      <div className="grid-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>网格精度</span>
          <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 700 }}>{gridSize}m</span>
        </div>
        <input
          type="range" className="grid-slider"
          min={100} max={2000} step={50}
          value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))}
          disabled={!loaded}
        />
        <div className="grid-presets">
          {[500, 1000, 1500].map((v) => (
            <button key={v} className={`grid-preset ${gridSize === v ? 'active' : ''}`}
              onClick={() => setGridSize(v)}>{v}m</button>
          ))}
        </div>
        <button
          className="mobile-btn mobile-btn-primary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={handleSplit}
          disabled={!drawnShape || !loaded}
        >
          执行切分
        </button>
      </div>
    </div>
  );
}

export default StepGrid;
