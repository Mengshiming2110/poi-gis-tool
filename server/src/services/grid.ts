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

export function filterCellsByPolygon(cells: GridCell[], _polygon: any): GridCell[] {
  return cells;
}

export function estimateTime(cellCount: number): number {
  return Math.ceil((cellCount * 1.2) / 60);
}
