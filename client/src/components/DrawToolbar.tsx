import { Polygon, Square, Circle, Trash } from '@phosphor-icons/react';

type DrawMode = 'polygon' | 'rectangle' | 'circle' | null;

interface DrawToolbarProps {
  activeMode: DrawMode;
  onModeChange: (mode: DrawMode) => void;
  onClear: () => void;
}

function DrawToolbar({ activeMode, onModeChange, onClear }: DrawToolbarProps) {
  const btnStyle = (mode: DrawMode): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, border: 'none', borderRadius: 6,
    background: activeMode === mode ? '#3b82f6' : 'transparent',
    color: activeMode === mode ? '#fff' : '#475569', cursor: 'pointer',
  });

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 10,
      display: 'flex', gap: 4, background: 'rgba(255,255,255,0.95)',
      borderRadius: 8, padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <button type="button" style={btnStyle('polygon')}
        onClick={() => onModeChange(activeMode === 'polygon' ? null : 'polygon')} title="多边形">
        <Polygon size={18} />
      </button>
      <button type="button" style={btnStyle('rectangle')}
        onClick={() => onModeChange(activeMode === 'rectangle' ? null : 'rectangle')} title="矩形">
        <Square size={18} />
      </button>
      <button type="button" style={btnStyle('circle')}
        onClick={() => onModeChange(activeMode === 'circle' ? null : 'circle')} title="圆形">
        <Circle size={18} />
      </button>
      <div style={{ width: 1, background: '#e2e8f0', margin: '4px 2px' }} />
      <button type="button" style={{ ...btnStyle(null), color: '#ef4444' }} onClick={onClear} title="清除">
        <Trash size={18} />
      </button>
    </div>
  );
}

export default DrawToolbar;
