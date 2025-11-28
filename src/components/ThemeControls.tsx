import React, { useId } from 'react';
import { X } from 'lucide-react';
import './ThemeControls.css';
import { colorSchemes, useThemeLab } from '../contexts/ThemeContext';

interface ThemeControlsProps {
  onClose?: () => void;
}

export const ThemeControls: React.FC<ThemeControlsProps> = ({ onClose }) => {
  const {
    tone,
    setTone,
    savedTone,
    saveTone,
    restoreTone,
    resetTone,
    initialTone,
    colorScheme,
    setColorScheme,
    closeLab,
  } = useThemeLab();
  const sliderId = useId();

  const isSaveDisabled = tone === savedTone;
  const isRestoreDisabled = tone === savedTone;
  const isResetDisabled = tone === initialTone;
  const savedToneLabel = savedTone === initialTone ? 'default' : `${savedTone}%`;

  // Valid tone values: 0%, 12%, 25%, 38%, 50%, 63%, 75%, 88%, 100%
  const validToneValues = [0, 12, 25, 38, 50, 63, 75, 88, 100];

  // Snap to nearest valid tone value
  const snapToValidTone = (value: number): number => {
    return validToneValues.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseFloat(event.target.value);
    const snappedValue = snapToValidTone(rawValue);
    setTone(snappedValue);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeLab();
    }
  };

  return (
    <div id="theme-controls" className="theme-lab">
      <div className="wrap">
        <div className="panel toolbar">
          <div className="brand">
            <span className="dot" />
            <span>Upscale Forge</span>
            <span className="muted">• Theme Lab</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="close"
            aria-label="Close theme controls"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="controls">
            <div className="seg" role="group" aria-label="Color schemes">
              {colorSchemes.map((scheme) => (
                <button
                  type="button"
                  key={scheme.value}
                  onClick={() => setColorScheme(scheme.value)}
                  aria-pressed={colorScheme === scheme.value}
                  title={scheme.description}
                >
                  {scheme.label}
                </button>
              ))}
            </div>

            <div className="slider">
              <label htmlFor={sliderId}>Tone</label>
              <div className="slider-container">
                <input
                  id={sliderId}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={tone}
                  onChange={handleSliderChange}
                  list={`${sliderId}-markers`}
                />
                <datalist id={`${sliderId}-markers`}>
                  <option value="0" label="0%"></option>
                  <option value="12" label="12%"></option>
                  <option value="25" label="25%"></option>
                  <option value="38" label="38%"></option>
                  <option value="50" label="50%"></option>
                  <option value="63" label="63%"></option>
                  <option value="75" label="75%"></option>
                  <option value="88" label="88%"></option>
                  <option value="100" label="100%"></option>
                </datalist>
              </div>
              <span className="muted" style={{ minWidth: 50, textAlign: 'right' }}>
                {tone}%
              </span>
            </div>
            <div className="actions" aria-label="Theme adjustments">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={saveTone}
                disabled={isSaveDisabled}
              >
                Save Tone
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={restoreTone}
                disabled={isRestoreDisabled}
              >
                Restore Saved{savedToneLabel ? ` (${savedToneLabel})` : ''}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetTone}
                disabled={isResetDisabled}
              >
                Reset Default
              </button>
            </div>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <h3>Primary Actions</h3>
            <p className="muted">
              Brighter call-to-action treatments that respond to the slider in real time.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary">
                Upscale Image
              </button>
              <button type="button" className="btn btn-secondary">
                Preview
              </button>
              <button type="button" className="btn btn-ghost ghost">
                Cancel
              </button>
            </div>
            <div style={{ marginTop: 12 }} className="swatches">
              <div className="sw p" title="primary" />
              <div className="sw s" title="secondary" />
              <div className="sw a" title="accent" />
            </div>
          </div>

          <div className="card">
            <h3>Inputs</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <input className="input" placeholder="Image URL" />
              <input className="input" placeholder="Output width" />
              <div>
                <span className="badge">Violet micro-accent</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Surface &amp; Content</h3>
            <p className="muted">
              <code>--surface</code> and <code>--elev</code> control canvas depth. Keep
              imagery grounded to neutral planes and isolate the blur to the working panel.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginTop: 8,
              }}
            >
              <div className="panel" style={{ padding: 12 }}>
                surface
              </div>
              <div className="panel" style={{ padding: 12, background: 'var(--elev)' }}>
                elev
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeControls;
