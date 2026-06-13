import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sasfkjvdrzgzujoykbqn.supabase.co';
const supabaseKey = 'sb_publishable_BPMz4V8OXRFdAcfjJKAg6A_hFl5A0tS';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface CloudTask {
  id: string; mode: string; categories: string;
  status: string; total_cells: number; done_cells: number;
  total_pois: number; created_at: string;
}

export interface CloudPoi {
  id: number; task_id: string;
  name: string; category: string; subcategory: string;
  address: string; lng: number; lat: number;
  phone: string; rating: number;
}

// ─── Read (both mobile + desktop) ───
export async function getTasks(): Promise<CloudTask[]> {
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(20);
  return data || [];
}

export async function getPois(taskId: string): Promise<CloudPoi[]> {
  const { data } = await supabase.from('pois').select('*').eq('task_id', taskId).order('id');
  return data || [];
}

// ─── Write (mobile upload) ───
export async function createCloudTask(task: {
  categories: string;
  total_cells: number;
  total_pois: number;
}): Promise<string | null> {
  const { data, error } = await supabase.from('tasks').insert({
    mode: 'region',
    categories: task.categories,
    total_cells: task.total_cells,
    done_cells: task.total_cells,
    total_pois: task.total_pois,
    status: 'done',
  }).select('id').single();

  if (error) {
    console.error('[Supabase] createCloudTask error:', error);
    return null;
  }
  return data.id;
}

export async function insertCloudPois(taskId: string, pois: Array<{
  name: string; category: string; subcategory: string;
  address: string; lng: number; lat: number; phone: string;
}>): Promise<number> {
  // Insert in batches of 50 to avoid request size limits
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < pois.length; i += BATCH) {
    const batch = pois.slice(i, i + BATCH).map(p => ({ task_id: taskId, ...p }));
    const { error } = await supabase.from('pois').insert(batch);
    if (error) {
      console.error('[Supabase] insertCloudPois error:', error);
      return inserted;
    }
    inserted += batch.length;
  }
  return inserted;
}
