import type { CollectRequest, CollectResponse, Task, PoiQueryResult } from '../types/poi';

const BASE = '/api';

function maskKey(key: string): string {
  if (key.length <= 10) return '***';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export async function startCollection(req: CollectRequest): Promise<CollectResponse> {
  const safeReq = req.amapKey ? { ...req, amapKey: maskKey(req.amapKey) } : req;
  console.log('[Client] 发送采集请求:', JSON.stringify(safeReq, null, 2));

  const res = await fetch(`${BASE}/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('[Client] 采集请求失败:', json);
    throw new Error(json?.error || '采集请求失败');
  }
  console.log('[Client] 采集任务已创建:', json);
  return json;
}

export async function getTaskStatus(taskId: string): Promise<Task> {
  const res = await fetch(`${BASE}/collect/${taskId}`);
  if (!res.ok) throw new Error('获取任务状态失败');
  return res.json();
}

export async function pauseCollection(taskId: string): Promise<void> {
  await fetch(`${BASE}/collect/${taskId}/pause`, { method: 'POST' });
}

export async function resumeCollection(taskId: string): Promise<void> {
  await fetch(`${BASE}/collect/${taskId}/resume`, { method: 'POST' });
}

export async function cancelCollection(taskId: string): Promise<void> {
  await fetch(`${BASE}/collect/${taskId}/cancel`, { method: 'POST' });
}

export async function queryPois(params: {
  taskId: string;
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}): Promise<PoiQueryResult> {
  const searchParams = new URLSearchParams();
  searchParams.set('taskId', params.taskId);
  searchParams.set('page', String(params.page));
  searchParams.set('pageSize', String(params.pageSize));
  if (params.search) searchParams.set('search', params.search);
  if (params.category) searchParams.set('category', params.category);

  const res = await fetch(`${BASE}/pois?${searchParams}`);
  if (!res.ok) throw new Error('查询 POI 失败');
  return res.json();
}

export async function queryPoiLibrary(params: {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}): Promise<PoiQueryResult> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page));
  searchParams.set('pageSize', String(params.pageSize));
  if (params.search) searchParams.set('search', params.search);
  if (params.category) searchParams.set('category', params.category);

  const res = await fetch(`${BASE}/pois/library?${searchParams}`);
  if (!res.ok) throw new Error('查询本地数据库失败');
  return res.json();
}

export interface PoiLibraryStats {
  total: number;
  byDistrict: { district: string; count: number }[];
  byCategory: { category: string; count: number }[];
  duplicateCount: number;
}

export async function queryPoiLibraryStats(): Promise<PoiLibraryStats> {
  const res = await fetch(`${BASE}/pois/library/stats`);
  if (!res.ok) throw new Error('获取本地库统计失败');
  return res.json();
}

export function getExportUrl(taskId: string, format: 'xlsx' | 'geojson'): string {
  return `${BASE}/export/${taskId}?format=${format}`;
}

export function getProgressUrl(taskId: string): string {
  return `${BASE}/collect/${taskId}/progress`;
}
