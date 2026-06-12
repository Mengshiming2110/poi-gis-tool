import { useAmap } from '../hooks/useAmap';

interface MapViewProps {
  children?: React.ReactNode;
}

function MapView({ children }: MapViewProps) {
  const { loaded } = useAmap('map-container');

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
