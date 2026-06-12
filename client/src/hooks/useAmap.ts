import { useEffect, useRef, useState, useCallback } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';

function getConfig() {
  return {
    key: localStorage.getItem('amap_js_key') || '35f0e1144644fbfba405c109db466cdc',
    securityCode: localStorage.getItem('amap_security_code') || '8d13a7d3f6ecff69f02dc1dea5855b0a',
  };
}

window._AMapSecurityConfig = { securityJsCode: getConfig().securityCode };

export type DrawMode = 'polygon' | 'rectangle' | 'circle' | null;

export interface DrawnShape {
  type: 'polygon' | 'rectangle' | 'circle';
  geometry: any;       // polygon: [lng,lat][] | rectangle: {bounds: [[lng,lat],[lng,lat]], path: [lng,lat][]} | circle: {center: [lng,lat], radius: number}
  overlay: any;        // AMap.Polygon | AMap.Rectangle | AMap.Circle
}

export function useAmap(containerId: string) {
  const mapRef = useRef<any>(null);
  const mouseToolRef = useRef<any>(null);
  const drawnShapeRef = useRef<DrawnShape | null>(null);
  const currentDrawModeRef = useRef<DrawMode>(null);
  const [map, setMap] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let destroyed = false;
    const { key, securityCode } = getConfig();
    window._AMapSecurityConfig = { securityJsCode: securityCode };

    AMapLoader.load({ key, version: '2.0' })
      .then((AMap: any) => {
        if (destroyed) return;

        const instance = new AMap.Map(containerId, {
          zoom: 12,
          center: [116.397428, 39.90923],
          viewMode: '2D',
          resizeEnable: true,
        });

        // MouseTool
        const mouseTool = new AMap.MouseTool(instance);
        mouseToolRef.current = mouseTool;

        mouseTool.on('draw', (event: any) => {
          const { obj } = event;
          const mode = currentDrawModeRef.current;
          let shapeInfo: DrawnShape | null = null;

          if (mode === 'polygon' && obj instanceof AMap.Polygon) {
            const path = obj.getPath().map((p: any) => [p.lng, p.lat]);
            shapeInfo = { type: 'polygon', geometry: path, overlay: obj };
          } else if (mode === 'rectangle' && obj instanceof AMap.Rectangle) {
            const bounds = obj.getBounds();
            const sw = [bounds.getSouthWest().lng, bounds.getSouthWest().lat];
            const ne = [bounds.getNorthEast().lng, bounds.getNorthEast().lat];
            const rectPath = [sw, [ne[0], sw[1]], ne, [sw[0], ne[1]]];
            shapeInfo = { type: 'rectangle', geometry: { bounds: [sw, ne], path: rectPath }, overlay: obj };
          } else if (mode === 'circle' && obj instanceof AMap.Circle) {
            const center = obj.getCenter();
            const radius = obj.getRadius();
            shapeInfo = { type: 'circle', geometry: { center: [center.lng, center.lat], radius }, overlay: obj };
          }

          if (shapeInfo) {
            // Remove old shape
            if (drawnShapeRef.current?.overlay) {
              try { instance.remove(drawnShapeRef.current.overlay); } catch (e) {}
            }
            drawnShapeRef.current = shapeInfo;
          }
          mouseTool.close(true);
        });

        mapRef.current = instance;
        setMap(instance);
        setLoaded(true);
      })
      .catch((err: any) => console.error('高德地图加载失败:', err));

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [containerId]);

  // Switch draw mode — close & reopen with style options
  const setDrawMode = useCallback((mode: DrawMode) => {
    const mt = mouseToolRef.current;
    if (!mt) return;

    mt.close(true);
    currentDrawModeRef.current = mode;

    if (!mode) return;

    const styleOpts = {
      strokeWeight: 3,
      strokeOpacity: 0.8,
      fillOpacity: 0.15,
      strokeStyle: 'dashed',
    };

    if (mode === 'polygon') {
      mt.polygon({ ...styleOpts, strokeColor: '#4A90D9', fillColor: '#4A90D9' });
    } else if (mode === 'rectangle') {
      mt.rectangle({ ...styleOpts, strokeColor: '#27AE60', fillColor: '#27AE60' });
    } else if (mode === 'circle') {
      mt.circle({ ...styleOpts, strokeColor: '#F39C12', fillColor: '#F39C12' });
    }
  }, []);

  const getBounds = useCallback(() => {
    if (!mapRef.current) return null;
    const bounds = mapRef.current.getBounds();
    return {
      southwest: { lng: bounds.getSouthWest().lng, lat: bounds.getSouthWest().lat },
      northeast: { lng: bounds.getNorthEast().lng, lat: bounds.getNorthEast().lat },
    };
  }, []);

  const clearDrawings = useCallback(() => {
    if (drawnShapeRef.current?.overlay && mapRef.current) {
      try { mapRef.current.remove(drawnShapeRef.current.overlay); } catch (e) {}
    }
    drawnShapeRef.current = null;
  }, []);

  const getDrawnShape = useCallback((): DrawnShape | null => {
    return drawnShapeRef.current;
  }, []);

  const locateMe = useCallback(() => {
    if (!mapRef.current) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current.setZoomAndCenter(15, [pos.coords.longitude, pos.coords.latitude]);
      },
      () => {
        if (window.AMap) {
          window.AMap.plugin('AMap.Geolocation', () => {
            const geolocation = new window.AMap.Geolocation({ enableHighAccuracy: true });
            geolocation.getCurrentPosition((status: string, result: any) => {
              if (status === 'complete') {
                mapRef.current.setZoomAndCenter(15, [result.position.lng, result.position.lat]);
              }
            });
          });
        }
      },
      { timeout: 5000, enableHighAccuracy: true },
    );
  }, []);

  return { map, loaded, getBounds, setDrawMode, clearDrawings, getDrawnShape, locateMe };
}
