import { useEffect, useRef } from 'react';
import { Crosshair } from '@phosphor-icons/react';
import { useAmap, type DrawMode, type DrawnShape, type GridCell } from '../hooks/useAmap';

export type { DrawMode, DrawnShape, GridCell } from '../hooks/useAmap';

interface MapViewProps {
  children?: React.ReactNode;
  onMapReady?: (api: MapAPI) => void;
  onShapeChange?: (shape: DrawnShape | null) => void;
  onGridChange?: (cells: GridCell[]) => void;
}

export interface MapAPI {
  getBounds: () => any;
  setDrawMode: (mode: DrawMode) => void;
  clearDrawings: () => void;
  getDrawnShape: () => DrawnShape | null;
  splitGrid: (gridSizeMeters: number) => number;
  flyTo: (lng: number, lat: number) => void;
  drawMode: DrawMode;
  drawnShape: DrawnShape | null;
  gridCells: GridCell[];
  collectPOIsClientSide: (cells: GridCell[], categories: string[], categoryNames: Record<string, string>, gridSizeMeters: number, onCellProgress: (done: number, total: number, pois: number) => void) => Promise<any[]>;
  stopCollecting: () => void;
  showPoiMarkers: (pois: { lng: number; lat: number; name: string; category: string; address?: string; phone?: string; color: string }[]) => void;
  clearPoiMarkers: () => void;
  poiData: any[];
  isCollecting: boolean;
}

function MapView({ children, onMapReady, onShapeChange, onGridChange }: MapViewProps) {
  const amap = useAmap('map-container');
  const readyRef = useRef(false);

  useEffect(() => {
    if (amap.loaded && !readyRef.current) {
      readyRef.current = true;
      if (onMapReady) {
        onMapReady({
          flyTo: amap.flyTo,
          getBounds: amap.getBounds,
          setDrawMode: amap.setDrawMode,
          clearDrawings: amap.clearDrawings,
          getDrawnShape: amap.getDrawnShape,
          splitGrid: amap.splitGrid,
          drawMode: amap.drawMode,
          drawnShape: amap.drawnShape,
          gridCells: amap.gridCells,
          collectPOIsClientSide: amap.collectPOIsClientSide,
          stopCollecting: amap.stopCollecting,
          showPoiMarkers: amap.showPoiMarkers,
          clearPoiMarkers: amap.clearPoiMarkers,
          poiData: amap.poiData,
          isCollecting: amap.isCollecting,
        });
      }
    }
  }, [amap.loaded]);

  // Sync shape/grid changes up to App
  useEffect(() => {
    if (onShapeChange) onShapeChange(amap.drawnShape);
  }, [amap.drawnShape, onShapeChange]);

  useEffect(() => {
    if (onGridChange) onGridChange(amap.gridCells);
  }, [amap.gridCells, onGridChange]);

  return (
    <>
      <div id="map-container" style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1 }} />
      {children}
      {amap.loaded && (
        <button onClick={amap.locateMe} title="定位到当前位置"
          style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10,
            width: 40, height: 40, borderRadius: '50%', background: '#fff',
            border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Crosshair size={20} color="#3b82f6" />
        </button>
      )}
    </>
  );
}

export default MapView;
