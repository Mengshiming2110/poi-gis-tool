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

// Config from localStorage, fallback to defaults
function getConfig() {
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

        instance.addControl(new AMap.Scale({ position: 'LB' }));
        instance.addControl(new AMap.ToolBar({ position: 'RT' }));

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

    const REST_KEY = localStorage.getItem('amap_rest_key') || '125c253ac5c0c03f9165bc3c721d130f';
    const PAGE_SIZE = 25;

    setIsCollecting(true);
    collectingRef.current = true;
    setPoiData([]);
    const allPois: any[] = [];
    const seen = new Set<string>();
    const totalTasks = cells.length * categories.length;
    let done = 0;
    let firstError: string | null = null;

    for (const cell of cells) {
      if (!collectingRef.current) break;
      for (const catCode of categories) {
        if (!collectingRef.current) break;
        try {
          const radius = Math.max(gridSizeMeters * 0.75, 150);

          // Fetch page 1
          const { pois: page1, total: count } = await fetchAmapPOIs(
            REST_KEY, cell.center, radius, catCode, 1, PAGE_SIZE,
          );

          page1.forEach((poi: any) => {
            const key = poi.id || `${poi.name}_${poi.lng?.toFixed(5)}_${poi.lat?.toFixed(5)}`;
            if (!seen.has(key)) {
              seen.add(key);
              allPois.push({ ...poi, category: categoryNames[catCode] || catCode });
            }
          });

          // Fetch remaining pages
          const pages = Math.ceil(count / PAGE_SIZE);
          for (let p = 2; p <= Math.min(pages, 4); p++) {
            if (!collectingRef.current) break;
            const { pois: pagePois } = await fetchAmapPOIs(
              REST_KEY, cell.center, radius, catCode, p, PAGE_SIZE,
            );
            pagePois.forEach((poi: any) => {
              const key = poi.id || `${poi.name}_${poi.lng?.toFixed(5)}_${poi.lat?.toFixed(5)}`;
              if (!seen.has(key)) {
                seen.add(key);
                allPois.push({ ...poi, category: categoryNames[catCode] || catCode });
              }
            });
          }
        } catch (e: any) {
          console.warn('[REST] 搜索出错:', e);
          if (!firstError) firstError = e?.message || String(e);
        }
        done++;
        onCellProgress(done, totalTasks, allPois.length);
        await new Promise(r => setTimeout(r, 200));
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
    throw new Error(`${data.info || 'API错误'} [${data.infocode}]`);
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
