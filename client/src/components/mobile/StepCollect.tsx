import React, { useState, useEffect, useRef } from 'react';
import { startCollection, getProgressUrl } from '../../services/api';
import type { GridCell } from '../../hooks/useAmap';

interface Props {
  categories: string[];
  gridCells: GridCell[];
  onComplete: (pois: any[]) => void;
}

function StepCollect({ categories, gridCells, onComplete }: Props) {
  const [progress, setProgress] = useState({ done: 0, total: gridCells.length, pois: 0 });
  const [status, setStatus] = useState<'running' | 'paused' | 'done'>('running');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // Try desktop backend
        const result = await startCollection({
          mode: 'region',
          categories,
          bounds: {
            southwest: { lng: gridCells[0]?.sw[0] || 0, lat: gridCells[0]?.sw[1] || 0 },
            northeast: { lng: gridCells[gridCells.length - 1]?.ne[0] || 0, lat: gridCells[gridCells.length - 1]?.ne[1] || 0 },
          },
        });

        // SSE progress tracking
        const es = new EventSource(getProgressUrl(result.taskId));
        esRef.current = es;

        es.addEventListener('progress', (e) => {
          const d = JSON.parse(e.data);
          if (!cancelled) {
            setProgress({ done: d.doneCells, total: d.totalCells, pois: d.totalPois });
          }
        });

        es.addEventListener('complete', (e) => {
          const d = JSON.parse(e.data);
          if (!cancelled) {
            setStatus('done');
            onComplete(Array(d.totalPois || 0).fill(null)); // placeholder
          }
          es.close();
        });

        es.onerror = () => {
          if (!cancelled) setStatus('done'); // fallback
        };
      } catch {
        // Backend unreachable — done immediately for now
        if (!cancelled) {
          setStatus('done');
          onComplete([]);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      esRef.current?.close();
    };
  }, []);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
      <div className="collect-ring" style={{ position: 'relative' }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', top: -8, left: -8 }}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="#e2e8f0" strokeWidth="8" />
          {status === 'running' && (
            <circle cx="100" cy="100" r="92" fill="none" stroke="#3b82f6" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 92 * pct / 100} ${2 * Math.PI * 92}`}
              strokeLinecap="round" transform="rotate(-90 100 100)"
              style={{ transition: 'stroke-dasharray 0.3s' }}
            />
          )}
          <circle cx="100" cy="100" r="92" fill="none" stroke="#22c55e" strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 92 * (pct / 100)}`}
            strokeLinecap="round" transform="rotate(-90 100 100)"
            opacity={status === 'done' ? 1 : 0}
            style={{ transition: 'opacity 0.3s' }}
          />
        </svg>
        <span style={{ fontSize: 48, fontWeight: 800, color: status === 'done' ? '#22c55e' : '#3b82f6' }}>
          {pct}%
        </span>
        <span style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          {status === 'done' ? '采集完成' : '采集中...'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 40, marginTop: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{progress.pois}</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>POI</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{progress.done}/{progress.total}</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>格子</div>
        </div>
      </div>

      {status === 'running' && (
        <button className="mobile-btn mobile-btn-secondary" style={{ marginTop: 40, width: 140 }}
          onClick={() => { esRef.current?.close(); setStatus('done'); }}>
          暂停
        </button>
      )}
    </div>
  );
}

export default StepCollect;
