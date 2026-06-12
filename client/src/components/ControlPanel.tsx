import { useState, useRef, useCallback } from 'react';
import { SlidersHorizontal } from '@phosphor-icons/react';
import CategoryPicker from './CategoryPicker';
import CollectionMode from './CollectionMode';
import type { TaskMode } from '../types/poi';
import type { DrawnShape, GridCell } from './MapView';

interface ControlPanelProps {
  selectedCategories: string[];
  onCategoriesChange: (codes: string[]) => void;
  mode: TaskMode;
  gridSize: number;
  gridSizeMeters: number;
  estimatedCells: number;
  estimatedMinutes: number;
  drawnShape: DrawnShape | null;
  gridCells: GridCell[];
  onModeChange: (mode: TaskMode) => void;
  onGridSizeChange: (size: number) => void;
  onGridSizeMetersChange: (meters: number) => void;
  onSplitGrid: () => void;
  onStart: () => void;
  disabled: boolean;
}

function ControlPanel(props: ControlPanelProps) {
  const [pos, setPos] = useState({ x: 12, y: 12 });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.startPosX + ev.clientX - dragRef.current.startX,
        y: dragRef.current.startPosY + ev.clientY - dragRef.current.startY,
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos]);

  return (
    <div style={{
      position: 'absolute', left: pos.x, top: pos.y, width: 240, zIndex: 10,
      background: 'rgba(255,255,255,0.95)', borderRadius: 10,
      boxShadow: '0 2px 12px rgba(0,0,0,0.1)', padding: 10, fontSize: 13,
    }}>
      <div onMouseDown={onMouseDown} style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        cursor: 'move', userSelect: 'none',
      }}>
        <SlidersHorizontal size={16} color="#1e293b" />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>采集控制</span>
      </div>

      <CategoryPicker selected={props.selectedCategories} onChange={props.onCategoriesChange} />

      <CollectionMode
        mode={props.mode}
        gridSize={props.gridSize}
        gridSizeMeters={props.gridSizeMeters}
        estimatedCells={props.estimatedCells}
        estimatedMinutes={props.estimatedMinutes}
        drawnShape={props.drawnShape}
        gridCells={props.gridCells}
        onModeChange={props.onModeChange}
        onGridSizeChange={props.onGridSizeChange}
        onGridSizeMetersChange={props.onGridSizeMetersChange}
        onSplitGrid={props.onSplitGrid}
        onStart={props.onStart}
        disabled={props.disabled}
      />
    </div>
  );
}

export default ControlPanel;
