import React, { useState, useEffect } from 'react';
import type { GridCell } from '../../hooks/useAmap';
import { CATEGORY_LIST as CATS } from '../../types/poi';

const CATEGORY_NAMES: Record<string, string> = {};
CATS.forEach(c => { CATEGORY_NAMES[c.code] = c.name; });

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getQuotaBlockMessage(): string | null {
  const currentKey = localStorage.getItem('amap_rest_key') || '125c253ac5c0c03f9165bc3c721d130f';
  const blockedDay = localStorage.getItem('amap_quota_block_day');
  const blockedKey = localStorage.getItem('amap_quota_block_key');
  const message = localStorage.getItem('amap_quota_block_message');
  return blockedDay === getTodayKey() && blockedKey === currentKey
    ? message || '高德 Web服务 Key 今日配额已用完，请明天再采集或更换 Web服务 Key'
    : null;
}

interface Props {
  categories: string[];
  gridCells: GridCell[];
  collectPOIsClientSide: (
    cells: GridCell[],
    categories: string[],
    categoryNames: Record<string, string>,
    gridSizeMeters: number,
    onCellProgress: (done: number, total: number, pois: number) => void,
  ) => Promise<any[]>;
  stopCollecting: () => void;
  onComplete: (pois: any[]) => void;
}

function StepCollect({ categories, gridCells, collectPOIsClientSide, stopCollecting: stop, onComplete }: Props) {
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [total] = useState(gridCells.length * categories.length);
  const [poiCount, setPoiCount] = useState(0);
  const [status, setStatus] = useState<'running' | 'done'>('running');
  const [stopping, setStopping] = useState(false);
  const estimatedRequests = gridCells.length * categories.length * Number(localStorage.getItem('amap_max_pages_per_query') || '2');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const quotaMessage = getQuotaBlockMessage();
        if (quotaMessage) {
          throw new Error(quotaMessage);
        }

        // Estimate grid cell size from first cell
        const c0 = gridCells[0];
        const gridSizeMeters = c0
          ? Math.round(((c0.ne[1] - c0.sw[1]) * 111320 + (c0.ne[0] - c0.sw[0]) * 111320 * Math.cos(((c0.sw[1] + c0.ne[1]) / 2 * Math.PI) / 180)) / 2)
          : 500;

        const pois = await collectPOIsClientSide(
          gridCells,
          categories,
          CATEGORY_NAMES,
          gridSizeMeters,
          (d, t, realPois) => {
            if (!cancelled) {
              setDone(d);
              setPoiCount(realPois);
            }
          },
        );

        if (!cancelled) {
          setResolved(true);
          if (pois.length > 0) {
            setStatus('done');
            setPoiCount(pois.length);
            onComplete(pois);
          } else {
            setError('搜索完成但未找到任何POI数据。请确认区域内有目标类别的兴趣点，或检查网络连接。');
            setStatus('done');
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setResolved(true);
          setError(`采集出错: ${e?.message || '未知错误'}`);
          setStatus('done');
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Error / empty state
  if (resolved && error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 14, color: '#ef4444', textAlign: 'center', marginBottom: 8, maxWidth: 280 }}>{error}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 24 }}>
          已完成 {done}/{total} 个搜索任务
        </div>
        <button className="mobile-btn mobile-btn-primary" onClick={() => onComplete([])}>
          查看结果 (0条)
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
      <div className="collect-ring" style={{ position: 'relative' }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', top: -8, left: -8 }}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle cx="100" cy="100" r="92" fill="none" stroke={status === 'done' ? '#22c55e' : '#3b82f6'} strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 92 * pct / 100} ${2 * Math.PI * 92}`}
            strokeLinecap="round" transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dasharray 0.3s' }}
          />
        </svg>
        <span style={{ fontSize: 48, fontWeight: 800, color: status === 'done' ? '#22c55e' : '#3b82f6' }}>
          {pct}%
        </span>
        <span style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          {status === 'done' ? '采集完成' : '采集中...'}
        </span>
      </div>

      <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
        预计最多调用高德 {estimatedRequests} 次；已缓存网格会自动跳过
      </div>

      <div style={{ display: 'flex', gap: 40, marginTop: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{poiCount}</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>POI</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{done}/{total}</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>搜索任务</div>
        </div>
      </div>

      {status === 'running' && (
        <button className="mobile-btn mobile-btn-secondary" style={{ marginTop: 40, width: 140 }}
          disabled={stopping}
          onClick={() => { setStopping(true); stop(); }}>
          {stopping ? '正在停止...' : '停止并查看'}
        </button>
      )}
    </div>
  );
}

export default StepCollect;
