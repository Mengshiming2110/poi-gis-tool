import React, { useState } from 'react';
import StepIndicator from './StepIndicator';
import StepCategories from './StepCategories';
import StepDraw from './StepDraw';
import StepGrid from './StepGrid';
import StepCollect from './StepCollect';
import StepResults from './StepResults';
import type { DrawnShape, GridCell } from '../../hooks/useAmap';

function MobileApp() {
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [poiData, setPoiData] = useState<any[]>([]);

  const canNext = () => {
    if (step === 1) return categories.length > 0;
    if (step === 2) return !!drawnShape;
    if (step === 3) return gridCells.length > 0;
    return true;
  };

  const next = () => { if (canNext() && step < 5) setStep((s) => s + 1); };
  const prev = () => { if (step > 1) setStep((s) => s - 1); };

  const restart = () => {
    setStep(1);
    setPoiData([]);
    setCategories([]);
    setDrawnShape(null);
    setGridCells([]);
  };

  return (
    <div className="mobile-app">
      <StepIndicator current={step} onStepClick={setStep} />

      <div className="mobile-body">
        {step === 1 && <StepCategories selected={categories} onChange={setCategories} />}
        {step === 2 && <StepDraw drawnShape={drawnShape} onShapeChange={setDrawnShape} />}
        {step === 3 && <StepGrid drawnShape={drawnShape} gridCells={gridCells} onGridChange={setGridCells} />}
        {step === 4 && (
          <StepCollect
            categories={categories}
            gridCells={gridCells}
            onComplete={(pois: any[]) => { setPoiData(pois); setStep(5); }}
          />
        )}
        {step === 5 && <StepResults pois={poiData} onRestart={restart} />}
      </div>

      {step < 4 && (
        <div className="mobile-footer">
          {step > 1 && (
            <button className="mobile-btn mobile-btn-secondary" onClick={prev}>
              上一步
            </button>
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
