import React, { useState } from 'react';
import { CATEGORY_LIST } from '../../types/poi';
import { createCloudTask, insertCloudPois } from '../../services/supabase';

interface Props {
  pois: any[];
  categories: string[];
  onRestart: () => void;
}

// Build color lookup
const CATEGORY_COLORS: Record<string, string> = {};
CATEGORY_LIST.forEach((c) => { CATEGORY_COLORS[c.name] = c.color; });

function buildCSV(pois: any[]): string {
  const header = '名称,类别,子类别,地址,经度,纬度,电话';
  const rows = pois.map((p: any) =>
    [p.name, p.category, p.subcategory || '', p.address || '', p.lng, p.lat, p.phone || '']
      .map((v: string | number) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  return `\ufeff${[header, ...rows].join('\n')}`;
}

function buildGeoJSON(pois: any[]) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: pois.map((p: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { name: p.name, category: p.category, address: p.address, phone: p.phone },
    })),
  }, null, 2);
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function shareOrDownload(content: string, filename: string, mime: string, title: string) {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (navigator.share) {
    try {
      const data: ShareData = { title, text: title, files: [file] };
      if (!nav.canShare || nav.canShare(data)) {
        await navigator.share(data);
        return;
      }
    } catch {
      // Fall through to the next save path.
    }

    try {
      await navigator.share({ title, text: content });
      return;
    } catch {
      // Fall through to browser download.
    }
  }

  downloadBlob(content, filename, mime);
}

function StepResults({ pois, categories, onRestart }: Props) {
  const [copied, setCopied] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');

  const handleSync = async () => {
    if (syncState === 'syncing') return;
    setSyncState('syncing');
    setSyncMsg('上传中...');
    try {
      const taskId = await createCloudTask({
        categories: categories.join(','),
        total_cells: 0, // mobile doesn't track cell count separately
        total_pois: pois.length,
      });

      const count = await insertCloudPois(taskId, pois);
      if (count !== pois.length) {
        throw new Error(`只同步了 ${count}/${pois.length} 条，请重试`);
      }
      setSyncState('done');
      setSyncMsg(`已同步 ${count} 条到云端`);
    } catch (e: any) {
      setSyncState('error');
      setSyncMsg(e?.message || '同步失败');
    }
  };

  const handleShare = async () => {
    const csv = buildCSV(pois);
    await shareOrDownload(csv, 'poi-data.csv', 'text/csv', `POI 采集数据（${pois.length}条）`);
  };

  const handleCopy = async () => {
    const csv = buildCSV(pois);
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = csv;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGeoJSON = () => {
    shareOrDownload(buildGeoJSON(pois), 'pois.geojson', 'application/geo+json', `POI GeoJSON（${pois.length}条）`);
  };

  const handleCSV = () => {
    shareOrDownload(buildCSV(pois), 'poi-data.csv', 'text/csv', `POI CSV（${pois.length}条）`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px', borderBottom: '1px solid #e2e8f0',
      }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>采集结果 ({pois.length})</span>
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
        <button
          className="mobile-btn mobile-btn-primary"
          style={{ padding: '8px 16px', fontSize: 13, width: 'auto', background: syncState === 'done' ? '#22c55e' : syncState === 'error' ? '#ef4444' : undefined }}
          onClick={handleSync}
          disabled={syncState === 'syncing' || syncState === 'done'}
        >
          {syncState === 'syncing' ? '⏳ 同步中' : syncState === 'done' ? '✅ 已同步' : syncState === 'error' ? '❌ 重试' : '☁️ 同步云端'}
        </button>
        <button className="mobile-btn mobile-btn-secondary" style={{ padding: '8px 16px', fontSize: 13, width: 'auto' }}
          onClick={handleShare}>
          📤 分享
        </button>
        <button className="mobile-btn mobile-btn-secondary" style={{ padding: '8px 16px', fontSize: 13, width: 'auto' }}
          onClick={handleCopy}>
          {copied ? '✅ 已复制' : '📋 复制CSV'}
        </button>
        <button className="mobile-btn mobile-btn-secondary" style={{ padding: '8px 16px', fontSize: 13, width: 'auto' }}
          onClick={handleCSV}>
          📄 保存CSV
        </button>
        <button className="mobile-btn mobile-btn-secondary" style={{ padding: '8px 16px', fontSize: 13, width: 'auto' }}
          onClick={handleGeoJSON}>
          🗺 GeoJSON
        </button>
      </div>
      {syncMsg && (
        <div style={{
          padding: '6px 16px', fontSize: 12, textAlign: 'center',
          color: syncState === 'done' ? '#16a34a' : syncState === 'error' ? '#dc2626' : '#3b82f6',
          background: syncState === 'done' ? '#f0fdf4' : syncState === 'error' ? '#fef2f2' : '#eff6ff',
          borderBottom: '1px solid #f1f5f9',
        }}>
          {syncMsg}
        </div>
      )}

      {/* POI list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {pois.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
            暂无数据
          </div>
        )}
        {pois.map((p: any, i: number) => (
          <div key={i} className="poi-list-item">
            <div className="poi-dot" style={{ background: CATEGORY_COLORS[p.category] || '#94a3b8' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                {p.category}{p.subcategory ? ' · ' + p.subcategory : ''}{p.address ? ' · ' + p.address : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mobile-footer">
        <button className="mobile-btn mobile-btn-primary" onClick={onRestart}>完成</button>
      </div>
    </div>
  );
}

export default StepResults;
