import React, { useEffect, useState } from 'react';
import StepIndicator from './StepIndicator';
import StepCategories from './StepCategories';
import StepDraw from './StepDraw';
import StepGrid from './StepGrid';
import StepCollect from './StepCollect';
import StepResults from './StepResults';
import { useAmap, type DrawnShape } from '../../hooks/useAmap';

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

  const restart = () => {
    setStep(1); setPoiData([]); setCategories([]);
    setDrawnShape(null);
    amap.clearDrawings();
  };

  return (
    <div className="mobile-app">
      <StepIndicator current={step} onStepClick={setStep} />

      <div className="mobile-body">
        {/* Keep map measurable even outside map steps; AMap misbehaves if initialized in display:none. */}
        <div id="mobile-map" style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          visibility: (step === 2 || step === 3) ? 'visible' : 'hidden',
          pointerEvents: (step === 2 || step === 3) ? 'auto' : 'none',
        }} />

        {/* Locate button — overlay on map, steps 2-3 */}
        {(step === 2 || step === 3) && (
          <button
            onClick={handleLocate}
            disabled={locating}
            title="定位到当前位置"
            style={{
              position: 'absolute', bottom: 100, right: 12, zIndex: 20,
              width: 40, height: 40, borderRadius: '50%',
              border: '2px solid #fff', background: '#1e293b', color: '#fff',
              fontSize: 18, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              pointerEvents: 'auto', opacity: locating ? 0.5 : 1,
            }}
          >
            {locating ? '⟳' : '⌖'}
          </button>
        )}

        {/* Step 1: Categories */}
        {step === 1 && <StepCategories selected={categories} onChange={setCategories} />}

        {/* Step 2: Draw tools overlay */}
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

        {/* Step 3: Grid split overlay */}
        {step === 3 && (
          <StepGrid
            loaded={amap.loaded}
            drawnShape={drawnShape}
            gridCells={amap.gridCells}
            splitGrid={amap.splitGrid}
          />
        )}

        {/* Step 4: Collection */}
        {step === 4 && (
          <StepCollect
            categories={categories}
            gridCells={amap.gridCells}
            collectPOIsClientSide={amap.collectPOIsClientSide}
            stopCollecting={amap.stopCollecting}
            onComplete={(pois: any[]) => { setPoiData(pois); setStep(5); }}
          />
        )}

        {/* Step 5: Results */}
        {step === 5 && <StepResults pois={poiData} categories={categories} onRestart={restart} />}
      </div>

      {step < 4 && (
        <div className="mobile-footer">
          {step > 1 && (
            <button className="mobile-btn mobile-btn-secondary" onClick={prev}>上一步</button>
          )}
          <button className="mobile-btn mobile-btn-primary" disabled={!canNext()} onClick={next}>
            {step === 3 ? '开始采集' : '下一步'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MobileApp;
