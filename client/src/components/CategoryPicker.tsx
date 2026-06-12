import { useState, useMemo } from 'react';
import { MagnifyingGlass, CaretDown, CaretUp, Check } from '@phosphor-icons/react';
import { CATEGORY_LIST } from '../types/poi';

interface CategoryPickerProps {
  selected: string[];
  onChange: (codes: string[]) => void;
}

function CategoryPicker({ selected, onChange }: CategoryPickerProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return CATEGORY_LIST;
    return CATEGORY_LIST.filter(c => c.name.includes(search));
  }, [search]);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter(c => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const selectAll = () => onChange(CATEGORY_LIST.map(c => c.code));
  const clearAll = () => onChange([]);

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 8 }}>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <MagnifyingGlass size={14} color="#94a3b8" style={{ position: 'absolute', left: 8, top: 6 }} />
        <input
          type="text"
          placeholder="搜索类别..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '5px 8px 5px 26px',
            border: '1px solid #e2e8f0', borderRadius: 4,
            fontSize: 12, boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      {/* Tag cloud */}
      <div style={{ marginBottom: 6 }}>
        {filtered.map(c => (
          <button
            key={c.code}
            onClick={() => toggle(c.code)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              padding: '3px 8px', borderRadius: 12, fontSize: 11,
              cursor: 'pointer', border: 'none',
              background: selected.includes(c.code) ? '#3b82f6' : '#f1f5f9',
              color: selected.includes(c.code) ? '#fff' : '#475569',
              margin: '2px 3px 2px 0',
            }}
            type="button"
          >
            {selected.includes(c.code) && <Check size={10} weight="bold" />}
            {c.name}
          </button>
        ))}
      </div>

      {/* Expanded list */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #e2e8f0', paddingTop: 6, marginBottom: 6,
          maxHeight: 160, overflowY: 'auto',
        }}>
          {CATEGORY_LIST.map(c => (
            <label key={c.code} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 0', fontSize: 12, color: '#475569', cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={selected.includes(c.code)}
                onChange={() => toggle(c.code)}
                style={{ accentColor: '#3b82f6' }}
              />
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, display: 'inline-block' }} />
              {c.name}
            </label>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>已选 {selected.length} 项</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={selectAll}
            style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: '#475569' }}>
            全选
          </button>
          <button type="button" onClick={clearAll}
            style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: '#475569' }}>
            清空
          </button>
          <button type="button" onClick={() => setExpanded(!expanded)}
            style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: 2 }}>
            {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
            {expanded ? '收起' : '更多'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CategoryPicker;
