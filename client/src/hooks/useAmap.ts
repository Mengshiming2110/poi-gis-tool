import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';

const AMAP_KEY = '35f0e1144644fbfba405c109db466cdc';
const AMAP_SECURITY_CODE = '8d13a7d3f6ecff69f02dc1dea5855b0a';
const AMAP_VERSION = '2.0';

// 高德 JS API 2.0 安全密钥配置
window._AMapSecurityConfig = {
  securityJsCode: AMAP_SECURITY_CODE,
};

export function useAmap(containerId: string) {
  const mapRef = useRef<any>(null);
  const [map, setMap] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let destroyed = false;

    AMapLoader.load({
      key: AMAP_KEY,
      version: AMAP_VERSION,
    })
      .then((AMap: any) => {
        if (destroyed) return;

        const instance = new AMap.Map(containerId, {
          zoom: 12,
          center: [116.397428, 39.90923],
          viewMode: '2D',
          resizeEnable: true,
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

  const getBounds = () => {
    if (!map) return null;
    const bounds = map.getBounds();
    return {
      southwest: { lng: bounds.getSouthWest().lng, lat: bounds.getSouthWest().lat },
      northeast: { lng: bounds.getNorthEast().lng, lat: bounds.getNorthEast().lat },
    };
  };

  return { map, loaded, getBounds };
}
