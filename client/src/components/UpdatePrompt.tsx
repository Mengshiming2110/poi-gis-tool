import React, { useState } from 'react';

interface Props {
  version: string;
  url: string;
  body: string;
  downloadUrl?: string;
  onDismiss: () => void;
}

type DlState = 'idle' | 'downloading' | 'done' | 'error';

function UpdatePrompt({ version, url, body, downloadUrl, onDismiss }: Props) {
  const [dlState, setDlState] = useState<DlState>('idle');
  const [dlProgress, setDlProgress] = useState(0);
  const [dlError, setDlError] = useState('');
  const [blobData, setBlobData] = useState<Uint8Array | null>(null);

  const handleDownload = async () => {
    if (!downloadUrl || dlState === 'downloading') return;
    setDlState('downloading');
    setDlProgress(0);
    setDlError('');

    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as any);
        received += value.length;
        if (total > 0) setDlProgress(Math.round((received / total) * 100));
      }

      // Merge chunks
      const totalLength = chunks.reduce((s, c) => s + c.length, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const c of chunks) { merged.set(c, offset); offset += c.length; }

      setBlobData(merged);
      setDlState('done');
      setDlProgress(100);
    } catch (e: any) {
      setDlState('error');
      setDlError(e?.message || '下载失败');
    }
  };

  const handleInstall = async () => {
    if (!blobData) return;
    const filename = `POI数据采集工具-Setup-${version}.exe`;

    // Electron: use IPC to save + open the installer
    if (window.electronAPI) {
      try {
        // Convert Uint8Array to base64 string for IPC transfer
        let binary = '';
        for (let i = 0; i < blobData.length; i++) {
          binary += String.fromCharCode(blobData[i]);
        }
        const base64 = btoa(binary);
        await window.electronAPI.saveAndOpenInstaller(base64, filename);
        onDismiss();
        return;
      } catch {
        // Fall through to browser download
      }
    }

    // Browser fallback: trigger download
    const blob = new Blob([blobData as any], { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    onDismiss();
  };

  const button = (label: string, onClick: () => void, primary: boolean) => (
    <button onClick={onClick} style={{
      flex: 1, padding: '12px 0', borderRadius: 10,
      border: primary ? 'none' : '1.5px solid #e2e8f0',
      background: primary ? (label.includes('安装') ? '#16a34a' : '#3b82f6') : '#fff',
      color: primary ? '#fff' : '#475569',
      fontSize: 14, fontWeight: 600, cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={dlState === 'downloading' ? undefined : () => { if (dlState !== 'done') onDismiss(); }}>
      <div style={{
        background: '#fff', borderRadius: 16, maxWidth: 400, width: '100%',
        padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Title */}
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {dlState === 'done' ? '✅ 下载完成'
            : dlState === 'error' ? '❌ 下载失败'
            : dlState === 'downloading' ? '⬇ 正在下载'
            : '🆕 新版本可用'}
        </div>
        <div style={{ fontSize: 16, color: '#3b82f6', fontWeight: 600, marginBottom: 8 }}>
          {version}
        </div>

        {/* Release notes (idle only) */}
        {body && dlState === 'idle' && (
          <div style={{
            fontSize: 13, color: '#64748b', marginBottom: 14,
            whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto',
            background: '#f8fafc', padding: 10, borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}>{body}</div>
        )}

        {/* Download progress */}
        {dlState === 'downloading' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
              正在下载安装包... {dlProgress}%
            </div>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${dlProgress}%`,
                background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                borderRadius: 3, transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}

        {/* Done: ask install */}
        {dlState === 'done' && (
          <div style={{ marginBottom: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📦</div>
            <div style={{ fontSize: 13, color: '#475569' }}>
              安装包已就绪，是否立即安装更新？
            </div>
          </div>
        )}

        {/* Error state */}
        {dlState === 'error' && (
          <div style={{ marginBottom: 14, fontSize: 13, color: '#dc2626' }}>
            下载失败：{dlError}
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                前往 GitHub Releases 手动下载 →
              </a>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {dlState === 'idle' && (
            <>
              {button('稍后', onDismiss, false)}
              {button(downloadUrl ? '立即下载' : '去下载', handleDownload, true)}
            </>
          )}
          {dlState === 'downloading' && (
            button('后台下载', onDismiss, false)
          )}
          {dlState === 'done' && (
            <>
              {button('稍后安装', onDismiss, false)}
              {button('立即安装', handleInstall, true)}
            </>
          )}
          {dlState === 'error' && (
            button('关闭', onDismiss, false)
          )}
        </div>
      </div>
    </div>
  );
}

export default UpdatePrompt;
