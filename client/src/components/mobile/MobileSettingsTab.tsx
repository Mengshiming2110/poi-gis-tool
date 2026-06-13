import React, { useState } from 'react';
import { checkForUpdate } from '../../services/updater';

const REST_KEY_STORAGE = 'amap_rest_key';
const JS_KEY_STORAGE = 'amap_js_key';
const SECURITY_STORAGE = 'amap_security_code';

function MobileSettingsTab() {
  const [restKey, setRestKey] = useState(localStorage.getItem(REST_KEY_STORAGE) || '125c253ac5c0c03f9165bc3c721d130f');
  const [jsKey, setJsKey] = useState(localStorage.getItem(JS_KEY_STORAGE) || '35f0e1144644fbfba405c109db466cdc');
  const [security, setSecurity] = useState(localStorage.getItem(SECURITY_STORAGE) || '8d13a7d3f6ecff69f02dc1dea5855b0a');
  const [saved, setSaved] = useState(false);

  const blockedDay = localStorage.getItem('amap_quota_block_day');
  const today = new Date().toISOString().slice(0, 10);
  const quotaBlocked = blockedDay === today;

  const handleSave = () => {
    localStorage.setItem(REST_KEY_STORAGE, restKey);
    localStorage.setItem(JS_KEY_STORAGE, jsKey);
    localStorage.setItem(SECURITY_STORAGE, security);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearQuota = () => {
    localStorage.removeItem('amap_quota_block_day');
    localStorage.removeItem('amap_quota_block_key');
    localStorage.removeItem('amap_quota_block_message');
    window.location.reload();
  };

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Quota warning */}
      {quotaBlocked && (
        <div style={{
          margin: '0 12px 10px', padding: '10px 12px', borderRadius: 'var(--radius)',
          background: '#fff7ed', border: '1px solid #fed7aa', fontSize: 12, color: 'var(--warn)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠ 今日配额已用完</span>
          <button onClick={handleClearQuota} style={{
            padding: '3px 10px', borderRadius: 4, border: '1px solid #fed7aa',
            background: '#fff', color: 'var(--warn)', fontSize: 11, cursor: 'pointer',
          }}>清除</button>
        </div>
      )}

      <div className="mobile-set-card">
        <h4>🔑 高德开放平台 API</h4>
        <div className="mobile-set-field">
          <label>API Key (Web 服务) · 采集用</label>
          <input className="input-field" type="password" value={restKey} onChange={e => setRestKey(e.target.value)}
            placeholder="输入高德 Web服务 Key" />
        </div>
        <div className="mobile-set-field">
          <label>API Key (JS API) · 地图用</label>
          <input className="input-field" type="text" value={jsKey} onChange={e => setJsKey(e.target.value)}
            placeholder="输入高德 JS API Key" />
        </div>
        <div className="mobile-set-field">
          <label>安全密钥</label>
          <input className="input-field" type="text" value={security} onChange={e => setSecurity(e.target.value)}
            placeholder="输入安全密钥" />
        </div>
        <button onClick={handleSave} className="mobile-btn primary" style={{ marginTop: 4 }}>
          {saved ? '✅ 已保存' : '保存设置'}
        </button>
      </div>

      <div className="mobile-set-card">
        <h4>⚙ 拉取参数</h4>
        <div className="mobile-set-row"><span>搜索半径</span><span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>1,000m</span></div>
        <div className="mobile-set-row"><span>请求间隔</span><span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>200ms</span></div>
      </div>

      <div className="mobile-set-card">
        <h4>📋 版本管理</h4>
        <div className="mobile-ver-row">
          <span className="mobile-ver-now">v1.0.0</span>
          <span className="mobile-ver-status">✓ 已是最新</span>
        </div>
        <button onClick={() => checkForUpdate()} className="mobile-btn" style={{ background: 'var(--surface)', border: '1px solid var(--border)', marginTop: 4 }}>
          🔄 检查更新
        </button>
        <ul className="mobile-ver-list" style={{ marginTop: 10 }}>
          <li><span className="ver">v2.2.0</span><span className="desc">新增检查更新 + 底部Tab导航</span><span className="dt">06-13</span></li>
          <li><span className="ver">v2.1.0</span><span className="desc">按区域分组、重复检测</span><span className="dt">06-10</span></li>
          <li><span className="ver">v2.0.0</span><span className="desc">重构采集引擎、Excel导出</span><span className="dt">05-28</span></li>
        </ul>
      </div>
    </div>
  );
}

export default MobileSettingsTab;
