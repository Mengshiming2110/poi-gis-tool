import { useState, useCallback } from 'react';
import { Pause, Play, Stop, Download, Clock, MapPin, CaretUp, CaretDown, ArrowsOut } from '@phosphor-icons/react';
import DataTable from './DataTable';
import type { ProgressData, TaskStatus } from '../types/poi';

interface ProgressDrawerProps {
  status: TaskStatus;
  progress: ProgressData;
  totalPois: number;
  taskId: string | null;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onExport: (format: 'xlsx' | 'geojson') => void;
}

function ProgressDrawer({ status, progress, totalPois, taskId, onPause, onResume, onCancel, onExport }: ProgressDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(40);

  const pct = progress.totalCells > 0 ? Math.round((progress.doneCells / progress.totalCells) * 100) : 0;

  const onDrag = useCallback((e: React.MouseEvent) => {
    const startY = e.clientY;
    const startH = drawerHeight;
    const onMove = (ev: MouseEvent) => {
      const newH = startH - ((ev.clientY - startY) / window.innerHeight) * 100;
      setDrawerHeight(Math.max(15, Math.min(80, newH)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [drawerHeight]);

  const handleSnap = useCallback(() => {
    setExpanded(true);
    setDrawerHeight(40);
  }, []);

  if (status === 'pending' || status === 'cancelled') return null;

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0',
    background: '#fff', fontSize: 11, cursor: 'pointer', color: '#475569',
  };

  const iconBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8',
    padding: 2,
  };

  const statusLabel = status === 'running' ? '采集中' : status === 'paused' ? '已暂停' : '已完成';
  const statusColor = status === 'running' ? '#22c55e' : status === 'paused' ? '#eab308' : '#3b82f6';
  const displayPois = totalPois || progress.totalPois;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
      background: 'rgba(255,255,255,0.98)', borderRadius: '10px 10px 0 0',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      height: expanded ? `${drawerHeight}vh` : 'auto',
      transition: 'height 0.2s',
    }}>
      {/* Drag handle */}
      <div style={{
        width: 40, height: 4, background: '#cbd5e1', borderRadius: 2,
        margin: '6px auto', cursor: 'ns-resize',
      }} onMouseDown={onDrag} onClick={() => setExpanded(!expanded)} />

      <div style={{ padding: '0 16px 10px' }}>
        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>采集进度</span>
            <span style={{ background: statusColor, color: '#fff', padding: '1px 6px', borderRadius: 8, fontSize: 9 }}>
              {statusLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" onClick={handleSnap} title="展开至40vh"
              style={iconBtnStyle}>
              <ArrowsOut size={14} />
            </button>
            <button type="button" onClick={() => setExpanded(!expanded)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 2, fontSize: 11 }}>
              {expanded ? <CaretDown size={14} /> : <CaretUp size={14} />}
              {expanded ? '收起' : '展开数据'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 6 }}>
            <div style={{ background: '#3b82f6', height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
            {progress.doneCells}/{progress.totalCells} 格
          </span>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 10, color: '#64748b' }}>
          <span><MapPin size={10} style={{ verticalAlign: -2 }} /> POI: {displayPois}</span>
          <span><Clock size={10} style={{ verticalAlign: -2 }} /> 进度: {pct}%</span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {status === 'running' && (
            <button type="button" style={btnStyle} onClick={onPause}><Pause size={14} /> 暂停</button>
          )}
          {status === 'paused' && (
            <button type="button" style={btnStyle} onClick={onResume}><Play size={14} /> 继续</button>
          )}
          {(status === 'running' || status === 'paused') && (
            <button type="button" style={{ ...btnStyle, color: '#ef4444' }} onClick={onCancel}><Stop size={14} /> 取消</button>
          )}
          {(status === 'done' || status === 'paused') && taskId && (
            <>
              <button type="button" style={btnStyle} onClick={() => onExport('xlsx')}><Download size={14} /> Excel</button>
              <button type="button" style={btnStyle} onClick={() => onExport('geojson')}><Download size={14} /> GeoJSON</button>
            </>
          )}
        </div>

        {/* DataTable — visible only when expanded */}
        {expanded && taskId && (
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 4 }}>
            <DataTable taskId={taskId} />
          </div>
        )}
      </div>
    </div>
  );
}

export default ProgressDrawer;
