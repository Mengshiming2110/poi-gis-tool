import React from 'react';

interface Props {
  status: 'idle' | 'running' | 'done';
  progress: { done: number; total: number; pois: number };
}

function MobileProgressTab({ status, progress }: Props) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      <div className="mobile-stat-grid">
        <div className="stat-card">
          <div className="v">{progress.total || '—'}</div>
          <div className="l">请求总数</div>
        </div>
        <div className="stat-card">
          <div className="v" style={{ color: 'var(--accent)' }}>{progress.pois}</div>
          <div className="l">POI 总数</div>
        </div>
        <div className="stat-card">
          <div className="v">{progress.done}</div>
          <div className="l">已完成 {pct}%</div>
        </div>
        <div className="stat-card">
          <div className="v" style={{ color: 'var(--warn)' }}>—</div>
          <div className="l">重复跳过</div>
        </div>
      </div>

      {status === 'idle' && progress.total === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
          暂无采集数据<br />
          <span style={{ fontSize: 11 }}>在地图页配置区域后开始拉取</span>
        </div>
      )}

      {status === 'running' && (
        <div className="mobile-progress-card">
          <h4>正在采集<span className="pct">{progress.done}/{progress.total} · {pct}%</span></h4>
          <div className="mobile-progress-track">
            <div className="mobile-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="mobile-progress-card">
          <h4>采集完成 <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>✓ {progress.pois} 条POI</span></h4>
          <div className="mobile-progress-track">
            <div className="mobile-progress-fill" style={{ width: '100%', background: 'var(--success)' }} />
          </div>
        </div>
      )}
    </>
  );
}

export default MobileProgressTab;
