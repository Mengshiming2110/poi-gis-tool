import type { CollectRequest, CollectResponse, Task, PoiQueryResult } from '../types/poi';

const BASE = '/api';

export async function startCollection(req: CollectRequest): Promise<CollectResponse> {
  const res = await fetch(`${BASE}/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('采集请求失败');
  return res.json();
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
  if (!res.ok) throw new Error('查询POI失败');
  return res.json();
}

export function getExportUrl(taskId: string, format: 'xlsx' | 'geojson'): string {
  return `${BASE}/export/${taskId}?format=${format}`;
}

export function getProgressUrl(taskId: string): string {
  return `${BASE}/collect/${taskId}/progress`;
}
