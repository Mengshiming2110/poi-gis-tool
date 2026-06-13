import React, { useState, useEffect, useCallback } from 'react';
import { getTasks, getPois, type CloudTask } from '../services/supabase';

function CloudPanel() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<CloudTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleExport = async (taskId: string) => {
    setExporting(true);
    try {
      const pois = await getPois(taskId);
      const header = '名称,类别,子类别,地址,经度,纬度,电话';
      const rows = pois.map(p =>
        [p.name, p.category, p.subcategory || '', p.address || '', p.lng, p.lat, p.phone || '']
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `poi-cloud-${taskId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setExporting(false);
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const parseCategories = (cat: string) => {
    try { return cat.split(',').filter(Boolean).join('、'); } catch { return cat; }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        title="云端数据"
        style={{
          position: 'fixed', right: 12, bottom: 60, zIndex: 1000,
          width: 40, height: 40, borderRadius: '50%',
          border: 'none', background: '#1e293b', color: '#fff',
          fontSize: 18, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        ☁️
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', right: 60, bottom: 50, zIndex: 999,
          width: 320, maxHeight: 400, background: '#fff',
          borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>☁️ 云端任务</span>
            <button onClick={refresh} disabled={loading}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>
              {loading ? '⏳' : '🔄'}
            </button>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>
                {loading ? '加载中...' : '暂无云端任务\n请在手机端采集后点击"同步云端"'}
              </div>
            )}
            {tasks.map(t => (
              <div key={t.id} style={{
                padding: '10px 12px', margin: '4px 0', borderRadius: 8,
                background: selectedTask === t.id ? '#eff6ff' : '#f8fafc',
                border: selectedTask === t.id ? '1px solid #3b82f6' : '1px solid transparent',
                cursor: 'pointer',
              }}
                onClick={() => setSelectedTask(selectedTask === t.id ? null : t.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {parseCategories(t.categories)}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(t.created_at)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {t.total_pois} 条POI · {t.total_cells} 格
                </div>
                {selectedTask === t.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(t.id); }}
                    disabled={exporting}
                    style={{
                      marginTop: 8, padding: '4px 12px', borderRadius: 6,
                      border: 'none', background: '#3b82f6', color: '#fff',
                      fontSize: 12, cursor: 'pointer', width: '100%',
                    }}
                  >
                    {exporting ? '导出中...' : '📥 导出 CSV'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default CloudPanel;
