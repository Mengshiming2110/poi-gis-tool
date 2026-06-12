import { Play, GridFour, Polygon } from '@phosphor-icons/react';
import { GRID_SIZE_OPTIONS, type TaskMode } from '../types/poi';

interface CollectionModeProps {
  mode: TaskMode;
  gridSize: number;
  estimatedCells: number;
  estimatedMinutes: number;
  onModeChange: (mode: TaskMode) => void;
  onGridSizeChange: (size: number) => void;
  onStart: () => void;
  disabled: boolean;
}

function CollectionMode({
  mode, gridSize, estimatedCells, estimatedMinutes,
  onModeChange, onGridSizeChange, onStart, disabled,
}: CollectionModeProps) {
  const tabBase: React.CSSProperties = {
    flex: 1, textAlign: 'center', padding: '6px 0',
    cursor: 'pointer', fontSize: 12, background: 'none', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  };

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 8 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: 8 }}>
        <button type="button" onClick={() => onModeChange('grid')}
          style={{
            ...tabBase,
            borderBottom: mode === 'grid' ? '2px solid #3b82f6' : '2px solid transparent',
            fontWeight: mode === 'grid' ? 600 : 400,
            color: mode === 'grid' ? '#3b82f6' : '#94a3b8',
          }}>
          <GridFour size={14} /> 网格
        </button>
        <button type="button" onClick={() => onModeChange('region')}
          style={{
            ...tabBase,
            borderBottom: mode === 'region' ? '2px solid #3b82f6' : '2px solid transparent',
            fontWeight: mode === 'region' ? 600 : 400,
            color: mode === 'region' ? '#3b82f6' : '#94a3b8',
          }}>
          <Polygon size={14} /> 区域
        </button>
      </div>

      {mode === 'grid' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>精度</span>
            <select value={gridSize} onChange={e => onGridSizeChange(parseFloat(e.target.value))}
              style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12, outline: 'none' }}>
              {GRID_SIZE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
            {estimatedCells > 0 ? `约 ${estimatedCells} 格 · 约 ${estimatedMinutes} 分钟` : '移动地图以估算范围'}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, padding: 6, background: '#f8fafc', borderRadius: 4 }}>
          请使用右上角绘制工具在地图上绘制采集区域
        </div>
      )}

      <button type="button" onClick={onStart} disabled={disabled}
        style={{
          width: '100%', padding: '8px', border: 'none', borderRadius: 6,
          fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: disabled ? '#e2e8f0' : '#3b82f6',
          color: disabled ? '#94a3b8' : '#fff',
        }}>
        <Play size={16} weight="fill" /> 开始采集
      </button>
    </div>
  );
}

export default CollectionMode;
