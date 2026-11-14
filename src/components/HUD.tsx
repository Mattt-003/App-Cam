import React from 'react';
import { Camera, Video, Film, Square, X, RotateCcw, Circle, Wifi, BarChart3 } from 'lucide-react';
import type { AppConfig, MaskRoute } from '../types';

type RouteLabel = Record<MaskRoute, { label: string; icon: React.ElementType }>;
const ROUTE_ICONS: RouteLabel = {
  foreground: { label: 'FG', icon: Camera },
  background: { label: 'BG', icon: Video },
  global: { label: 'ALL', icon: BarChart3 },
};

interface HUDProps {
  fps: number;
  source: 'camera' | 'file' | null;
  isRecording: boolean;
  config: AppConfig;
  onToggleHUD: () => void;
  onStartCamera: () => void;
  onStartFile: (file: File) => void;
  onSwitchCamera: () => void;
  onSetRenderScale: (v: number) => void;
  onSetMaskRoute: (r: MaskRoute) => void;
  onToggleEffect: (id: string) => void;
  onSetEffect: (id: string, key: string, value: number | boolean) => void;
  onToggleFreeze: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const EFFECTS: Array<{ id: string; label: string; icon: React.ElementType }> = [
  { id: 'datamosh', label: 'Datamosh', icon: Wifi },
  { id: 'mosaic', label: 'Mosaic', icon: BarChart3 },
  { id: 'tracer', label: 'Tracer', icon: Circle },
  { id: 'slitscan', label: 'Slit-Scan', icon: RotateCcw },
  { id: 'shapes', label: 'Shapes', icon: Square },
];

export default function HUD({
  fps,
  source,
  isRecording,
  config,
  onToggleHUD,
  onStartCamera,
  onStartFile,
  onSwitchCamera,
  onSetRenderScale,
  onSetMaskRoute,
  onToggleEffect,
  onSetEffect,
  onToggleFreeze,
  onStartRecording,
  onStopRecording,
}: HUDProps) {
  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onStartFile(file);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex flex-col justify-between p-4">
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="glass-panel px-3 py-2 flex items-center gap-3">
          <button className="btn-industrial hover:text-cyan-400" onClick={onToggleHUD} title="Hide HUD">
            <X className="w-4 h-4" />
          </button>
          <div className="flex flex-col items-start">
            <span className="text-xs font-mono text-cyan-400">GLITCH.CAM</span>
            <span className="text-[10px] text-white/50 tracking-wider uppercase">webgpu</span>
          </div>
          <div className="h-4 w-px bg-white/20 mx-2"></div>
          <span className="text-xs font-mono text-white/60">FPS {fps}</span>
          <span className="text-xs font-mono text-white/60 ml-2">{config.renderScale === 0.75 ? 'LOW RES' : 'FULL RES'}</span>
          <div className="h-4 w-px bg-white/20 mx-2"></div>
          <button className={`btn-industrial ${isRecording ? 'btn-active' : ''}`} onClick={isRecording ? onStopRecording : onStartRecording} title="Record">
            <Circle className={`w-3 h-3 ${isRecording ? 'animate-pulse text-red-500' : 'text-white/50'}`} />
            <span className="text-[10px] uppercase">{isRecording ? 'LIVE' : 'REC'}</span>
          </button>
        </div>

        <div className="glass-panel px-3 py-2 flex items-center gap-2">
          <button className="btn-industrial" onClick={onStartCamera} title="Camera">
            <Camera className="w-4 h-4" />
          </button>
          <button className="btn-industrial" onClick={() => document.getElementById('file-input')?.click()} title="Upload Video">
            <Film className="w-4 h-4" />
          </button>
          <input id="file-input" type="file" accept="video/*" className="hidden" onChange={onFilePick} />
          <button className="btn-industrial" onClick={onSwitchCamera} title="Switch Camera">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button className="btn-industrial" onClick={onToggleFreeze} title="Freeze I-Frame / Smear">
            <Square className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-between items-end pointer-events-auto">
        <div className="glass-panel px-3 py-2 flex items-center gap-3">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">MASK ROUTE</span>
          <div className="flex gap-1">
            {Object.entries(ROUTE_ICONS).map(([key, val]) => {
              const IC = val.icon;
              const active = config.maskRoute === key;
              return (
                <button
                  key={key}
                  className={`btn-industrial w-8 h-8 p-0 shrink-0 ${active ? 'btn-active' : ''}`}
                  onClick={() => onSetMaskRoute(key as MaskRoute)}
                  title={val.label}
                >
                  <IC className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-panel px-2 py-1 flex gap-1 overflow-x-auto no-scrollbar">
          {EFFECTS.map((fx) => {
            const enabled = config.effects[fx.id as keyof AppConfig['effects']]?.enabled;
            const IC = fx.icon;
            return (
              <button
                key={fx.id}
                className={`btn-industrial w-10 h-10 p-0 shrink-0 ${enabled ? 'btn-active' : ''}`}
                onClick={() => onToggleEffect(fx.id)}
                title={fx.label}
              >
                <IC className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
