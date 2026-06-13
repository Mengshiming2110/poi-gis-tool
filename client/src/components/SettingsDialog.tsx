import { useState, useCallback, useEffect, useRef } from 'react';
import { Gear, X } from '@phosphor-icons/react';

const STORAGE_KEYS = {
  jsKey: 'amap_js_key',
  securityCode: 'amap_security_code',
  wsKey: 'amap_rest_key',
};

const DEFAULTS = {
  jsKey: '35f0e1144644fbfba405c109db466cdc',
  securityCode: '8d13a7d3f6ecff69f02dc1dea5855b0a',
  wsKey: '',
};

function loadSettings() {
  return {
    jsKey: localStorage.getItem(STORAGE_KEYS.jsKey) || DEFAULTS.jsKey,
    securityCode: localStorage.getItem(STORAGE_KEYS.securityCode) || DEFAULTS.securityCode,
    wsKey: localStorage.getItem(STORAGE_KEYS.wsKey) || DEFAULTS.wsKey,
  };
}

function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [jsKey, setJsKey] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [wsKey, setWsKey] = useState('');
  const [changed, setChanged] = useState(false);
  const initialRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      const s = loadSettings();
      setJsKey(s.jsKey);
      setSecurityCode(s.securityCode);
      setWsKey(s.wsKey);
      initialRef.current = JSON.stringify(s);
      setChanged(false);
    }
  }, [open]);

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.jsKey, jsKey);
    localStorage.setItem(STORAGE_KEYS.securityCode, securityCode);
    localStorage.setItem(STORAGE_KEYS.wsKey, wsKey);

    const newVal = JSON.stringify({ jsKey, securityCode, wsKey });
    if (initialRef.current !== null && initialRef.current !== newVal) {
      setChanged(true);
    }
    setOpen(false);
  }, [jsKey, securityCode, wsKey]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  const fieldStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '6px 10px',
    border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13,
    outline: 'none', boxSizing: 'border-box', marginTop: 4,
  };

  return (
    <>
      {/* Gear button */}
      <button type="button" onClick={() => setOpen(true)}
        style={{
          position: 'absolute', top: 54, right: 12, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, border: 'none', borderRadius: 6,
          background: 'rgba(255,255,255,0.95)', color: '#475569',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }} title="设置">
        <Gear size={18} />
      </button>

      {/* Modal backdrop */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {/* Modal card */}
          <div onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, width: 400, maxWidth: '90%',
              padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: '#1e293b' }}>API 密钥设置</h2>
              <button type="button" onClick={() => setOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#475569' }}>JS API Key</label>
              <input type="text" value={jsKey} onChange={e => setJsKey(e.target.value)} style={fieldStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#475569' }}>安全密钥 (Security Code)</label>
              <input type="text" value={securityCode} onChange={e => setSecurityCode(e.target.value)} style={fieldStyle} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#475569' }}>Web 服务 API Key</label>
              <input type="text" value={wsKey} onChange={e => setWsKey(e.target.value)} style={fieldStyle} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setOpen(false)}
                style={{
                  padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569',
                }}>取消</button>
              <button type="button" onClick={handleSave}
                style={{
                  padding: '6px 16px', border: 'none', borderRadius: 6,
                  background: '#3b82f6', cursor: 'pointer', fontSize: 12, color: '#fff',
                }}>保存</button>
            </div>

            {changed && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#eab308', textAlign: 'center' }}>
                密钥已变更。
                <button type="button" onClick={handleReload}
                  style={{ marginLeft: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 12, textDecoration: 'underline' }}>
                  重新加载页面
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default SettingsDialog;
