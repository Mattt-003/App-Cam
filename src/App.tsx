import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Video, Film, Square, X, RotateCcw, Circle } from 'lucide-react';
import {
  initWebGPU,
  resizeCanvas,
  destroyContext,
  type WebGPUContext,
} from './lib/webgpu';
import { VideoEngine } from './lib/video';
import { SegmenterEngine } from './lib/segmentation';
import { MaskTextureManager } from './lib/maskTexture';
import { RenderPasses } from './lib/passes';
import type { AppConfig, MaskRoute } from './types';
import HUD from './components/HUD';
import ControlsPanel from './components/ControlsPanel';
import SourceSelector from './components/SourceSelector';
import ExportControls from './components/ExportControls';

const DEFAULT_CONFIG: AppConfig = {
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  renderScale: 1.0,
  showHUD: true,
  maskRoute: 'global',
  edgeFeather: 30,
  temporalSmoothing: 0.5,
  opticalFlowEnabled: true,
  freezeFrame: false,
  effects: {
    datamosh: { enabled: true, amount: 0.6, speed: 1.0, decay: 40, threshold: 0.15, scale: 1.0, freeze: 0, smear: 0.5 },
    mosaic: { enabled: false, amount: 0.5, speed: 1.0, decay: 0, threshold: 0.2, scale: 1.0, quantize: 0.4, cells: 40 },
    tracer: { enabled: false, amount: 0.5, speed: 1.0, decay: 30, threshold: 0.2, scale: 1.0, aberration: 0.5 },
    slitscan: { enabled: false, amount: 0.4, speed: 1.0, decay: 0, threshold: 0.3, scale: 1.0, slices: 8, mode: 0 },
    shapes: { enabled: false, amount: 0.3, speed: 1.0, decay: 0, threshold: 0.1, scale: 1.0, cellCount: 16, mode: 0 },
    glow: { enabled: false, amount: 0.4, speed: 1.0, decay: 0, threshold: 0.1, scale: 1.0 },
    chromatic: { enabled: false, amount: 0.3, speed: 1.0, decay: 0, threshold: 0.1, scale: 1.0 },
    vignette: { enabled: false, amount: 0.4, speed: 1.0, decay: 0, threshold: 0.1, scale: 1.0 },
  },
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<WebGPUContext | null>(null);
  const passesRef = useRef<RenderPasses | null>(null);
  const videoEngineRef = useRef<VideoEngine | null>(null);
  const segmenterRef = useRef<SegmenterEngine | null>(null);
  const maskMgrRef = useRef<MaskTextureManager | null>(null);

  const configRef = useRef<AppConfig>({ ...DEFAULT_CONFIG });
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isInit, setIsInit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'camera' | 'file' | null>('camera');
  const [isRecording, setIsRecording] = useState(false);
  const [fps, setFps] = useState(0);
  const [mousePos, setMousePos] = useState<[number, number]>([0.5, 0.5]);
  const [touchPoint, setTouchPoint] = useState<[number, number] | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const startTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const init = useCallback(async () => {
    try {
      setError(null);
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');

      const ctx = await initWebGPU(canvas, { dpr: configRef.current.dpr });
      ctxRef.current = ctx;

      const videoEngine = new VideoEngine(ctx.device);
      videoEngineRef.current = videoEngine;

      const segmenter = new SegmenterEngine();
      await segmenter.init({
        model: 'selfie',
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
      segmenterRef.current = segmenter;

      const maskMgr = new MaskTextureManager(ctx);
      maskMgrRef.current = maskMgr;

      const passes = new RenderPasses(ctx, configRef.current);
      passesRef.current = passes;

      if (source === 'camera') {
        await videoEngine.openCamera('user');
      }

      setIsInit(true);
      lastTimeRef.current = performance.now();
      requestAnimationFrame(loop);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [source]);

  const loop = useCallback(() => {
    const now = performance.now();
    const delta = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = now;

    frameCountRef.current++;
    if (now - startTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      startTimeRef.current = now;
    }

    const ctx = ctxRef.current;
    const passes = passesRef.current;
    const videoEngine = videoEngineRef.current;
    const segmenter = segmenterRef.current;
    const maskMgr = maskMgrRef.current;

    if (!ctx || !passes || !videoEngine) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const canvas = canvasRef.current!;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW > 0 && cssH > 0) {
      resizeCanvas(ctx, canvas);
      const internalScale = configRef.current.renderScale;
      const iw = Math.max(1, Math.floor(cssW * ctx.dpr * internalScale));
      const ih = Math.max(1, Math.floor(cssH * ctx.dpr * internalScale));
      if (passes.getInternalSize().width !== iw || passes.getInternalSize().height !== ih) {
        passes.resize(configRef.current);
        maskMgr?.ensureSize(iw, ih);
      }
    }

    // Run segmentation on the video element when available
    const el = videoEngine.getState().element;
    if (segmenter && el && segmenter.isReady() && !el.paused && !el.ended && maskMgr) {
      try {
        const off = new OffscreenCanvas(el.videoWidth, el.videoHeight);
        const oCtx = off.getContext('2d')!;
        oCtx.drawImage(el, 0, 0);
        const bitmap = createImageBitmap(off);
        bitmap.then((bm) => {
          segmenter.segmentForVideo(el, now, (maskBitmap) => {
            if (maskBitmap && maskMgr.current) {
              maskMgr.uploadImageBitmap(maskBitmap, maskMgr.current);
              maskBitmap.close();
            }
            bm.close();
          });
        });
      } catch {
        // segmentation skipped this frame
      }
    }

    const mouse = touchPoint ?? mousePos;
    const extTex = videoEngine.getTexture(ctx.device);
    passes.renderFrame({ externalTexture: extTex, config: configRef.current, time: now / 1000, delta, mouse });

    rafRef.current = requestAnimationFrame(loop);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      passesRef.current?.destroy();
      videoEngineRef.current?.destroy();
      segmenterRef.current?.destroy();
      maskMgrRef.current?.destroy();
      destroyContext(ctxRef.current);
      ctxRef.current = null;
    };
  }, []);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const startCamera = useCallback(async () => {
    setSource('camera');
    setError(null);
    videoEngineRef.current?.close();
    try {
      await videoEngineRef.current?.openCamera('user');
      setSource('camera');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open camera');
    }
  }, []);

  const startFile = useCallback(async (file: File) => {
    setSource('file');
    setError(null);
    videoEngineRef.current?.close();
    try {
      await videoEngineRef.current?.openFile(file);
      setSource('file');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open video file');
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('video/'));
    if (file) startFile(file);
  }, [startFile]);

  const switchCamera = useCallback(async () => {
    const current = videoEngineRef.current?.getState().facingMode ?? 'user';
    const next: 'user' | 'environment' = current === 'user' ? 'environment' : 'user';
    setError(null);
    videoEngineRef.current?.close();
    try {
      await videoEngineRef.current?.openCamera(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch camera');
    }
  }, []);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stream = canvas.captureStream(60);
    streamRef.current = stream;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size) recordedChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glitchcam-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    recorder.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    setIsRecording(false);
    mediaRecorderRef.current = null;
  }, []);

  const toggleHUD = useCallback(() => {
    setConfig((c) => ({ ...c, showHUD: !c.showHUD }));
  }, []);

  const setRenderScale = useCallback((v: number) => {
    setConfig((c) => ({ ...c, renderScale: v }));
  }, []);

  const setMaskRoute = useCallback((r: MaskRoute) => {
    setConfig((c) => ({ ...c, maskRoute: r }));
  }, []);

  const setEffect = useCallback((id: string, key: string, value: number | boolean) => {
    setConfig((c) => ({
      ...c,
      effects: { ...c.effects, [id]: { ...c.effects[id as keyof AppConfig['effects']], [key]: value } },
    }));
  }, []);

  const toggleEffect = useCallback((id: string) => {
    setConfig((c) => ({
      ...c,
      effects: { ...c.effects, [id]: { ...c.effects[id as keyof AppConfig['effects']], enabled: !c.effects[id as keyof AppConfig['effects']].enabled } },
    }));
  }, []);

  const toggleFreeze = useCallback(() => {
    setConfig((c) => ({ ...c, freezeFrame: !c.freezeFrame }));
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTouchPoint(null);
    setMousePos([x, y]);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const x = (t.clientX - rect.left) / rect.width;
    const y = (t.clientY - rect.top) / rect.height;
    setTouchPoint([x, y]);
    setMousePos([x, y]);
  }, []);

  const onTouchStart = onTouchMove;

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#020617] text-white z-50">
        <div className="glass-panel p-8 max-w-md text-center">
          <h2 className="text-lg font-bold mb-2">Initialization Error</h2>
          <p className="text-sm text-white/60 mb-4">{error}</p>
          <button className="btn-industrial" onClick={init}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0" onPointerMove={onPointerMove} onTouchMove={onTouchMove} onTouchStart={onTouchStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{ touchAction: 'none' }}>
      {dragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-white/10 backdrop-blur-sm">
          <div className="glass-panel px-6 py-3 rounded-xl text-center">
            <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase">Drop video file</span>
          </div>
        </div>
      )}
      <div className="fixed inset-0 z-0" style={{ touchAction: 'none' }}>
        <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none', display: 'block' }} />
      </div>

      {isInit && config.showHUD && (
        <>
          <HUD
            fps={fps}
            source={source}
            isRecording={isRecording}
            config={config}
            onToggleHUD={toggleHUD}
            onStartCamera={startCamera}
            onStartFile={startFile}
            onSwitchCamera={switchCamera}
            onSetRenderScale={setRenderScale}
            onSetMaskRoute={setMaskRoute}
            onToggleEffect={toggleEffect}
            onSetEffect={setEffect}
            onToggleFreeze={toggleFreeze}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />
          <ControlsPanel config={config} onSetEffect={setEffect} onToggleEffect={toggleEffect} />
          <SourceSelector source={source} onStartCamera={startCamera} onStartFile={startFile} onSwitchCamera={switchCamera} />
          <ExportControls isRecording={isRecording} onStart={startRecording} onStop={stopRecording} />
        </>
      )}
    </div>
  );
}
