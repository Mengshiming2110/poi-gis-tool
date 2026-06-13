import { Polygon, Square, Circle, Trash } from '@phosphor-icons/react';
import type { DrawMode } from './MapView';

interface DrawToolbarProps {
  activeMode: DrawMode;
  onModeChange: (mode: DrawMode) => void;
  onClear: () => void;
  setDrawMode: ((mode: DrawMode) => void) | null;
}

function DrawToolbar({ activeMode, onModeChange, onClear, setDrawMode }: DrawToolbarProps) {
  const activateMode = (mode: 'polygon' | 'rectangle' | 'circle') => {
    if (activeMode === mode) {
      setDrawMode?.(null);
      onModeChange(null);
    } else {
      setDrawMode?.(mode);
      onModeChange(mode);
    }
  };

  const btnStyle = (mode: DrawMode): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 5,
    background: activeMode === mode ? 'var(--accent)' : 'var(--surface)',
    color: activeMode === mode ? '#fff' : 'var(--muted)', cursor: 'pointer',
  });

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 10,
      display: 'flex', gap: 3, background: 'var(--surface)',
      borderRadius: 'var(--radius)', padding: 3, border: '1px solid var(--border)',
    }}>
      <button type="button" style={btnStyle('polygon')} onClick={() => activateMode('polygon')} title="多边形">
        <Polygon size={18} />
      </button>
      <button type="button" style={btnStyle('rectangle')} onClick={() => activateMode('rectangle')} title="矩形">
        <Square size={18} />
      </button>
      <button type="button" style={btnStyle('circle')} onClick={() => activateMode('circle')} title="圆形">
        <Circle size={18} />
      </button>
      <div style={{ width: 1, background: '#e2e8f0', margin: '4px 2px' }} />
      <button type="button" style={{ ...btnStyle(null), color: '#ef4444' }} onClick={() => { setDrawMode?.(null); onClear(); }} title="清除">
        <Trash size={18} />
      </button>
    </div>
  );
}

export default DrawToolbar;
