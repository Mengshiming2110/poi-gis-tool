import React, { useEffect, useState } from 'react';
import StepIndicator from './StepIndicator';
import StepCategories from './StepCategories';
import StepDraw from './StepDraw';
import StepGrid from './StepGrid';
import StepCollect from './StepCollect';
import StepResults from './StepResults';
import { useAmap, type DrawnShape } from '../../hooks/useAmap';
import { CATEGORY_LIST } from '../../types/poi';

const STEP_TITLES = ['选择目标', '圈定区域', '采集精度', '获取数据', '保存结果'];

const STEP_HINTS = [
  '选择要采集的 POI 类型',
  '在地图上圈出要分析的范围',
  '选择采集精度并生成网格',
  '正在获取 POI，缓存会自动复用',
  '同步到桌面端或导出数据',
];

function MobileApp() {
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [poiData, setPoiData] = useState<any[]>([]);
  const [locating, setLocating] = useState(false);

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
      <div className="mobile-topbar">
        <div>
          <div className="mobile-kicker">POI 地图工作台</div>
          <div className="mobile-title">{STEP_TITLES[step - 1]}</div>
        </div>
        <div className="mobile-status-pill">
          {categories.length} 类 · {amap.gridCells.length} 格
        </div>
      </div>
      <StepIndicator current={step} onStepClick={setStep} />
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
            <div>
              <div className="mobile-sheet-title">{STEP_TITLES[step - 1]}</div>
              <div className="mobile-sheet-subtitle">{STEP_HINTS[step - 1]}</div>
            </div>
            {step > 1 && selectedNames.length > 0 && (
              <div className="mobile-mini-summary">
                {selectedNames.slice(0, 2).join('、')}{selectedNames.length > 2 ? `等 ${selectedNames.length} 类` : ''}
              </div>
            )}
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
    </div>
  );
}

export default MobileApp;
