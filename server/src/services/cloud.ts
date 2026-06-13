import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://sasfkjvdrzgzujoykbqn.supabase.co',
  'sb_publishable_BPMz4V8OXRFdAcfjJKAg6A_hFl5A0tS'
);

export async function cloudInsertTask(task: {
  id: string; mode: string; categories: string; grid_size?: number;
  region_geo?: any; bounds?: any; total_cells: number;
}) {
  const { error } = await supabase.from('tasks').insert({
    id: task.id, mode: task.mode, categories: task.categories,
    grid_size: task.grid_size || null, region_geo: task.region_geo || null,
    bounds: task.bounds || null, total_cells: task.total_cells,
  });
  if (error) console.error('[Cloud] insertTask:', error.message);
}

export async function cloudUpdateTask(id: string, updates: any) {
  const { error } = await supabase.from('tasks').update(updates).eq('id', id);
  if (error) console.error('[Cloud] updateTask:', error.message);
}

export async function cloudInsertPois(taskId: string, pois: any[]) {
  if (pois.length === 0) return;
  const rows = pois.map(p => ({ task_id: taskId, ...p }));
  const { error } = await supabase.from('pois').insert(rows);
  if (error) console.error('[Cloud] insertPois:', error.message);
}
