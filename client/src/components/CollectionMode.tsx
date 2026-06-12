import { Play, GridFour, Polygon, SquaresFour } from '@phosphor-icons/react';
import { GRID_SIZE_OPTIONS, type TaskMode } from '../types/poi';
import type { DrawnShape, GridCell } from './MapView';

interface CollectionModeProps {
  mode: TaskMode;
  gridSize: number;
  gridSizeMeters: number;
  estimatedCells: number;
  estimatedMinutes: number;
  drawnShape: DrawnShape | null;
  gridCells: GridCell[];
  categoriesCount: number;
  onModeChange: (mode: TaskMode) => void;
  onGridSizeChange: (size: number) => void;
  onGridSizeMetersChange: (meters: number) => void;
  onSplitGrid: () => void;
  onStart: () => void;
  disabled: boolean;
}

function CollectionMode({
  mode, gridSize, gridSizeMeters, estimatedCells, estimatedMinutes,
  drawnShape, gridCells, categoriesCount,
  onModeChange, onGridSizeChange, onGridSizeMetersChange,
  onSplitGrid, onStart, disabled,
}: CollectionModeProps) {
  const tabBase: React.CSSProperties = {
    flex: 1, textAlign: 'center', padding: '6px 0',
    cursor: 'pointer', fontSize: 12, background: 'none', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  };

  const startBtnStyle: React.CSSProperties = {
    width: '100%', padding: '8px', border: 'none', borderRadius: 6,
    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: disabled ? '#e2e8f0' : '#3b82f6',
    color: disabled ? '#94a3b8' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  const splitBtnStyle: React.CSSProperties = {
    width: '100%', padding: '7px', border: 'none', borderRadius: 6,
    fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: drawnShape ? '#f59e0b' : '#e2e8f0',
    color: drawnShape ? '#fff' : '#94a3b8',
    cursor: drawnShape ? 'pointer' : 'not-allowed',
    marginBottom: 6,
  };

  const inputRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
  };

  const inputStyle: React.CSSProperties = {
    width: 80, padding: '5px 8px', border: '1px solid #e2e8f0',
    borderRadius: 4, fontSize: 12, textAlign: 'center', fontFamily: 'monospace', outline: 'none',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 10, color: '#94a3b8', marginTop: 2,
  };

  const statusBadgeStyle = (ok: boolean): React.CSSProperties => ({
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: ok ? '#22c55e' : '#e2e8f0', marginRight: 4, verticalAlign: 'middle',
  });

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
          <div style={inputRow}>
            <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>精度</span>
            <select value={gridSize} onChange={e => onGridSizeChange(parseFloat(e.target.value))}
              style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12, outline: 'none' }}>
              {GRID_SIZE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
            {estimatedCells > 0 ? `约 ${estimatedCells} 格 · 约 ${estimatedMinutes} 分钟` : '移动地图以估算范围'}
          </div>
          <button type="button" onClick={onStart} disabled={disabled} style={startBtnStyle}>
            <Play size={16} weight="fill" /> 开始采集
          </button>
          {disabled && categoriesCount === 0 && (
            <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4, textAlign: 'center' }}>
              请先选择 POI 类别
            </div>
          )}
        </>
      ) : (
        <>
          {/* Step 1: Draw status */}
          <div style={{ marginBottom: 8, fontSize: 11, padding: 6, background: '#f8fafc', borderRadius: 4 }}>
            <div style={{ marginBottom: 2, fontWeight: 600, color: '#475569' }}>
              <span style={statusBadgeStyle(!!drawnShape)} /> 绘制区域
            </div>
            {drawnShape ? (
              <span style={{ color: '#22c55e' }}>
                已绘制（{drawnShape.type === 'polygon' ? '多边形' : drawnShape.type === 'rectangle' ? '矩形' : '圆形'}）
              </span>
            ) : (
              <span style={{ color: '#94a3b8' }}>使用右上角工具在地图上绘制</span>
            )}
          </div>

          {/* Step 2: Grid split */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 4, fontWeight: 600, color: '#475569', fontSize: 11 }}>
              <span style={statusBadgeStyle(gridCells.length > 0)} /> 网格切分
            </div>
            <div style={inputRow}>
              <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>精度</span>
              <input type="number" value={gridSizeMeters} min={50} max={2000} step={50}
                onChange={e => onGridSizeMetersChange(Number(e.target.value))}
                style={inputStyle} />
              <span style={{ fontSize: 11, color: '#999' }}>米</span>
            </div>
            <button type="button" onClick={onSplitGrid} disabled={!drawnShape} style={splitBtnStyle}>
              <SquaresFour size={14} /> 执行网格切分
            </button>
            {gridCells.length > 0 && (
              <div style={hintStyle}>已切分 {gridCells.length} 个网格单元</div>
            )}
          </div>

          {/* Step 3: Collect */}
          <button type="button" onClick={onStart} disabled={disabled} style={startBtnStyle}>
            <Play size={16} weight="fill" /> 开始采集
          </button>
          {disabled && (
            <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4, textAlign: 'center' }}>
              {categoriesCount === 0 ? '请先选择 POI 类别'
                : !drawnShape ? '请先在地图上绘制区域'
                : gridCells.length === 0 ? '请先执行网格切分'
                : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CollectionMode;
