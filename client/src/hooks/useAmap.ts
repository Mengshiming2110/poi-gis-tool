import { useEffect, useRef, useState, useCallback } from 'react';

export type DrawMode = 'polygon' | 'rectangle' | 'circle' | null;

export interface DrawnShape {
  type: 'polygon' | 'rectangle' | 'circle';
  geometry: any;
  overlay: any;
}

export interface GridCell {
  sw: [number, number];
  ne: [number, number];
  center: [number, number];
  bounds: [[number, number], [number, number]];
}

interface CachedPoiResult {
  pois: any[];
  total: number;
  savedAt: number;
}

// Config from localStorage, fallback to defaults
function getConfig() {
  // Migrate old wsKey → restKey if needed
  const oldWsKey = localStorage.getItem('amap_ws_key');
  if (oldWsKey && !localStorage.getItem('amap_rest_key')) {
    localStorage.setItem('amap_rest_key', oldWsKey);
  }

  return {
    jsKey: localStorage.getItem('amap_js_key') || '35f0e1144644fbfba405c109db466cdc',
    securityCode: localStorage.getItem('amap_security_code') || '8d13a7d3f6ecff69f02dc1dea5855b0a',
  };
}

export function useAmap(containerId: string) {
  const mapRef = useRef<any>(null);
  const mouseToolRef = useRef<any>(null);
  const placeSearchRef = useRef<any>(null);
  const drawnShapeRef = useRef<DrawnShape | null>(null);
  const gridOverlaysRef = useRef<any[]>([]);
  const poiMarkersRef = useRef<any[]>([]);
  const [map, setMap] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [drawMode, setDrawModeState] = useState<DrawMode>(null);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [poiData, setPoiData] = useState<any[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const collectingRef = useRef(false);

  // Custom two-tap drawing state (replaces MouseTool for rect/circle on touch devices)
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
  const customDrawRef = useRef<{
    phase: 'idle' | 'first-point';
    firstPoint: [number, number] | null;
    anchorMarker: any;
    clickHandler: ((e: any) => void) | null;
  }>({
    phase: 'idle',
    firstPoint: null,
    anchorMarker: null,
    clickHandler: null,
  });

  const cleanupCustomDraw = useCallback(() => {
    const cd = customDrawRef.current;
    const inst = mapRef.current;
    if (cd.anchorMarker && inst) {
      try { inst.remove(cd.anchorMarker); } catch (e) {}
    }
    if (cd.clickHandler && inst) {
      inst.off('click', cd.clickHandler);
    }
    cd.phase = 'idle';
    cd.firstPoint = null;
    cd.anchorMarker = null;
    cd.clickHandler = null;
  }, []);

  // Poll until window.AMap is available, then init
  useEffect(() => {
    let destroyed = false;
    let checkCount = 0;

    function tryInit() {
      if (destroyed) return;

      if (window.AMap) {
        const AMap = window.AMap;
        const instance = new AMap.Map(containerId, {
          zoom: 12,
          center: [116.397428, 39.90923], // fallback
          viewMode: '2D',
          resizeEnable: true,
        });

        if (!containerId.includes('mobile')) {
          // Only keep scale bar; zoom/locate handled by app UI
        }

        const mouseTool = new AMap.MouseTool(instance);
        mouseToolRef.current = mouseTool;

        mouseTool.on('draw', (event: any) => {
          const { obj } = event;
          let shapeInfo: DrawnShape | null = null;

          if (obj instanceof AMap.Polygon) {
            const path = obj.getPath().map((p: any) => [p.lng, p.lat]);
            shapeInfo = { type: 'polygon', geometry: path, overlay: obj };
          } else if (obj instanceof AMap.Rectangle) {
            const bounds = obj.getBounds();
            const sw: [number, number] = [bounds.getSouthWest().lng, bounds.getSouthWest().lat];
            const ne: [number, number] = [bounds.getNorthEast().lng, bounds.getNorthEast().lat];
            const rectPath: [number, number][] = [sw, [ne[0], sw[1]], ne, [sw[0], ne[1]]];
            shapeInfo = { type: 'rectangle', geometry: { path: rectPath, bounds: [sw, ne] }, overlay: obj };
          } else if (obj instanceof AMap.Circle) {
            const center = obj.getCenter();
            const radius = obj.getRadius();
            shapeInfo = { type: 'circle', geometry: { center: [center.lng, center.lat], radius }, overlay: obj };
          }

          if (shapeInfo) {
            // Remove old shape
            if (drawnShapeRef.current?.overlay) {
              try { instance.remove(drawnShapeRef.current.overlay); } catch (e) {}
            }
            // Clear old grids
            gridOverlaysRef.current.forEach(o => { try { instance.remove(o); } catch (e) {} });
            gridOverlaysRef.current = [];

            drawnShapeRef.current = shapeInfo;
            setDrawnShape(shapeInfo);
            setGridCells([]);
          }
          mouseTool.close(true);
          // Re-enable map drag after drawing completes
          instance.setStatus({ dragEnable: true });
        });

        const placeSearch = new AMap.PlaceSearch({ pageSize: 25, pageIndex: 1 });
        placeSearchRef.current = placeSearch;

        mapRef.current = instance;
        setMap(instance);
        setLoaded(true);

        // Auto-locate on first load (delay for map init)
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setTimeout(() => {
                try { instance.setZoomAndCenter(15, [pos.coords.longitude, pos.coords.latitude]); } catch (e) {}
              }, 300);
            },
            () => {},
            { timeout: 5000, enableHighAccuracy: true }
          );
        }
        return;
      }

      checkCount++;
      if (checkCount < 50) { // max ~25 seconds
        setTimeout(tryInit, 500);
      }
    }

    tryInit();

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [containerId]);

  // Draw mode switching via useEffect (like reference)
  const setDrawMode = useCallback((mode: DrawMode) => {
    setDrawModeState(mode);
  }, []);

  // Toggle map drag when draw mode changes (prevents conflict on mobile)
  useEffect(() => {
    const mt = mouseToolRef.current;
    const mapInstance = mapRef.current;
    if (!mapInstance) return;

    // Clean up any custom two-tap draw in progress
    cleanupCustomDraw();
    if (mt) mt.close(true);

    if (!drawMode) {
      mapInstance.setStatus({ dragEnable: true });
      return;
    }

    // Disable map dragging while in draw mode (critical for mobile)
    mapInstance.setStatus({ dragEnable: false });

    if (drawMode === 'polygon') {
      // Polygon: always use MouseTool (tap-to-add-points works on touch)
      if (!mt) return;
      mt.polygon({
        strokeColor: '#4A90D9', fillColor: '#4A90D9',
        strokeWeight: 3, strokeOpacity: 0.8, fillOpacity: 0.15, strokeStyle: 'dashed',
      });
      return;
    }

    // Rectangle / Circle on touch devices → custom two-tap drawing
    // On mouse devices → keep MouseTool drag-to-draw
    if (!isTouchDevice) {
      if (!mt) return;
      if (drawMode === 'rectangle') {
        mt.rectangle({
          strokeColor: '#27AE60', fillColor: '#27AE60',
          strokeWeight: 3, strokeOpacity: 0.8, fillOpacity: 0.15, strokeStyle: 'dashed',
        });
      } else {
        mt.circle({
          strokeColor: '#F39C12', fillColor: '#F39C12',
          strokeWeight: 3, strokeOpacity: 0.8, fillOpacity: 0.15, strokeStyle: 'dashed',
        });
      }
      return;
    }

    // --- Touch: two-tap custom drawing ---
    const AMap = window.AMap;
    const cd = customDrawRef.current;

    const onClick = (e: any) => {
      const point: [number, number] = [e.lnglat.lng, e.lnglat.lat];

      if (cd.phase === 'idle') {
        // Tap 1: place anchor marker
        cd.phase = 'first-point';
        cd.firstPoint = point;
        const marker = new AMap.Marker({
          position: e.lnglat,
          anchor: 'center',
          content: `<div style="
            width:16px;height:16px;
            background:${drawMode === 'rectangle' ? '#27AE60' : '#F39C12'};
            border:3px solid #fff;border-radius:50%;
            box-shadow:0 2px 6px rgba(0,0,0,0.5);
            animation:pulse 0.8s infinite;
          "></div>`,
        });
        marker.setMap(mapInstance);
        cd.anchorMarker = marker;
        return;
      }

      // Tap 2: create shape from anchor → tap point
      const first = cd.firstPoint!;
      let shapeInfo: DrawnShape | null = null;

      if (drawMode === 'rectangle') {
        const sw: [number, number] = [Math.min(first[0], point[0]), Math.min(first[1], point[1])];
        const ne: [number, number] = [Math.max(first[0], point[0]), Math.max(first[1], point[1])];
        const rectPath: [number, number][] = [sw, [ne[0], sw[1]], ne, [sw[0], ne[1]]];
        const rect = new AMap.Rectangle({
          bounds: new AMap.Bounds(new AMap.LngLat(sw[0], sw[1]), new AMap.LngLat(ne[0], ne[1])),
          strokeColor: '#27AE60', fillColor: '#27AE60',
          strokeWeight: 3, strokeOpacity: 0.8, fillOpacity: 0.15, strokeStyle: 'dashed',
        });
        rect.setMap(mapInstance);
        shapeInfo = { type: 'rectangle', geometry: { path: rectPath, bounds: [sw, ne] }, overlay: rect };
      } else {
        // circle: anchor = center, tap = edge point → radius
        const latDiff = (point[1] - first[1]) * 111320;
        const lngDiff = (point[0] - first[0]) * 111320 * Math.cos((first[1] * Math.PI) / 180);
        const radius = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        const circle = new AMap.Circle({
          center: new AMap.LngLat(first[0], first[1]),
          radius,
          strokeColor: '#F39C12', fillColor: '#F39C12',
          strokeWeight: 3, strokeOpacity: 0.8, fillOpacity: 0.15, strokeStyle: 'dashed',
        });
        circle.setMap(mapInstance);
        shapeInfo = { type: 'circle', geometry: { center: first, radius }, overlay: circle };
      }

      // Clean up old shape
      if (drawnShapeRef.current?.overlay) {
        try { mapInstance.remove(drawnShapeRef.current.overlay); } catch (e) {}
      }
      gridOverlaysRef.current.forEach(o => { try { mapInstance.remove(o); } catch (e) {} });
      gridOverlaysRef.current = [];
      drawnShapeRef.current = shapeInfo;
      setDrawnShape(shapeInfo);
      setGridCells([]);

      // Clean up custom draw state & restore drag
      cleanupCustomDraw();
      mapInstance.setStatus({ dragEnable: true });
      setDrawModeState(null); // auto-exit draw mode
    };

    cd.clickHandler = onClick;
    mapInstance.on('click', onClick);
  }, [drawMode, cleanupCustomDraw]);

  const getBounds = useCallback(() => {
    if (!mapRef.current) return null;
    const bounds = mapRef.current.getBounds();
    return {
      southwest: { lng: bounds.getSouthWest().lng, lat: bounds.getSouthWest().lat },
      northeast: { lng: bounds.getNorthEast().lng, lat: bounds.getNorthEast().lat },
    };
  }, []);

  const clearDrawings = useCallback(() => {
    // Clean up custom two-tap drawing if in progress
    cleanupCustomDraw();
    if (drawnShapeRef.current?.overlay && mapRef.current) {
      try { mapRef.current.remove(drawnShapeRef.current.overlay); } catch (e) {}
    }
    gridOverlaysRef.current.forEach(o => { try { mapRef.current?.remove(o); } catch (e) {} });
    gridOverlaysRef.current = [];
    drawnShapeRef.current = null;
    setDrawnShape(null);
    setGridCells([]);
    setDrawModeState(null);
    mapRef.current?.setStatus({ dragEnable: true });
  }, [cleanupCustomDraw]);

  const getDrawnShape = useCallback((): DrawnShape | null => {
    return drawnShapeRef.current;
  }, []);

  // Grid split function (reference-style)
  const splitGrid = useCallback((gridSizeMeters: number) => {
    const shape = drawnShapeRef.current;
    const instance = mapRef.current;
    if (!shape || !instance) return 0;

    // Clear old grids
    gridOverlaysRef.current.forEach(o => { try { instance.remove(o); } catch (e) {} });
    gridOverlaysRef.current = [];

    let bounds: [[number, number], [number, number]];
    let filterFn: (cell: GridCell) => boolean;

    if (shape.type === 'polygon') {
      const lngs = shape.geometry.map((p: number[]) => p[0]);
      const lats = shape.geometry.map((p: number[]) => p[1]);
      bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
      filterFn = (cell) => pointInPolygon(cell.center, shape.geometry);
    } else if (shape.type === 'rectangle') {
      bounds = shape.geometry.bounds;
      filterFn = (cell) => pointInPolygon(cell.center, shape.geometry.path);
    } else {
      const [clng, clat] = shape.geometry.center;
      const r = shape.geometry.radius;
      const latDeg = r / 111320;
      const lngDeg = r / (111320 * Math.cos((clat * Math.PI) / 180));
      bounds = [[clng - lngDeg, clat - latDeg], [clng + lngDeg, clat + latDeg]];
      filterFn = (cell) => pointInCircle(cell.center, shape.geometry.center, r);
    }

    const cells = generateGridCells(bounds, gridSizeMeters);
    const validCells = cells.filter(filterFn);

    // Draw grid on map
    const AMap = window.AMap;
    const newOverlays: any[] = [];
    validCells.forEach(cell => {
      const rect = new AMap.Rectangle({
        bounds: new AMap.Bounds(
          new AMap.LngLat(cell.sw[0], cell.sw[1]),
          new AMap.LngLat(cell.ne[0], cell.ne[1])
        ),
        strokeColor: '#888',
        strokeWeight: 1,
        strokeOpacity: 0.5,
        fillColor: '#4A90D9',
        fillOpacity: 0.06,
        strokeStyle: 'solid',
      });
      rect.setMap(instance);
      newOverlays.push(rect);
    });
    gridOverlaysRef.current = newOverlays;
    setGridCells(validCells);
    return validCells.length;
  }, []);

  const locateMe = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!mapRef.current) { resolve(false); return; }
      if (!navigator.geolocation) {
        console.warn('[Locate] 浏览器不支持定位');
        resolve(false);
        return;
      }
      // Try high-accuracy first, fall back to low-accuracy
      const tryLocate = (highAccuracy: boolean) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            try {
              mapRef.current.setZoomAndCenter(17, [pos.coords.longitude, pos.coords.latitude]);
              resolve(true);
            } catch (e) {
              resolve(false);
            }
          },
          (err) => {
            console.warn(`[Locate] 定位失败 (highAccuracy=${highAccuracy}):`, err.message);
            resolve(false);
          },
          { timeout: 8000, enableHighAccuracy: highAccuracy },
        );
      };
      tryLocate(true);
    });
  }, []);

  // Client-side POI collection using AMap REST API (reliable on both mobile + desktop)
  const collectPOIsClientSide = useCallback(async (
    cells: GridCell[],
    categories: string[],
    categoryNames: Record<string, string>,
    gridSizeMeters: number,
    onCellProgress: (done: number, total: number, pois: number) => void,
  ): Promise<any[]> => {
    if (cells.length === 0) return [];

    const REST_KEY = (localStorage.getItem('amap_rest_key') || '').trim();
    const PAGE_SIZE = 25;
    const REQUEST_DELAY_MS = 500;
    const MAX_PAGES_PER_QUERY = Number(localStorage.getItem('amap_max_pages_per_query') || '2');
    const DENSE_SPLIT_THRESHOLD = Number(localStorage.getItem('amap_dense_split_threshold') || '80');
    const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

    setIsCollecting(true);
    collectingRef.current = true;
    setPoiData([]);
    const allPois: any[] = [];
    const seen = new Set<string>();
    const totalTasks = cells.length * categories.length;
    let done = 0;
    let firstError: string | null = null;

    if (!REST_KEY) {
      setPoiData([]);
      setIsCollecting(false);
      collectingRef.current = false;
      throw new Error('请先在设置中配置高德 Web 服务 Key，再开始采集');
    }

    const quotaBlocked = getQuotaBlockMessage(REST_KEY);
    if (quotaBlocked) {
      setPoiData([]);
      setIsCollecting(false);
      collectingRef.current = false;
      throw new Error(quotaBlocked);
    }

    outer:
    for (const cell of cells) {
      if (!collectingRef.current) break;
      for (const catCode of categories) {
        if (!collectingRef.current) break;
        try {
          const radius = Math.max(gridSizeMeters * 0.75, 150);
          const cacheKey = buildPoiCacheKey(catCode, cell.center, radius);
          const cached = readPoiCache(cacheKey, CACHE_TTL_MS);

          if (cached) {
            mergePois(allPois, seen, cached.pois, categoryNames[catCode] || catCode);
          } else {
            const collectedForQuery: any[] = [];

            // Fetch page 1 as a probe. Only fetch more when density suggests it is worth it.
            const { pois: page1, total: count } = await fetchAmapPOIs(
              REST_KEY, cell.center, radius, catCode, 1, PAGE_SIZE,
            );
            await delay(REQUEST_DELAY_MS);
            collectedForQuery.push(...page1);

            if (count > DENSE_SPLIT_THRESHOLD && gridSizeMeters >= 300) {
              const subCells = splitCell(cell);
              for (const subCell of subCells) {
                if (!collectingRef.current) break;
                const subRadius = Math.max(gridSizeMeters * 0.35, 120);
                const subCacheKey = buildPoiCacheKey(catCode, subCell.center, subRadius);
                const subCached = readPoiCache(subCacheKey, CACHE_TTL_MS);
                if (subCached) {
                  collectedForQuery.push(...subCached.pois);
                  continue;
                }
                const { pois: subPois, total: subTotal } = await fetchAmapPOIs(
                  REST_KEY, subCell.center, subRadius, catCode, 1, PAGE_SIZE,
                );
                await delay(REQUEST_DELAY_MS);
                collectedForQuery.push(...subPois);
                writePoiCache(subCacheKey, { pois: subPois, total: subTotal, savedAt: Date.now() });
              }
            } else {
              const pages = Math.ceil(count / PAGE_SIZE);
              for (let p = 2; p <= Math.min(pages, MAX_PAGES_PER_QUERY); p++) {
                if (!collectingRef.current) break;
                const { pois: pagePois } = await fetchAmapPOIs(
                  REST_KEY, cell.center, radius, catCode, p, PAGE_SIZE,
                );
                await delay(REQUEST_DELAY_MS);
                collectedForQuery.push(...pagePois);
              }
            }

            writePoiCache(cacheKey, { pois: collectedForQuery, total: count, savedAt: Date.now() });
            mergePois(allPois, seen, collectedForQuery, categoryNames[catCode] || catCode);
          }
        } catch (e: any) {
          console.warn('[REST] 搜索出错:', e);
          const message = e?.message || String(e);
          if (!firstError) firstError = message;
          if (isFatalAmapError(message)) {
            rememberQuotaBlock(message, REST_KEY);
            done++;
            onCellProgress(done, totalTasks, allPois.length);
            break outer;
          }
        }
        done++;
        onCellProgress(done, totalTasks, allPois.length);
        await delay(REQUEST_DELAY_MS);
      }
    }

    setPoiData(allPois);
    setIsCollecting(false);
    collectingRef.current = false;
    console.log(`[Client] 采集完成: ${allPois.length} 条POI`);

    // If all searches failed, throw so the UI can show the error
    if (allPois.length === 0 && firstError) {
      throw new Error(firstError);
    }
    return allPois;
  }, []);

  const stopCollecting = useCallback(() => {
    collectingRef.current = false;
    setIsCollecting(false);
  }, []);

  return { map, loaded, getBounds, setDrawMode, clearDrawings, getDrawnShape, splitGrid,
           drawMode, drawnShape, gridCells, locateMe, collectPOIsClientSide, stopCollecting,
           poiData, isCollecting };
}

