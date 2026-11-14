import type { GPUTexture } from '../lib/webgpu-types';

export type EffectId =
  | 'datamosh'
  | 'mosaic'
  | 'tracer'
  | 'slitscan'
  | 'shapes'
  | 'glow'
  | 'chromatic'
  | 'vignette';

export type MaskRoute = 'foreground' | 'background' | 'global';

export interface EffectParams {
  enabled: boolean;
  amount: number;
  speed: number;
  decay: number;
  threshold: number;
  scale: number;
  // effect-specific extras (optional)
  freeze?: number;
  smear?: number;
  cells?: number;
  quantize?: number;
  aberration?: number;
  cellCount?: number;
  mode?: number;
  slices?: number;
}

export interface PassUniforms {
  time: number;
  delta: number;
  resolution: [number, number];
  mouse: [number, number];
  amount: number;
  speed: number;
  decay: number;
  threshold: number;
  scale: number;
  luminance: Float32Array; // downsampled luminance map
  motion: Float32Array; // motion vectors (vx, vy per cell)
}

export interface VideoSource {
  id: string;
  type: 'camera' | 'file';
  label: string;
  facingMode?: 'user' | 'environment';
  file?: File;
  videoElement?: HTMLVideoElement;
  stream?: MediaStream;
}

export interface AppConfig {
  dpr: number;
  renderScale: number; // 0.75 or 1.0
  showHUD: boolean;
  maskRoute: MaskRoute;
  edgeFeather: number;
  temporalSmoothing: number;
  effects: Record<EffectId, EffectParams>;
  opticalFlowEnabled: boolean;
  freezeFrame: boolean;
}

export interface SegmentationResult {
  mask: GPUTexture | null;
  confidence: number;
  timestamp: number;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  gpuMemory: number;
  thermalState?: string;
}
