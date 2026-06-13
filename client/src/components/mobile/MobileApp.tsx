import React, { useEffect, useState } from 'react';
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

const PANEL_COPY = [
  { title: '想采集什么？', hint: '选择目标类型，少选类别能节省 API 调用。' },
  { title: '圈一个范围', hint: '选择绘制方式后，直接在地图上操作。' },
  { title: '设置采集精度', hint: '先用省额度或均衡，确认范围后再细化。' },
  { title: '正在获取 POI', hint: '缓存会自动复用，触发限额会立即停止。' },
  { title: '数据已准备好', hint: '同步到桌面端，或分享导出文件。' },
];

function MobileApp() {
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [poiData, setPoiData] = useState<any[]>([]);
  const [locating, setLocating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkForUpdate().then((info) => { if (info.available) setUpdateInfo(info); });
  }, []);

  // Single shared map instance for steps 2-3
  const amap = useAmap('mobile-map');

  useEffect(() => {
    if ((step === 2 || step === 3) && amap.map) {
      setTimeout(() => {
        try { amap.map.resize(); } catch (e) {}
      }, 100);
    }
  }, [step, amap.map]);

  const handleLocate = async () => {
    setLocating(true);
    const ok = await amap.locateMe();
    setLocating(false);
    if (!ok) {
      // Could show a toast here
    }
  };

  const canNext = () => {
    if (step === 1) return categories.length > 0;
    if (step === 2) return !!drawnShape;
    if (step === 3) return amap.gridCells.length > 0;
    return true;
  };

  const next = () => { if (canNext() && step < 5) setStep((s) => s + 1); };
  const prev = () => { if (step > 1) setStep((s) => s - 1); };

  const selectedNames = CATEGORY_LIST
    .filter((c) => categories.includes(c.code))
    .map((c) => c.name);

  const primaryLabel = () => {
    if (step === 1) return categories.length > 0 ? '去圈定区域' : '先选择类别';
    if (step === 2) return drawnShape ? '确认区域' : '先画区域';
    if (step === 3) return amap.gridCells.length > 0 ? '开始获取 POI' : '先生成网格';
    return '下一步';
  };

  const restart = () => {
    setStep(1); setPoiData([]); setCategories([]);
    setDrawnShape(null);
    amap.clearDrawings();
  };

  return (
    <div className="mobile-app">
      <div className="mobile-body">
        <div id="mobile-map" style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }} />

        {(step === 2 || step === 3) && (
          <button
            onClick={handleLocate}
            disabled={locating}
            title="定位到当前位置"
            className="mobile-locate-btn"
          >
            {locating ? '⟳' : '⌖'}
          </button>
        )}

        <div className={`mobile-sheet ${step >= 4 ? 'mobile-sheet-tall' : ''}`}>
          <div className="mobile-sheet-handle" />
          <div className="mobile-sheet-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div className="mobile-sheet-title">{PANEL_COPY[step - 1].title}</div>
                <div className="mobile-sheet-subtitle">{PANEL_COPY[step - 1].hint}</div>
              </div>
              {step > 1 && selectedNames.length > 0 && (
                <div className="mobile-mini-summary">
                  {selectedNames.slice(0, 2).join('、')}{selectedNames.length > 2 ? `等 ${selectedNames.length} 类` : ''}
                </div>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                style={{
                  border: 'none', background: '#f1f5f9', borderRadius: '50%',
                  width: 36, height: 36, fontSize: 18, cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >⚙</button>
            </div>
          </div>

          <div className="mobile-sheet-content">
            {step === 1 && <StepCategories selected={categories} onChange={setCategories} />}

            {step === 2 && (
              <StepDraw
                loaded={amap.loaded}
                drawnShape={drawnShape}
                setDrawMode={amap.setDrawMode}
                clearDrawings={amap.clearDrawings}
                getDrawnShape={amap.getDrawnShape}
                onShapeChange={setDrawnShape}
              />
            )}

            {step === 3 && (
              <StepGrid
                loaded={amap.loaded}
                drawnShape={drawnShape}
                gridCells={amap.gridCells}
                splitGrid={amap.splitGrid}
              />
            )}

            {step === 4 && (
              <StepCollect
                categories={categories}
                gridCells={amap.gridCells}
                collectPOIsClientSide={amap.collectPOIsClientSide}
                stopCollecting={amap.stopCollecting}
                onComplete={(pois: any[]) => { setPoiData(pois); setStep(5); }}
              />
            )}

            {step === 5 && <StepResults pois={poiData} categories={categories} onRestart={restart} />}
          </div>

          {step < 4 && (
            <div className="mobile-action-row">
              {step > 1 && (
                <button className="mobile-btn mobile-btn-secondary" onClick={prev}>返回</button>
              )}
              <button className="mobile-btn mobile-btn-primary" disabled={!canNext()} onClick={next}>
                {primaryLabel()}
              </button>
            </div>
          )}
        </div>
      </div>

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