function mergePois(target: any[], seen: Set<string>, pois: any[], category: string) {
  pois.forEach((poi: any) => {
    const key = poi.id || `${poi.name}_${poi.lng?.toFixed(5)}_${poi.lat?.toFixed(5)}`;
    if (!seen.has(key)) {
      seen.add(key);
      target.push({ ...poi, category });
    }
  });
}

// --- Geometry helpers ---
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInCircle(point: [number, number], center: [number, number], radiusMeters: number): boolean {
  const [px, py] = point;
  const [cx, cy] = center;
  const latDiff = (py - cy) * 111320;
  const lngDiff = (px - cx) * 111320 * Math.cos((cy * Math.PI) / 180);
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) <= radiusMeters;
}

// Fetch POIs from AMap REST API v3 (works in WebView where PlaceSearch JSONP may not)
async function fetchAmapPOIs(
  key: string, center: [number, number], radius: number,
  category: string, page: number, pageSize: number,
): Promise<{ pois: any[]; total: number }> {
  const params = new URLSearchParams({
    key,
    location: `${center[0]},${center[1]}`,
    radius: String(Math.round(radius)),
    types: category,
    offset: String(pageSize),
    page: String(page),
  });
  const url = `https://restapi.amap.com/v3/place/around?${params}`;
  console.log(`[REST] 请求: page=${page} cat=${category} center=${center[0].toFixed(5)},${center[1].toFixed(5)} r=${Math.round(radius)}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  console.log(`[REST] 响应: status=${data.status} count=${data.count} infocode=${data.infocode} info=${data.info}`);

  if (data.status !== '1') {
    throw new Error(formatAmapError(data.info, data.infocode));
  }

  const pois = (data.pois || []).map((p: any) => {
    const [lng, lat] = (p.location || ',').split(',').map(Number);
    return {
      id: p.id || '',
      name: p.name || '未知',
      subcategory: p.type?.split(';')[0] || '',
      address: p.address || '',
      lng: lng || center[0],
      lat: lat || center[1],
      phone: p.tel || '',
    };
  });

  return { pois, total: parseInt(data.count) || 0 };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatAmapError(info?: string, infocode?: string): string {
  const code = infocode || 'UNKNOWN';
  if (info === 'USER_DAILY_QUERY_OVER_LIMIT' || code === '10044') {
    return `高德 Web服务 Key 今日配额已用完 [${code}]`;
  }
  if (info === 'USERKEY_PLAT_NOMATCH' || code === '10009') {
    return `高德 Key 类型不匹配，请使用绑定“Web服务”的 Key [${code}]`;
  }
  if (info === 'INVALID_USER_KEY' || code === '10001') {
    return `高德 Key 无效 [${code}]`;
  }
  return `${info || '高德API错误'} [${code}]`;
}

function isFatalAmapError(message: string): boolean {
  return message.includes('配额已用完') ||
    message.includes('Key 类型不匹配') ||
    message.includes('Key 无效') ||
    message.includes('10044') ||
    message.includes('10009') ||
    message.includes('10001');
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getQuotaBlockMessage(currentKey: string): string | null {
  const blockedDay = localStorage.getItem('amap_quota_block_day');
  const blockedKey = localStorage.getItem('amap_quota_block_key');
  const message = localStorage.getItem('amap_quota_block_message');
  if (blockedDay === getTodayKey() && blockedKey === currentKey) {
    return message || '高德 Web服务 Key 今日配额已用完，请明天再采集或更换 Web服务 Key';
  }
  return null;
}

function rememberQuotaBlock(message: string, key: string) {
  if (!message.includes('配额已用完') && !message.includes('10044')) return;
  localStorage.setItem('amap_quota_block_day', getTodayKey());
  localStorage.setItem('amap_quota_block_key', key);
  localStorage.setItem('amap_quota_block_message', message);
}

function buildPoiCacheKey(category: string, center: [number, number], radius: number): string {
  const lng = center[0].toFixed(5);
  const lat = center[1].toFixed(5);
  return `poi-cache:v1:${category}:${lng}:${lat}:${Math.round(radius)}`;
}

function readPoiCache(key: string, ttlMs: number): CachedPoiResult | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPoiResult;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writePoiCache(key: string, value: CachedPoiResult) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Mobile WebView storage can fill up; cache is an optimization, not required data.
  }
}

function splitCell(cell: GridCell): GridCell[] {
  const midLng = (cell.sw[0] + cell.ne[0]) / 2;
  const midLat = (cell.sw[1] + cell.ne[1]) / 2;
  const ranges: Array<[[number, number], [number, number]]> = [
    [cell.sw, [midLng, midLat]],
    [[midLng, cell.sw[1]], [cell.ne[0], midLat]],
    [[cell.sw[0], midLat], [midLng, cell.ne[1]]],
    [[midLng, midLat], cell.ne],
  ];

  return ranges.map(([sw, ne]) => ({
    sw,
    ne,
    center: [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2],
    bounds: [sw, ne],
  }));
}

function generateGridCells(bounds: [[number, number], [number, number]], gridSizeMeters: number): GridCell[] {
  const [[swLng, swLat], [neLng, neLat]] = bounds;
  const latStep = gridSizeMeters / 111320;
  const midLat = (swLat + neLat) / 2;
  const lngStep = gridSizeMeters / (111320 * Math.cos((midLat * Math.PI) / 180));
  const cells: GridCell[] = [];
  for (let lat = swLat; lat < neLat; lat += latStep) {
    for (let lng = swLng; lng < neLng; lng += lngStep) {
      const cellSw: [number, number] = [lng, lat];
      const cellNe: [number, number] = [Math.min(lng + lngStep, neLng), Math.min(lat + latStep, neLat)];
      cells.push({
        sw: cellSw,
        ne: cellNe,
        center: [(cellSw[0] + cellNe[0]) / 2, (cellSw[1] + cellNe[1]) / 2],
        bounds: [cellSw, cellNe],
      });
    }
  }
  return cells;
}
