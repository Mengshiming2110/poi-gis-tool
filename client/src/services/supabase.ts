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

export async function getTasks(): Promise<CloudTask[]> {
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(20);
  return data || [];
}

export async function getPois(taskId: string): Promise<CloudPoi[]> {
  const { data } = await supabase.from('pois').select('*').eq('task_id', taskId).order('id');
  return data || [];
}
