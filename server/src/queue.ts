import { v4 as uuid } from 'uuid';
import { AmapApiError, collectCellWithRetry } from './services/amap';
import { generateGrid, filterCellsByPolygon, estimateTime } from './services/grid';
import { createTask, updateTaskStatus, incrementTaskProgress, insertPois, getTask, failTask } from './db';
import { cloudInsertTask, cloudUpdateTask, cloudInsertPois } from './services/cloud';
import { config } from './config';
import { mockAmapResponse } from './services/mock-pois';
import type { CollectRequest, GridCell, AmapPoiItem, TaskStatus } from './types';

function parseAddress(address: string): { province: string; city: string; district: string; town: string } {
  const text = address || '';
  const province = text.match(/([^省]+省|[^市]+市|[^区]+自治区)/)?.[0] || '';
  const city = text.match(/([^省市]+市|[^州]+州|[^盟]+盟)/)?.[0] || '';
  const district = text.match(/([^市区县]+区|[^市区县]+县|[^市区县]+市)/)?.[0] || '';
  const town = text.match(/([^区县镇乡街道]+镇|[^区县镇乡街道]+乡|[^区县镇乡街道]+街道)/)?.[0] || '';
  return { province, city, district, town };
}

interface ActiveTask {
  id: string;
  cells: GridCell[];
  currentIndex: number;
  status: TaskStatus;
  categories: string[];
  amapKey?: string;
  skipDuplicates: boolean;
  debug: boolean;
  onProgress: (data: any) => void;
  onComplete: (data: any) => void;
  onError: (data: any) => void;
}

const activeTasks = new Map<string, ActiveTask>();

const CATEGORY_MAP: Record<string, string> = {
  '050000': '餐饮美食', '060000': '购物消费', '070000': '生活服务',
  '080000': '医疗保健', '100000': '酒店住宿', '110000': '旅游景点',
  '140000': '交通设施', '150000': '教育培训', '160000': '金融服务',
  '120000': '公司企业', '130000': '政府机构', '010000': '汽车服务',
  '180000': '体育休闲',
};

function mapCategory(typecode: string): string {
  // typecode format: "050100|050101" — take the second part's first 6 chars
  const parts = typecode.split('|');
  if (parts.length > 1) {
    const code = parts[1].slice(0, 6);
    return CATEGORY_MAP[code] || code;
  }
  return '';
}

function mapSubcategory(typeStr: string): string {
  // type format: "餐饮服务;中餐厅;中餐厅"
  const parts = typeStr.split(';');
  return parts.length > 1 ? parts[1] : (parts[0] || '');
}

export function startCollection(
  req: CollectRequest,
  onProgress: (data: any) => void,
  onComplete: (data: any) => void,
  onError: (data: any) => void = () => {}
): { taskId: string; totalCells: number; estimatedMinutes: number } {
  const taskId = uuid();
  let cells = generateGrid(req.bounds, req.gridSize || 0.01);

  if (req.mode === 'region' && req.region) {
    cells = filterCellsByPolygon(cells, req.region);
  }

  console.log(`[Queue] 开始采集: taskId=${taskId} mode=${req.mode} categories=${req.categories.join(',')} cells=${cells.length}`);

  // Dual-write: local SQLite + Supabase cloud
  cloudInsertTask({
    id: taskId, mode: req.mode, categories: JSON.stringify(req.categories),
    grid_size: req.gridSize, total_cells: cells.length,
    bounds: req.bounds,
  }).catch(() => {});

  createTask({
    id: taskId,
    mode: req.mode,
    categories: JSON.stringify(req.categories),
    grid_size: req.gridSize || null,
    region_geo: req.region ? JSON.stringify(req.region) : null,
    status: 'running',
    total_cells: cells.length,
    done_cells: 0,
    total_pois: 0,
  });

  const task: ActiveTask = {
    id: taskId,
    cells,
    currentIndex: 0,
    status: 'running',
    categories: req.categories,
    amapKey: req.amapKey?.trim() || undefined,
    skipDuplicates: req.skipDuplicates || false,
    debug: req.debug || false,
    onProgress,
    onComplete,
    onError,
  };

  activeTasks.set(taskId, task);
  processNextCell(taskId);

  return {
    taskId,
    totalCells: cells.length,
    estimatedMinutes: estimateTime(cells.length),
  };
}

