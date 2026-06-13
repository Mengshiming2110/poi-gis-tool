import React from 'react';

const STEPS = ['类别', '区域', '网格', '采集', '结果'];

interface Props {
  current: number;
  onStepClick: (step: number) => void;
}

function StepIndicator({ current, onStepClick }: Props) {
  return (
    <div className="step-indicator">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              cursor: i + 1 < current ? 'pointer' : 'default',
            }}
            onClick={() => { if (i + 1 < current) onStepClick(i + 1); }}
          >
            <div
              className="step-dot"
              style={{
                background: i + 1 === current ? '#3b82f6' : i + 1 < current ? '#22c55e' : '#e2e8f0',
                width: i + 1 === current ? 14 : 10,
                height: i + 1 === current ? 14 : 10,
              }}
            />
            <span
              className="step-label"
              style={{
                color: i + 1 === current ? '#3b82f6' : i + 1 < current ? '#22c55e' : '#cbd5e1',
                fontWeight: i + 1 === current ? 700 : 400,
              }}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="step-line" style={{ background: i + 1 < current ? '#22c55e' : '#e2e8f0' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default StepIndicator;
