import React from 'react';
import { CATEGORY_LIST } from '../../types/poi';

interface Props {
  pois: any[];
  onRestart: () => void;
}

// Build color lookup
const CATEGORY_COLORS: Record<string, string> = {};
CATEGORY_LIST.forEach((c) => { CATEGORY_COLORS[c.name] = c.color; });

function StepResults({ pois, onRestart }: Props) {
  const exportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      features: pois.map((p: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { name: p.name, category: p.category, address: p.address },
      })),
    };
    const blob = new Blob([JSON.stringify(geojson)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pois.geojson'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px', borderBottom: '1px solid #e2e8f0',
      }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>采集结果 ({pois.length})</span>
        <button className="mobile-btn mobile-btn-primary" style={{ padding: '8px 16px', fontSize: 13, width: 'auto' }}
          onClick={exportGeoJSON}
          disabled={pois.length === 0}>
          GeoJSON
        </button>
      </div>
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
                {p.category}{p.address ? ' · ' + p.address : ''}
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
