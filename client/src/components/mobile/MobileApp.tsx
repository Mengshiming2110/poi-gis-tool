import React, { useState } from 'react';
import StepIndicator from './StepIndicator';
import StepCategories from './StepCategories';
import StepDraw from './StepDraw';
import StepGrid from './StepGrid';
import StepCollect from './StepCollect';
import StepResults from './StepResults';
import { useAmap, type DrawnShape, type GridCell } from '../../hooks/useAmap';

function MobileApp() {
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [poiData, setPoiData] = useState<any[]>([]);

  // Single shared map instance for steps 2-3
  const amap = useAmap('mobile-map');

  const canNext = () => {
    if (step === 1) return categories.length > 0;
    if (step === 2) return !!drawnShape;
    if (step === 3) return gridCells.length > 0;
    return true;
  };

  const next = () => { if (canNext() && step < 5) setStep((s) => s + 1); };
  const prev = () => { if (step > 1) setStep((s) => s - 1); };

  const restart = () => {
    setStep(1); setPoiData([]); setCategories([]);
    setDrawnShape(null); setGridCells([]);
    amap.clearDrawings();
  };

  return (
    <div className="mobile-app">
      <StepIndicator current={step} onStepClick={setStep} />

      <div className="mobile-body">
        {/* Map div always present for steps 2-3, hidden otherwise */}
        <div id="mobile-map" style={{
          width: '100%', height: '100%',
          display: (step === 2 || step === 3) ? 'block' : 'none',
        }} />

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
            gridCells={gridCells}
            splitGrid={amap.splitGrid}
            onGridChange={setGridCells}
          />
        )}

        {/* Step 4: Collection */}
        {step === 4 && (
          <StepCollect
            categories={categories}
            gridCells={gridCells}
            onComplete={(pois: any[]) => { setPoiData(pois); setStep(5); }}
          />
        )}

        {/* Step 5: Results */}
        {step === 5 && <StepResults pois={poiData} onRestart={restart} />}
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
