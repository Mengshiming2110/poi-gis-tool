import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { DrawMode, DrawnShape } from '../../hooks/useAmap';

const DRAW_TOOLS: Array<{ mode: Exclude<DrawMode, null>; label: string; hint: string; icon: string }> = [
  { mode: 'polygon', label: '自由区域', hint: '点按地图添加边界点，完成后自动生成区域', icon: '⬠' },
  { mode: 'rectangle', label: '矩形范围', hint: '点一次设起点，再点一次完成矩形', icon: '▭' },
  { mode: 'circle', label: '圆形范围', hint: '点一次设中心，再点一次设半径', icon: '◯' },
];

interface Props {
  loaded: boolean;
  drawnShape: DrawnShape | null;
  setDrawMode: (mode: DrawMode) => void;
  clearDrawings: () => void;
  getDrawnShape: () => DrawnShape | null;
  onShapeChange: (shape: DrawnShape | null) => void;
}

function StepDraw({ loaded, drawnShape, setDrawMode: applyMode, clearDrawings, getDrawnShape, onShapeChange }: Props) {
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectMode = useCallback(
    (mode: DrawMode) => {
      if (drawMode === mode) {
        setDrawMode(null);
        applyMode(null);
      } else {
        setDrawMode(mode);
        applyMode(mode);
      }
    },
    [drawMode, applyMode],
  );

  // Poll for drawn shape
  useEffect(() => {
    if (!loaded) return;
    pollRef.current = setInterval(() => {
      const shape = getDrawnShape();
      if (shape && (!drawnShape || shape.overlay !== drawnShape.overlay)) {
        onShapeChange(shape);
      }
    }, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loaded, drawnShape, getDrawnShape, onShapeChange]);

  useEffect(() => {
    if (drawnShape) setDrawMode(null);
  }, [drawnShape]);

  return (
    <div className="mobile-panel-block">
      {drawnShape && (
        <div className="mobile-success-strip">
          区域已选中，可以继续生成网格
        </div>
      )}

      {!loaded && (
        <div className="mobile-helper-text">地图加载中...</div>
      )}

      <div className="draw-tools">
        {DRAW_TOOLS.map((tool) => (
          <button
            key={tool.mode}
            className={`draw-btn ${drawMode === tool.mode ? 'active' : ''}`}
            onClick={() => selectMode(tool.mode)}
            disabled={!loaded}
          >
            <span className="draw-icon">{tool.icon}</span>
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="mobile-helper-text">
        {drawMode
          ? DRAW_TOOLS.find((tool) => tool.mode === drawMode)?.hint
          : drawnShape
            ? '需要调整时可重新选择绘制方式，旧区域会被替换。'
            : '先选择一种绘制方式，再在地图上操作。'}
      </div>

      <button className="mobile-text-action"
        onClick={() => { clearDrawings(); onShapeChange(null); }} disabled={!loaded || !drawnShape}>
        清除当前区域
      </button>
    </div>
  );
}

export default StepDraw;
