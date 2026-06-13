import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  GearSix,
  MapTrifold,
  SlidersHorizontal,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import StepCategories from './StepCategories';
import StepDraw from './StepDraw';
import StepGrid from './StepGrid';
import StepCollect from './StepCollect';
import StepResults from './StepResults';
import MobileSettings from './MobileSettings';
import UpdatePrompt from '../UpdatePrompt';
import { useAmap, type DrawnShape } from '../../hooks/useAmap';
import { checkForUpdate, type UpdateInfo } from '../../services/updater';
import { CATEGORY_LIST } from '../../types/poi';

type MobileTab = 'map' | 'data' | 'progress' | 'settings';

const TAB_META: Record<MobileTab, { label: string; icon: React.ReactNode }> = {
  map: { label: '地图', icon: <MapTrifold size={22} /> },
  data: { label: '数据', icon: <Database size={22} /> },
  progress: { label: '进度', icon: <ClockCounterClockwise size={22} /> },
  settings: { label: '设置', icon: <GearSix size={22} /> },
};

const MOBILE_TITLES: Record<MobileTab, string> = {
  map: '地图工作台',
  data: '数据浏览',
  progress: '拉取进度',
  settings: '系统设置',
};

function MobileApp() {
  const [tab, setTab] = useState<MobileTab>('map');
  const [configOpen, setConfigOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [poiData, setPoiData] = useState<any[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const amap = useAmap('mobile-map');

  useEffect(() => {
    checkForUpdate().then((info) => { if (info.available) setUpdateInfo(info); });
  }, []);

  useEffect(() => {
    if (tab === 'map' && amap.map) {
      setTimeout(() => {
        try { amap.map.resize(); } catch (e) {}
      }, 100);
    }
  }, [tab, amap.map]);

  const selectedNames = useMemo(() => CATEGORY_LIST
    .filter((c) => categories.includes(c.code))
    .map((c) => c.name), [categories]);

  const canCollect = categories.length > 0 && !!drawnShape && amap.gridCells.length > 0 && !collecting;
  const estimatedRequests = amap.gridCells.length * Math.max(categories.length, 1) * Number(localStorage.getItem('amap_max_pages_per_query') || '2');
  const estimatedPois = amap.gridCells.length * Math.max(categories.length, 1) * 8;

  const handleLocate = async () => {
    setLocating(true);
    await amap.locateMe();
    setLocating(false);
  };

  const startCollect = () => {
    if (!canCollect) return;
    setConfigOpen(false);
    setCollecting(true);
    setTab('progress');
  };

  const restart = () => {
    setPoiData([]);
    setCategories([]);
    setDrawnShape(null);
    setCollecting(false);
    amap.clearDrawings();
    setTab('map');
    setConfigOpen(true);
  };

  const configSummary = categories.length > 0
    ? `${selectedNames.slice(0, 2).join('、')}${selectedNames.length > 2 ? `等 ${selectedNames.length} 类` : ''}`
    : '未选分类';

  return (
    <div className="mobile-app">
      <div className="mobile-statusbar product-titlebar">
        <span className="t">{MOBILE_TITLES[tab]}</span>
        <span className="badge badge-accent">v2.2.0</span>
      </div>

      <div className="mobile-screens">
        <section className={`mobile-screen ${tab === 'map' ? 'active' : ''}`}>
          <div className="mobile-map-wrap">
            <div id="mobile-map" className="mobile-real-map" />

            <div className="mobile-map-fab top">
              <button className="mobile-fab" onClick={() => amap.map?.zoomIn?.()} title="放大">
                +
              </button>
              <button className="mobile-fab" onClick={() => amap.map?.zoomOut?.()} title="缩小">
                −
              </button>
              <button className="mobile-fab" onClick={handleLocate} disabled={locating} title="定位当前位置">
                {locating ? '…' : '⌖'}
              </button>
            </div>

            <div className="mobile-map-fab bottom">
              <button className="mobile-fab accent" onClick={() => setConfigOpen(true)} title="区域与类型配置">
                <SlidersHorizontal size={18} />
              </button>
            </div>

            <div className="mobile-legend">
              <span><span className="dot pending" />待拉取</span>
              <span><span className="dot done" />已拉取</span>
            </div>
          </div>

          <div className={`mobile-sheet-overlay ${configOpen ? 'show' : ''}`} onClick={() => setConfigOpen(false)} />
          <div className={`mobile-sheet ${configOpen ? 'show' : ''}`}>
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-title">区域 & 类型配置</div>
            <div className="mobile-sheet-body">
              <div className="mobile-config-section">
                <h4>圈选工具</h4>
                <StepDraw
                  loaded={amap.loaded}
                  drawnShape={drawnShape}
                  setDrawMode={amap.setDrawMode}
                  clearDrawings={amap.clearDrawings}
                  getDrawnShape={amap.getDrawnShape}
                  onShapeChange={setDrawnShape}
                />
              </div>

              <div className="mobile-config-section">
                <h4>POI 分类</h4>
                <StepCategories selected={categories} onChange={setCategories} />
              </div>

              <div className="mobile-config-section">
                <h4>采集网格</h4>
                <StepGrid
                  loaded={amap.loaded}
                  drawnShape={drawnShape}
                  gridCells={amap.gridCells}
                  splitGrid={amap.splitGrid}
                />
              </div>

              <div className="mobile-config-section">
                <h4>目标区域</h4>
                <select className="mobile-select" value={drawnShape ? '区域 A — 当前圈选' : '请先圈选区域'} disabled>
                  <option>{drawnShape ? '区域 A — 当前圈选' : '请先圈选区域'}</option>
                </select>
              </div>
              <div className="mobile-cfg-row">
                <span className="lbl">已选分类</span>
                <span className="val">{configSummary}</span>
              </div>
              <div className="mobile-cfg-row">
                <span className="lbl">搜索半径</span>
                <span className="val">{Number(localStorage.getItem('amap_search_radius') || '1000').toLocaleString()}m</span>
              </div>
              <div className="mobile-cfg-row">
                <span className="lbl">预估请求次数</span>
                <span className="val">~{estimatedRequests || 0} 次</span>
              </div>
              <div className="mobile-cfg-row">
                <span className="lbl">预估 POI 数量</span>
                <span className="val">~{estimatedPois || 0} 条</span>
              </div>
              <div className="mobile-cfg-preview">
                types={categories.join('|') || '未选择'} · cells={amap.gridCells.length || 0}
              </div>

              <button className="mobile-btn primary" onClick={startCollect} disabled={!canCollect}>
                {collecting ? '采集中' : '开始拉取 POI 数据'}
              </button>
            </div>
          </div>
        </section>

        <section className={`mobile-screen ${tab === 'data' ? 'active' : ''}`}>
          <StepResults pois={poiData} categories={categories} onRestart={restart} />
        </section>

        <section className={`mobile-screen ${tab === 'progress' ? 'active' : ''}`}>
          {collecting ? (
            <StepCollect
              categories={categories}
              gridCells={amap.gridCells}
              collectPOIsClientSide={amap.collectPOIsClientSide}
              stopCollecting={amap.stopCollecting}
              onComplete={(pois: any[]) => {
                setPoiData(pois);
                setCollecting(false);
                setTab('data');
              }}
            />
          ) : (
            <div className="mobile-progress-empty">
              <div className="stat-mini-row">
                <div className="stat-mini"><div className="v">{poiData.length || estimatedPois}</div><div className="l">总数</div></div>
                <div className="stat-mini accent"><div className="v">{poiData.length}</div><div className="l">已拉取 {poiData.length && estimatedPois ? Math.round((poiData.length / estimatedPois) * 100) : 0}%</div></div>
                <div className="stat-mini"><div className="v">{Math.max(estimatedPois - poiData.length, 0)}</div><div className="l">待拉取</div></div>
                <div className="stat-mini warn"><div className="v">0</div><div className="l">重复</div></div>
              </div>
              <div className="progress-card">
                <h4>区域 A — 当前圈选<span className="pct">{amap.gridCells.length}/{Math.max(amap.gridCells.length, 1)} · {poiData.length > 0 ? '100' : '0'}%</span></h4>
                <div className="progress-track"><div className="progress-fill" style={{ width: poiData.length > 0 ? '100%' : '0%' }} /></div>
                <div className="progress-mini-list">
                  <div><span>网格单元</span><b>{amap.gridCells.length || 0}</b></div>
                  <div><span>POI 分类</span><b>{categories.length || 0}</b></div>
                  <div><span>预估请求</span><b>{estimatedRequests || 0}</b></div>
                </div>
              </div>
              <div className="progress-card">
                <h4>最近结果<span className="pct">{poiData.length > 0 ? '已完成' : '空闲'}</span></h4>
                <div className="progress-mini-list">
                  <div><span>已保存 POI</span><b>{poiData.length}</b></div>
                  <div><span>同步状态</span><b>{poiData.length > 0 ? '待同步' : '无数据'}</b></div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className={`mobile-screen ${tab === 'settings' ? 'active' : ''}`}>
          <div className="settings-screen">
            <div className="set-card">
              <h4>高德开放平台 API</h4>
              <label className="set-field">
                <span>API KEY (WEB服务)</span>
                <input type="password" value="••••••••••••••••••••••••" readOnly />
              </label>
              <label className="set-field">
                <span>API KEY (JS API)</span>
                <input value={localStorage.getItem('amap_js_key') || ''} placeholder="输入高德 JS API Key" readOnly />
              </label>
              <div className="setting-row"><span>使用代理转发</span><b className="switch on" /></div>
              <button className="mobile-btn primary" onClick={() => setSettingsOpen(true)}>打开 API 设置</button>
            </div>
            <div className="set-card">
              <h4>采集参数</h4>
              <div className="setting-row"><span>POI 类型范围</span><b>全部类型</b></div>
              <div className="setting-row"><span>搜索半径</span><b>{Number(localStorage.getItem('amap_search_radius') || '1000').toLocaleString()}m</b></div>
              <div className="setting-row"><span>单次请求上限</span><b>25 条</b></div>
              <div className="setting-row"><span>请求间隔</span><b>500ms</b></div>
              <div className="setting-row"><span>自动跳过重复</span><b className="switch on" /></div>
              <div className="setting-row"><span>拉取完自动上传</span><b className="switch" /></div>
            </div>
            <div className="set-card">
              <h4>版本管理</h4>
              <div className="update-row">
                <span className="vnow">v2.2.0</span>
                <span className="ustat">{updateInfo ? `发现 ${updateInfo.version}` : '已是最新'}</span>
              </div>
              <button
                className="mobile-btn"
                onClick={() => checkForUpdate().then((info) => { if (info.available) setUpdateInfo(info); })}
              >
                检查更新
              </button>
              <div className="version-list">
                <div><b>v2.2.0</b><span>新增检查更新功能</span><em>06-13</em></div>
                <div><b>v2.1.0</b><span>按区域分组存储、重复检测优化</span><em>06-10</em></div>
                <div><b>v2.0.3</b><span>修复坐标偏移、暗色适配</span><em>05-28</em></div>
                <div><b>v2.0.0</b><span>重构采集引擎、Excel 导出</span><em>05-15</em></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <nav className="mobile-tab-bar">
        {(Object.keys(TAB_META) as MobileTab[]).map((key) => (
          <button key={key} className={`mobile-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {TAB_META[key].icon}
            <span>{TAB_META[key].label}</span>
          </button>
        ))}
      </nav>

      <MobileSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {updateInfo && (
        <UpdatePrompt
          version={updateInfo.version}
          url={updateInfo.url}
          body={updateInfo.body}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}
    </div>
  );
}

export default MobileApp;
