import React, { useState, useMemo } from 'react';
import { CATEGORY_LIST } from '../../types/poi';

interface Props {
  selected: string[];
  onChange: (codes: string[]) => void;
}

function StepCategories({ selected, onChange }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return CATEGORY_LIST;
    return CATEGORY_LIST.filter((c) => c.name.includes(search));
  }, [search]);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
      <input
        type="text"
        placeholder="搜索类别..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: '14px 16px',
          border: '2px solid #e2e8f0',
          borderRadius: 12,
          fontSize: 16,
          outline: 'none',
          marginBottom: 16,
          width: '100%',
          boxSizing: 'border-box' as const,
        }}
      />
      <div className="category-cloud">
        {filtered.map((c) => (
          <div
            key={c.code}
            className={`category-card ${selected.includes(c.code) ? 'active' : ''}`}
            onClick={() => toggle(c.code)}
            style={selected.includes(c.code) ? { backgroundColor: c.color } : {}}
          >
            {c.name}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 14, color: '#94a3b8', padding: 16 }}>
        已选 {selected.length} 个类别
      </div>
    </div>
  );
}

export default StepCategories;
