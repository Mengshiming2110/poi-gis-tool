import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sasfkjvdrzgzujoykbqn.supabase.co';
const supabaseKey = 'sb_publishable_BPMz4V8OXRFdAcfjJKAg6A_hFl5A0tS';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ───
export interface CloudTask {
  id: string;
  mode: 'grid' | 'region';
  categories: string;
  grid_size: number | null;
  region_geo: any;
  bounds: any;
  status: 'pending' | 'running' | 'paused' | 'done' | 'cancelled';
  total_cells: number;
  done_cells: number;
  total_pois: number;
  created_at: string;
}

export interface CloudPoi {
  id: number;
  task_id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  address: string | null;
  lng: number;
  lat: number;
  phone: string | null;
  rating: number | null;
  collected_at: string;
}

// ─── Tasks ───
export async function createTask(task: {
  id: string;
  mode: string;
  categories: string;
  grid_size?: number;
  region_geo?: any;
  bounds?: any;
  total_cells: number;
}): Promise<CloudTask | null> {
  const { data, error } = await supabase.from('tasks').insert({
    id: task.id,
    mode: task.mode,
    categories: task.categories,
    grid_size: task.grid_size || null,
    region_geo: task.region_geo || null,
    bounds: task.bounds || null,
    total_cells: task.total_cells,
  }).select().single();
  if (error) { console.error('[Supabase] createTask:', error); return null; }
  return data;
}

export async function updateTaskStatus(id: string, status: string): Promise<void> {
  await supabase.from('tasks').update({ status }).eq('id', id);
}

export async function incrementTaskProgress(id: string, newPois: number): Promise<void> {
  const { data } = await supabase.from('tasks').select('done_cells,total_pois').eq('id', id).single();
  if (!data) return;
  await supabase.from('tasks').update({
    done_cells: data.done_cells + 1,
    total_pois: data.total_pois + newPois,
  }).eq('id', id);
}

export async function getTask(id: string): Promise<CloudTask | null> {
  const { data } = await supabase.from('tasks').select('*').eq('id', id).single();
  return data;
}

export async function getAllTasks(): Promise<CloudTask[]> {
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  return data || [];
}

// ─── POIs ───
export async function insertPois(taskId: string, pois: Omit<CloudPoi, 'id' | 'task_id' | 'collected_at'>[]): Promise<number> {
  const rows = pois.map(p => ({ task_id: taskId, ...p }));
  const { error } = await supabase.from('pois').insert(rows);
  if (error) { console.error('[Supabase] insertPois:', error); return 0; }
  return pois.length;
}

export async function queryPois(params: {
  taskId: string;
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}): Promise<{ pois: CloudPoi[]; total: number }> {
  let query = supabase.from('pois').select('*', { count: 'exact' }).eq('task_id', params.taskId);

  if (params.search) query = query.ilike('name', `%${params.search}%`);
  if (params.category) query = query.eq('category', params.category);

  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  const { data, count, error } = await query.order('id').range(from, to);

  if (error) { console.error('[Supabase] queryPois:', error); return { pois: [], total: 0 }; }
  return { pois: data || [], total: count || 0 };
}

export async function getTaskPoisForExport(taskId: string): Promise<CloudPoi[]> {
  const { data } = await supabase.from('pois').select('*').eq('task_id', taskId).order('id');
  return data || [];
}

// ─── Realtime ───
export function subscribeToPois(taskId: string, onInsert: (poi: CloudPoi) => void) {
  return supabase
    .channel(`pois-${taskId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pois', filter: `task_id=eq.${taskId}` },
      (payload) => onInsert(payload.new as CloudPoi)
    )
    .subscribe();
}

export function subscribeToTask(taskId: string, onUpdate: (task: CloudTask) => void) {
  return supabase
    .channel(`task-${taskId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` },
      (payload) => onUpdate(payload.new as CloudTask)
    )
    .subscribe();
}
