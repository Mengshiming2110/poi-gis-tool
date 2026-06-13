import type { Bounds, GridCell } from '../types';

export function generateGrid(bounds: Bounds, gridSize: number): GridCell[] {
  const { southwest: sw, northeast: ne } = bounds;
  const rows = Math.ceil((ne.lat - sw.lat) / gridSize);
  const cols = Math.ceil((ne.lng - sw.lng) / gridSize);
  const cells: GridCell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        row: r,
        col: c,
        sw: { lng: sw.lng + c * gridSize, lat: sw.lat + r * gridSize },
        ne: { lng: sw.lng + (c + 1) * gridSize, lat: sw.lat + (r + 1) * gridSize },
      });
    }
  }

  return cells;
}

export function filterCellsByPolygon(cells: GridCell[], polygon: any): GridCell[] {
  const ring: [number, number][] = polygon?.coordinates?.[0];
  if (!ring || ring.length < 3) return cells;

  return cells.filter(cell => {
    const cx = (cell.sw.lng + cell.ne.lng) / 2;
    const cy = (cell.sw.lat + cell.ne.lat) / 2;
    return pointInPolygon([cx, cy], ring);
  });
}

function pointInPolygon(point: [number, number], ring: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function estimateTime(cellCount: number): number {
  return Math.ceil((cellCount * 1.2) / 60);
}
