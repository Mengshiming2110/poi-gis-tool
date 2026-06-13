import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { DrawMode, DrawnShape } from '../../hooks/useAmap';

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

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}>
      {/* Status badge */}
      {drawnShape && (
        <div style={{
          margin: '0 auto 8px', width: 'fit-content',
          background: '#22c55e', color: '#fff', padding: '6px 16px',
          borderRadius: 20, fontSize: 13, fontWeight: 600, pointerEvents: 'auto',
        }}>
          区域已绘制
        </div>
      )}
      {/* Loading */}
      {!loaded && (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 8 }}>地图加载中...</div>
      )}
      {/* Draw tools */}
      <div className="draw-tools" style={{ pointerEvents: 'auto' }}>
        {(['polygon', 'rectangle', 'circle'] as DrawMode[]).map((m) => (
          <button
            key={m}
            className={`draw-btn ${drawMode === m ? 'active' : ''}`}
            onClick={() => selectMode(m)}
            disabled={!loaded}
          >
            {m === 'polygon' ? '⬠' : m === 'rectangle' ? '▭' : '◯'}
          </button>
        ))}
        <button className="draw-btn" style={{ color: '#ef4444' }}
          onClick={() => { clearDrawings(); onShapeChange(null); }} disabled={!loaded}>
          ✕
        </button>
      </div>
    </div>
  );
}

export default StepDraw;
