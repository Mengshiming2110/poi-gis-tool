import { useEffect, useRef } from 'react';
import { useAmap } from '../hooks/useAmap';

export interface DrawAPI {
  startPolygon: (cb: (overlay: any) => void) => void;
  startRectangle: (cb: (overlay: any) => void) => void;
  startCircle: (cb: (overlay: any) => void) => void;
  stopDraw: () => void;
  clearDrawings: () => void;
  getDrawnRegion: () => any;
}

interface MapViewProps {
  children?: React.ReactNode;
  onDrawReady?: (api: DrawAPI) => void;
  onMapReady?: (getBounds: () => any) => void;
}

function MapView({ children, onDrawReady, onMapReady }: MapViewProps) {
  const { loaded, getBounds, startDraw, stopDraw, clearDrawings, getDrawnRegion } = useAmap('map-container');
  const readyRef = useRef(false);

  useEffect(() => {
    if (loaded && !readyRef.current) {
      readyRef.current = true;
      if (onDrawReady) {
        onDrawReady({
          startPolygon: (cb) => startDraw('polygon', cb),
          startRectangle: (cb) => startDraw('rectangle', cb),
          startCircle: (cb) => startDraw('circle', cb),
          stopDraw,
          clearDrawings,
          getDrawnRegion,
        });
      }
      if (onMapReady) onMapReady(getBounds);
    }
  }, [loaded, onDrawReady, onMapReady, startDraw, stopDraw, clearDrawings, getDrawnRegion, getBounds]);

  return (
    <>
      <div id="map-container" style={{
        position: 'absolute', top: 0, left: 0,
        width: '100vw', height: '100vh', zIndex: 1,
      }} />
      {loaded && children}
    </>
  );
}

export default MapView;
