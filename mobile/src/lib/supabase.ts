import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://sasfkjvdrzgzujoykbqn.supabase.co',
  'sb_publishable_BPMz4V8OXRFdAcfjJKAg6A_hFl5A0tS'
);

export async function getTasks() {
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(20);
  return data || [];
}

export async function getPois(taskId: string) {
  const { data } = await supabase.from('pois').select('*').eq('task_id', taskId).order('id');
  return data || [];
}

export function subscribeToTask(taskId: string, onUpdate: (t: any) => void) {
  return supabase
    .channel(`task-${taskId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` },
      (p) => onUpdate(p.new))
    .subscribe();
}
