import React, { useState, useEffect } from 'react';

// Key name used by useAmap.ts: 'amap_rest_key'
const STORAGE_REST_KEY = 'amap_rest_key';
const DEFAULT_REST_KEY = '';

const STORAGE_JS_KEY = 'amap_js_key';
const DEFAULT_JS_KEY = '';

const STORAGE_SECURITY = 'amap_security_code';
const DEFAULT_SECURITY = '';

function load() {
  return {
    restKey: localStorage.getItem(STORAGE_REST_KEY) || '',
    jsKey: localStorage.getItem(STORAGE_JS_KEY) || DEFAULT_JS_KEY,
    securityCode: localStorage.getItem(STORAGE_SECURITY) || DEFAULT_SECURITY,
  };
}

function save(restKey: string, jsKey: string, securityCode: string) {
  const nextRestKey = restKey.trim();
  const nextJsKey = jsKey.trim();
  const nextSecurityCode = securityCode.trim();

  if (nextRestKey) localStorage.setItem(STORAGE_REST_KEY, nextRestKey);
  else localStorage.removeItem(STORAGE_REST_KEY);

  if (nextJsKey) localStorage.setItem(STORAGE_JS_KEY, nextJsKey);
  else localStorage.removeItem(STORAGE_JS_KEY);

  if (nextSecurityCode) localStorage.setItem(STORAGE_SECURITY, nextSecurityCode);
  else localStorage.removeItem(STORAGE_SECURITY);

  clearQuotaBlock();
}

function clearQuotaBlock() {
  localStorage.removeItem('amap_quota_block_day');
  localStorage.removeItem('amap_quota_block_key');
  localStorage.removeItem('amap_quota_block_message');
}

function getQuotaStatus(): string | null {
  const blockedDay = localStorage.getItem('amap_quota_block_day');
  const blockedKey = localStorage.getItem('amap_quota_block_key');
  const today = new Date().toISOString().slice(0, 10);
  if (blockedDay === today && blockedKey) {
    return `${blockedKey.slice(0, 8)}... 今日已用尽`;
  }
  return null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function MobileSettings({ open, onClose }: Props) {
  const [restKey, setRestKey] = useState('');
  const [jsKey, setJsKey] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const s = load();
      setRestKey(s.restKey);
      setJsKey(s.jsKey);
      setSecurityCode(s.securityCode);
      setSaved(false);
      setQuotaStatus(getQuotaStatus());
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    save(restKey, jsKey, securityCode);
    setQuotaStatus(getQuotaStatus());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearQuota = () => {
    clearQuotaBlock();
    setQuotaStatus(null);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
    marginBottom: 12,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 480, background: '#fff',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '20px 16px 32px', maxHeight: '85vh', overflowY: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 16,
        }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>API 设置</span>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', fontSize: 24,
            cursor: 'pointer', color: '#94a3b8', padding: '0 4px',
          }}>✕</button>
        </div>

        {/* Quota status */}
        {quotaStatus && (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: '#fef2f2', border: '1px solid #fecaca',
            marginBottom: 14, fontSize: 13, color: '#dc2626',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>⚠️ {quotaStatus}</span>
            <button onClick={handleClearQuota} style={{
              border: 'none', background: '#fee2e2', color: '#dc2626',
              padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            }}>清除</button>
          </div>
        )}

        <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>
          Web服务 Key（采集用）
        </label>
        <input
          type="text" style={inputStyle}
          value={restKey}
          onChange={(e) => setRestKey(e.target.value)}
          placeholder="输入高德 Web 服务 Key"
        />

        <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>
          JS API Key（地图用）
        </label>
        <input
          type="text" style={inputStyle}
          value={jsKey}
          onChange={(e) => setJsKey(e.target.value)}
          placeholder={DEFAULT_JS_KEY}
        />

        <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>
          安全密钥
        </label>
        <input
          type="text" style={inputStyle}
          value={securityCode}
          onChange={(e) => setSecurityCode(e.target.value)}
          placeholder={DEFAULT_SECURITY}
        />

        <button
          className="mobile-btn mobile-btn-primary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={handleSave}
        >
          {saved ? '✅ 已保存' : '保存设置'}
        </button>

        <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          采集使用 Web服务 Key，地图显示使用 JS API Key。<br />
          去 <a href="https://console.amap.com/dev/key/app" target="_blank" style={{ color: '#3b82f6' }}>高德开放平台</a> 申请
        </div>
      </div>
    </div>
  );
}

export default MobileSettings;
