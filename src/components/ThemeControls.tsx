import React, { useMemo, useId } from 'react';
import { X } from 'lucide-react';
import './ThemeControls.css';
import { tonePresets, useThemeLab } from '../contexts/ThemeContext';

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
    tokens,
    closeLab,
  } = useThemeLab();
  const sliderId = useId();

  const containerStyle = useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = {};
    Object.entries(tokens).forEach(([token, value]) => {
      (style as any)[`--${token}`] = value;
    });
    return style;
  }, [tokens]);

  const isSaveDisabled = tone === savedTone;
  const isRestoreDisabled = tone === savedTone;
  const isResetDisabled = tone === initialTone;
  const savedToneLabel = savedTone === initialTone ? 'default' : `${savedTone}%`;

  const handleSnap = (value: number) => {
    setTone(value);
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTone(parseInt(event.target.value, 10));
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeLab();
    }
  };

  return (
    <div id="theme-controls" className="theme-lab" style={containerStyle}>
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
            <div className="seg" role="group" aria-label="Snap tones">
              {tonePresets.map((preset) => (
                <button
                  type="button"
                  key={preset.value}
                  onClick={() => handleSnap(preset.value)}
                  aria-pressed={tone === preset.value}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="slider">
              <label htmlFor={sliderId}>Tone</label>
              <input
                id={sliderId}
                type="range"
                min={10}
                max={90}
                step={1}
                value={tone}
                onChange={handleSliderChange}
              />
              <span className="muted" style={{ minWidth: 40, textAlign: 'right' }}>
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
