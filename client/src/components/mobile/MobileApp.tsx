import React, { useState, useEffect } from 'react';
import MobileMapTab from './MobileMapTab';
import MobileDataTab from './MobileDataTab';
import MobileProgressTab from './MobileProgressTab';
import MobileSettingsTab from './MobileSettingsTab';
import UpdatePrompt from '../UpdatePrompt';
import { useAmap, type DrawnShape } from '../../hooks/useAmap';
import { checkForUpdate, type UpdateInfo } from '../../services/updater';

const TABS = [
  { id: 'map', label: '地图' },
  { id: 'data', label: '数据' },
  { id: 'progress', label: '进度' },
  { id: 'settings', label: '设置' },
] as const;

type TabId = typeof TABS[number]['id'];

function MobileApp() {
  const [tab, setTab] = useState<TabId>('map');
  const [categories, setCategories] = useState<string[]>([]);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [poiData, setPoiData] = useState<any[]>([]);
  const [locating, setLocating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [collectStatus, setCollectStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [collectProgress, setCollectProgress] = useState({ done: 0, total: 0, pois: 0 });

  const amap = useAmap('mobile-map');

  useEffect(() => {
    checkForUpdate().then((info) => { if (info.available) setUpdateInfo(info); });
  }, []);

  useEffect(() => {
    if ((tab === 'map') && amap.map) {
      setTimeout(() => { try { amap.map.resize(); } catch (e) {} }, 100);
    }
  }, [tab, amap.map]);

  const handleLocate = async () => {
    setLocating(true);
    await amap.locateMe();
    setLocating(false);
  };

  const handleCollectComplete = (pois: any[]) => {
    setPoiData(pois);
    setCollectStatus('done');
  };

  return (
    <div className="mobile-app">
      {/* Status bar */}
      <div className="mobile-statusbar">
        <span className="t">
          {tab === 'map' ? '地图工作台' : tab === 'data' ? '数据浏览' : tab === 'progress' ? '拉取进度' : '系统设置'}
        </span>
        <span className="badge badge-accent">v1.0.0</span>
      </div>

      {/* Screens */}
      <div className="mobile-screens">
        <div className={`mobile-screen ${tab === 'map' ? 'active' : ''}`}>
          <MobileMapTab
            amap={amap}
            categories={categories}
            onCategoriesChange={setCategories}
            drawnShape={drawnShape}
            onShapeChange={setDrawnShape}
            locating={locating}
            onLocate={handleLocate}
            onCollectStart={() => { setCollectStatus('running'); setCollectProgress({ done: 0, total: 0, pois: 0 }); }}
            onCollectProgress={(d, t, p) => setCollectProgress({ done: d, total: t, pois: p })}
            onCollectComplete={handleCollectComplete}
          />
        </div>

        <div className={`mobile-screen ${tab === 'data' ? 'active' : ''}`}>
          <MobileDataTab pois={poiData} />
        </div>

        <div className={`mobile-screen ${tab === 'progress' ? 'active' : ''}`}>
          <MobileProgressTab status={collectStatus} progress={collectProgress} />
        </div>

        <div className={`mobile-screen ${tab === 'settings' ? 'active' : ''}`}>
          <MobileSettingsTab />
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <nav className="mobile-tab-bar">
        <button className={`mobile-tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
          <span>地图</span>
        </button>
        <button className={`mobile-tab ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v5c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 11v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5"/></svg>
          <span>数据</span>
        </button>
        <button className={`mobile-tab ${tab === 'progress' ? 'active' : ''}`} onClick={() => setTab('progress')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          <span>进度</span>
        </button>
        <button className={`mobile-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4"/></svg>
          <span>设置</span>
        </button>
      </nav>

      {updateInfo && (
        <UpdatePrompt version={updateInfo.version} url={updateInfo.url} body={updateInfo.body} onDismiss={() => setUpdateInfo(null)} />
      )}
    </div>
  );
}

export default MobileApp;
