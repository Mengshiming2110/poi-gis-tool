import { useEffect, useRef } from 'react';
import { getProgressUrl } from '../services/api';
import type { ProgressData } from '../types/poi';

export function useSSE(
  taskId: string | null,
  onProgress: (data: ProgressData) => void,
  onComplete: (data: { totalPois: number }) => void,
  onError: (err: string) => void,
) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const es = new EventSource(getProgressUrl(taskId));
    eventSourceRef.current = es;
    let closedByServer = false;

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      onProgress(data);
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      closedByServer = true;
      onComplete(data);
      es.close();
    });

    es.addEventListener('failed', (e) => {
      const data = JSON.parse(e.data);
      closedByServer = true;
      onError(data.error || '采集任务失败');
      es.close();
    });

    es.onerror = () => {
      if (!closedByServer) onError('采集进度连接中断');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [taskId]);
}
