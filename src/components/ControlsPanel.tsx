import { ChevronLeft } from 'lucide-react';
import type { AppConfig, EffectId } from '../types';

const FX_GROUPS: Record<EffectId, { label: string; params: Array<{ key: string; label: string; min: number; max: number; step: number }> }> = {
  datamosh: {
    label: 'Datamosh',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, step: 0.01 },
      { key: 'speed', label: 'Speed', min: 0, max: 3, step: 0.05 },
      { key: 'decay', label: 'Decay', min: 0, max: 100, step: 1 },
      { key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.01 },
      { key: 'smear', label: 'Smear', min: 0, max: 1, step: 0.01 },
    ],
  },
  mosaic: {
    label: 'Mosaic',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, step: 0.01 },
      { key: 'cells', label: 'Cells', min: 4, max: 128, step: 1 },
      { key: 'quantize', label: 'Quantize', min: 0, max: 1, step: 0.01 },
      { key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.01 },
    ],
  },
  tracer: {
    label: 'Motion Tracer',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, step: 0.01 },
      { key: 'decay', label: 'Decay', min: 0, max: 100, step: 1 },
      { key: 'aberration', label: 'Aberration', min: 0, max: 2, step: 0.05 },
      { key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.01 },
    ],
  },
  slitscan: {
    label: 'Slit-Scan',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, step: 0.01 },
      { key: 'slices', label: 'Slices', min: 1, max: 64, step: 1 },
      { key: 'speed', label: 'Speed', min: 0, max: 3, step: 0.05 },
      { key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.01 },
    ],
  },
  shapes: {
    label: 'Shapes',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, step: 0.01 },
      { key: 'cellCount', label: 'Cells', min: 4, max: 64, step: 1 },
      { key: 'speed', label: 'Speed', min: 0, max: 3, step: 0.05 },
      { key: 'scale', label: 'Scale', min: 0.1, max: 3, step: 0.05 },
    ],
  },
  glow: { label: 'Glow', params: [] },
  chromatic: { label: 'Chromatic', params: [] },
  vignette: { label: 'Vignette', params: [] },
};

interface ControlsPanelProps {
  config: AppConfig;
  onSetEffect: (id: string, key: string, value: number | boolean) => void;
  onToggleEffect: (id: string) => void;
}

export default function ControlsPanel({ config, onSetEffect, onToggleEffect }: ControlsPanelProps) {
  return (
    <div className="fixed top-24 right-4 w-72 glass-panel p-4 z-40 pointer-events-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-white tracking-wider uppercase">Shader FX</h3>
        <button className="text-[10px] text-white/50 hover:text-white" onClick={() => onToggleEffect('datamosh')}>
          <ChevronLeft className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {Object.entries(config.effects).map(([id, p]) => {
          const group = FX_GROUPS[id as EffectId];
          const enabled = p.enabled;
          return (
            <div key={id} className="border border-white/5 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium flex items-center gap-2 cursor-pointer" onClick={() => onToggleEffect(id as EffectId)}>
                  <input type="checkbox" className="accent-cyan-500" checked={enabled} onChange={() => onToggleEffect(id as EffectId)} />
                  {group.label}
                </label>
                <span className="text-[10px] text-white/40">{Math.round(p.amount * 100)}%</span>
              </div>
              {group.params.map((param) => {
                const val = p[param.key as keyof typeof p] as number;
                return (
                  <div key={param.key} className="pt-1">
                    <div className="flex justify-between text-[10px] text-white/50 mb-1">
                      <span>{param.label}</span>
                      <span>{val.toFixed(param.step < 1 ? 2 : 0)}</span>
                    </div>
                    <input
                      type="range"
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      defaultValue={val}
                      className="w-full glass-slider"
                      onInput={(e) => onSetEffect(id as EffectId, param.key, parseFloat((e.target as HTMLInputElement).value))}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-white/10">
        <label className="text-[10px] text-white/40 block mb-1 uppercase tracking-wider">Edge Feather</label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={config.edgeFeather}
          className="w-full glass-slider"
        />
      </div>
    </div>
  );
}
