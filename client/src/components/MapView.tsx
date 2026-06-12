import { useEffect, useRef } from 'react';
import { Crosshair } from '@phosphor-icons/react';
import { useAmap, type DrawMode, type DrawnShape } from '../hooks/useAmap';

export type { DrawMode, DrawnShape } from '../hooks/useAmap';

interface MapViewProps {
  children?: React.ReactNode;
  onDrawReady?: (api: { setDrawMode: (mode: DrawMode) => void; clearDrawings: () => void; getDrawnShape: () => DrawnShape | null }) => void;
  onMapReady?: (getBounds: () => any) => void;
}

function MapView({ children, onDrawReady, onMapReady }: MapViewProps) {
  const { loaded, getBounds, setDrawMode, clearDrawings, getDrawnShape, locateMe } = useAmap('map-container');
  const readyRef = useRef(false);

  useEffect(() => {
    if (loaded && !readyRef.current) {
      readyRef.current = true;
      if (onDrawReady) onDrawReady({ setDrawMode, clearDrawings, getDrawnShape });
      if (onMapReady) onMapReady(getBounds);
    }
  }, [loaded, onDrawReady, onMapReady, setDrawMode, clearDrawings, getDrawnShape, getBounds]);

  return (
    <>
      <div id="map-container" style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1 }} />
      {children}
      {loaded && (
        <button
          onClick={locateMe}
          title="定位到当前位置"
          style={{
            position: 'absolute', bottom: 20, right: 20, zIndex: 10,
            width: 40, height: 40, borderRadius: '50%',
            background: '#fff', border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Crosshair size={20} color="#3b82f6" />
        </button>
      )}
    </>
  );
}

export default MapView;
