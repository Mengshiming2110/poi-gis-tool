import React, { useState, useCallback } from 'react';
import type { DrawnShape, GridCell } from '../../hooks/useAmap';

const PRESETS = [
  { key: 'save', label: '省额度', meters: 1200, desc: '请求少，适合大范围预览' },
  { key: 'balanced', label: '均衡', meters: 800, desc: '推荐，速度和精度平衡' },
  { key: 'fine', label: '精细', meters: 400, desc: '更细，但会增加调用次数' },
];

interface Props {
  loaded: boolean;
  drawnShape: DrawnShape | null;
  gridCells: GridCell[];
  splitGrid: (meters: number) => number;
}

function StepGrid({ loaded, drawnShape, gridCells, splitGrid }: Props) {
  const [gridSize, setGridSize] = useState(800);

  const handleSplit = useCallback(() => {
    if (!loaded || !drawnShape) return;
    splitGrid(gridSize);
  }, [gridSize, splitGrid, loaded, drawnShape]);

  return (
    <div className="mobile-panel-block">
      {gridCells.length > 0 && (
        <div className="mobile-success-strip">
          已生成 {gridCells.length} 个采集网格
        </div>
      )}
      {!loaded && (
        <div className="mobile-helper-text">地图加载中...</div>
      )}

      <div className="grid-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            className={`grid-preset ${gridSize === preset.meters ? 'active' : ''}`}
            onClick={() => setGridSize(preset.meters)}
          >
            <strong>{preset.label}</strong>
            <span>{preset.desc}</span>
          </button>
        ))}
      </div>

      <div className="grid-meter-row">
        <span>当前精度</span>
        <strong>{gridSize}m</strong>
      </div>

      <input
        type="range" className="grid-slider"
        min={300} max={2000} step={100}
        value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))}
        disabled={!loaded}
      />

      <button
        className="mobile-btn mobile-btn-primary"
        style={{ width: '100%' }}
        onClick={handleSplit}
        disabled={!drawnShape || !loaded}
      >
        生成采集网格
      </button>

      <div className="mobile-helper-text">
        网格越小越精细，也越容易消耗高德 API 次数。建议先用“省额度”或“均衡”。
      </div>
    </div>
  );
}

export default StepGrid;
