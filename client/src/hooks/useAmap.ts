import { useEffect, useRef, useState, useCallback } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';

function getConfig() {
  return {
    key: localStorage.getItem('amap_js_key') || '35f0e1144644fbfba405c109db466cdc',
    securityCode: localStorage.getItem('amap_security_code') || '8d13a7d3f6ecff69f02dc1dea5855b0a',
  };
}

window._AMapSecurityConfig = {
  securityJsCode: getConfig().securityCode,
};

export function useAmap(containerId: string) {
  const mapRef = useRef<any>(null);
  const mouseToolRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
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

        // Load MouseTool plugin
        AMap.plugin('AMap.MouseTool', () => {
          mouseToolRef.current = new AMap.MouseTool(instance);
        });

        mapRef.current = instance;
        setMap(instance);
        setLoaded(true);
      })
      .catch((err: any) => {
        console.error('高德地图加载失败:', err);
      });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [containerId]);

  const getBounds = useCallback(() => {
    if (!mapRef.current) return null;
    const bounds = mapRef.current.getBounds();
    return {
      southwest: { lng: bounds.getSouthWest().lng, lat: bounds.getSouthWest().lat },
      northeast: { lng: bounds.getNorthEast().lng, lat: bounds.getNorthEast().lat },
    };
  }, []);

  const startDraw = useCallback((type: 'polygon' | 'rectangle' | 'circle', onComplete: (overlay: any) => void) => {
    const mt = mouseToolRef.current;
    if (!mt) return;
    mt.on('draw', (event: any) => {
      overlaysRef.current.push(event.obj);
      onComplete(event.obj);
    });
    switch (type) {
      case 'polygon': mt.polygon(); break;
      case 'rectangle': mt.rectangle(); break;
      case 'circle': mt.circle(); break;
    }
  }, []);

  const stopDraw = useCallback(() => {
    mouseToolRef.current?.close();
    mouseToolRef.current?.clearEvents?.('draw');
  }, []);

  const clearDrawings = useCallback(() => {
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
  }, []);

  const getDrawnRegion = useCallback(() => {
    return overlaysRef.current.length > 0 ? overlaysRef.current[overlaysRef.current.length - 1] : null;
  }, []);

  return { map, loaded, getBounds, startDraw, stopDraw, clearDrawings, getDrawnRegion };
}
