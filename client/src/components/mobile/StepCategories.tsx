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
    <div className="mobile-panel-block">
      <input
        type="text"
        placeholder="搜索类别"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mobile-search-input"
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
      <div className="mobile-helper-text">
        已选 {selected.length} 个类别。建议一次选择 1-3 类，能明显节省 API 调用。
      </div>
    </div>
  );
}

export default StepCategories;
