import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAmap, type DrawMode, type DrawnShape } from '../../hooks/useAmap';

interface Props {
  drawnShape: DrawnShape | null;
  onShapeChange: (shape: DrawnShape | null) => void;
}

function StepDraw({ drawnShape, onShapeChange }: Props) {
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const { loaded, setDrawMode: applyMode, clearDrawings, getDrawnShape } = useAmap('mobile-draw-map');
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
    [drawMode, applyMode]
  );

  // Poll for drawn shape
  useEffect(() => {
    if (!loaded) return;
    pollRef.current = setInterval(() => {
      const shape = getDrawnShape();
      if (shape && (!drawnShape || shape.type !== drawnShape.type)) {
        onShapeChange(shape);
      }
    }, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loaded, drawnShape, getDrawnShape, onShapeChange]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div id="mobile-draw-map" style={{ width: '100%', height: '100%' }} />
      {drawnShape && (
        <div
          style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: '#22c55e', color: '#fff', padding: '8px 20px',
            borderRadius: 20, fontSize: 14, fontWeight: 600,
            zIndex: 50,
          }}
        >
          区域已绘制
        </div>
      )}
      <div className="draw-tools">
        {(['polygon', 'rectangle', 'circle'] as DrawMode[]).map((m) => (
          <button
            key={m}
            className={`draw-btn ${drawMode === m ? 'active' : ''}`}
            onClick={() => selectMode(m)}
          >
            {m === 'polygon' ? '⬠' : m === 'rectangle' ? '▭' : '◯'}
          </button>
        ))}
        <button
          className="draw-btn"
          style={{ color: '#ef4444' }}
          onClick={() => { clearDrawings(); onShapeChange(null); }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default StepDraw;
