import { useEffect, useState, useRef } from 'react';
import { CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { queryPois } from '../services/api';
import type { PoiRecord, TaskStatus } from '../types/poi';

interface DataTableProps {
  taskId: string | null;
  status: TaskStatus;
}

function DataTable({ taskId, status }: DataTableProps) {
  const [pois, setPois] = useState<PoiRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 50;
  const prevStatusRef = useRef<TaskStatus>(status);

  // Fetch on: taskId change, page change, search change, or status -> done
  useEffect(() => {
    if (!taskId) return;
    queryPois({ taskId, page, pageSize, search: search || undefined })
      .then(r => { setPois(r.pois); setTotal(r.total); })
      .catch(console.error);
  }, [taskId, page, search]);

  // Auto-refresh when collection finishes
  useEffect(() => {
    if (status === 'done' && prevStatusRef.current !== 'done') {
      setPage(1); // triggers re-fetch via the effect above
    }
    prevStatusRef.current = status;
  }, [status]);

  // Periodic refresh while collecting
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => {
      if (!taskId) return;
      queryPois({ taskId, page: 1, pageSize, search: search || undefined })
        .then(r => { setPois(r.pois); setTotal(r.total); })
        .catch(console.error);
    }, 3000);
    return () => clearInterval(timer);
  }, [status, taskId, search]);

  const totalPages = Math.ceil(total / pageSize);

  const thStyle: React.CSSProperties = {
    padding: '6px 8px', fontSize: 11, color: '#64748b',
    borderBottom: '1px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '5px 8px', fontSize: 11, color: '#334155',
    borderBottom: '1px solid #f1f5f9', maxWidth: 180,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };

  const navBtn = (dir: 'prev' | 'next'): React.CSSProperties => {
    const disabled = dir === 'prev' ? page <= 1 : page >= totalPages;
    return {
      border: 'none', background: 'none',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.3 : 1,
    };
  };

  return (
    <div style={{ padding: '8px 0', fontSize: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ position: 'relative' }}>
          <MagnifyingGlass size={12} color="#94a3b8" style={{ position: 'absolute', left: 6, top: 6 }} />
          <input type="text" placeholder="搜索POI名称..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: '4px 8px 4px 22px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 11, outline: 'none', width: 160 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748b' }}>
          <span>共 {total} 条</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={navBtn('prev')}>
            <CaretLeft size={14} />
          </button>
          <span>{page}/{Math.max(totalPages, 1)}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={navBtn('next')}>
            <CaretRight size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>名称</th>
              <th style={thStyle}>类别</th>
              <th style={thStyle}>地址</th>
              <th style={thStyle}>经度</th>
              <th style={thStyle}>纬度</th>
            </tr>
          </thead>
          <tbody>
            {pois.map(p => (
              <tr key={p.id}>
                <td style={tdStyle}>{p.name}</td>
                <td style={tdStyle}>{p.category}</td>
                <td style={tdStyle}>{p.address}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{p.lng.toFixed(4)}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{p.lat.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
