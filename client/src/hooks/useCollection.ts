import { useState, useCallback } from 'react';
import { startCollection, pauseCollection, resumeCollection, cancelCollection } from '../services/api';
import type { CollectRequest, CollectResponse, ProgressData, TaskStatus } from '../types/poi';

interface CollectionState {
  taskId: string | null;
  status: TaskStatus;
  progress: ProgressData;
  totalPois: number;
  loading: boolean;
  error: string | null;
}

const initialProgress: ProgressData = { doneCells: 0, totalCells: 0, totalPois: 0 };

export function useCollection() {
  const [state, setState] = useState<CollectionState>({
    taskId: null,
    status: 'pending',
    progress: initialProgress,
    totalPois: 0,
    loading: false,
    error: null,
  });

  const start = useCallback(async (req: CollectRequest): Promise<CollectResponse | null> => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await startCollection(req);
      setState(s => ({
        ...s,
        taskId: result.taskId,
        status: 'running',
        progress: { doneCells: 0, totalCells: result.totalCells, totalPois: 0 },
        loading: false,
      }));
      return result;
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }));
      return null;
    }
  }, []);

  const pause = useCallback(async () => {
    if (!state.taskId) return;
    await pauseCollection(state.taskId);
    setState(s => ({ ...s, status: 'paused' }));
  }, [state.taskId]);

  const resume = useCallback(async () => {
    if (!state.taskId) return;
    await resumeCollection(state.taskId);
    setState(s => ({ ...s, status: 'running' }));
  }, [state.taskId]);

  const cancel = useCallback(async () => {
    if (!state.taskId) return;
    await cancelCollection(state.taskId);
    setState(s => ({ ...s, status: 'cancelled' }));
  }, [state.taskId]);

  const onProgress = useCallback((data: ProgressData) => {
    setState(s => ({ ...s, progress: data }));
  }, []);

  const onComplete = useCallback((data: { totalPois: number }) => {
    setState(s => ({ ...s, status: 'done', totalPois: data.totalPois, error: null }));
  }, []);

  const onError = useCallback((err: string) => {
    setState(s => ({ ...s, status: 'failed', loading: false, error: err }));
  }, []);

  return { ...state, start, pause, resume, cancel, onProgress, onComplete, onError };
}