async function processNextCell(taskId: string): Promise<void> {
  const task = activeTasks.get(taskId);
  if (!task || task.status !== 'running') return;

  if (task.currentIndex >= task.cells.length) {
    const t = getTask(taskId);
    console.log(`[Queue] 采集完成: taskId=${taskId} totalPois=${t?.total_pois || 0}`);
    updateTaskStatus(taskId, 'done');
    cloudUpdateTask(taskId, { status: 'done', total_pois: t?.total_pois || 0, done_cells: t?.done_cells || 0 }).catch(() => {});
    task.status = 'done';
    task.onComplete({ taskId, totalPois: t?.total_pois || 0 });
    activeTasks.delete(taskId);
    return;
  }

  const cell = task.cells[task.currentIndex];
  console.log(`[Queue] 处理格子 ${task.currentIndex + 1}/${task.cells.length} [${cell.row},${cell.col}]${task.debug ? ' [调试模式]' : ''}`);
  let pois: AmapPoiItem[] = [];
  try {
  if (task.debug) {
    // Mock mode: generate fake POIs, simulate delay
    await sleep(300);
    for (const catCode of task.categories) {
      const centerLng = (cell.sw.lng + cell.ne.lng) / 2;
      const centerLat = (cell.sw.lat + cell.ne.lat) / 2;
      const mock = mockAmapResponse(centerLng, centerLat, catCode);
      pois.push(...(mock.pois as any));
    }
  } else {
    pois = await collectCellWithRetry(cell, task.categories, task.amapKey);
  }
  } catch (err: any) {
    const message = err instanceof AmapApiError ? err.message : (err?.message || '采集任务失败');
    console.error(`[Queue] 采集失败: taskId=${taskId} ${message}`);
    failTask(taskId, message);
    cloudUpdateTask(taskId, { status: 'failed' }).catch(() => {});
    task.status = 'failed';
    task.onError({ taskId, error: message });
    activeTasks.delete(taskId);
    return;
  }
  console.log(`[Queue] 格子 ${task.currentIndex + 1} 返回 ${pois.length} 条POI`);

  if (pois.length > 0) {
    const mappedPois = pois.map(p => {
      const parts = (p.typecode || '').split('|');
      const code = parts.length > 1 ? parts[1].slice(0, 6) : '';
      const addrParsed = parseAddress(p.address || '');
      return {
        name: p.name,
        category: CATEGORY_MAP[code] || code,
        subcategory: mapSubcategory(p.type || ''),
        address: p.address || '',
        lng: parseFloat(p.location.split(',')[0]),
        lat: parseFloat(p.location.split(',')[1]),
        phone: p.tel || '',
        rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : null,
        ...addrParsed,
      };
    });

    // Cloud sync
    cloudInsertPois(taskId, mappedPois).catch(() => {});

    // Local SQLite
    insertPois(taskId, mappedPois, task.skipDuplicates);
  }

  incrementTaskProgress(taskId, pois.length);
  task.currentIndex++;

  const t = getTask(taskId);
  task.onProgress({
    doneCells: task.currentIndex,
    totalCells: task.cells.length,
    totalPois: t?.total_pois || 0,
  });

  await sleep(config.requestDelay);
  // Use setImmediate or setTimeout to avoid stack overflow from recursion
  setImmediate(() => processNextCell(taskId));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function pauseCollection(taskId: string): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.status = 'paused';
    updateTaskStatus(taskId, 'paused');
  }
}

export function resumeCollection(taskId: string): void {
  const task = activeTasks.get(taskId);
  if (task && task.status === 'paused') {
    task.status = 'running';
    updateTaskStatus(taskId, 'running');
    processNextCell(taskId);
  }
}

export function cancelCollection(taskId: string): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.status = 'cancelled';
    updateTaskStatus(taskId, 'cancelled');
    activeTasks.delete(taskId);
  }
}
