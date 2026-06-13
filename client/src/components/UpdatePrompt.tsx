import React from 'react';

interface Props {
  version: string;
  url: string;
  body: string;
  onDismiss: () => void;
}

function UpdatePrompt({ version, url, body, onDismiss }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={onDismiss}>
      <div style={{
        background: '#fff', borderRadius: 16, maxWidth: 380, width: '100%',
        padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>🆕 新版本可用</div>
        <div style={{ fontSize: 16, color: '#3b82f6', fontWeight: 600, marginBottom: 8 }}>
          {version}
        </div>
        {body && (
          <div style={{
            fontSize: 13, color: '#64748b', marginBottom: 16,
            whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto',
            background: '#f8fafc', padding: 10, borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}>
            {body}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onDismiss}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10,
              border: '1.5px solid #e2e8f0', background: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            稍后
          </button>
          <a
            href={url}
            target="_blank" rel="noopener noreferrer"
            onClick={onDismiss}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10,
              border: 'none', background: '#3b82f6', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              textDecoration: 'none', textAlign: 'center',
            }}
          >
            去下载
          </a>
        </div>
      </div>
    </div>
  );
}

export default UpdatePrompt;
