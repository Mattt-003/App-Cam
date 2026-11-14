# Glitch Cam — Real-Time WebGPU Video Processor

A zero-latency, GPU-native web application for real-time camera manipulation and video post-processing. Built with **Vite + TypeScript + React + Tailwind**, running entirely on the GPU via **WebGPU** with custom **WGSL shaders**, **WebCodecs** zero-copy video streaming, and **MediaPipe** selfie segmentation for real-time rotoscoping.

> Inspired by maximalist digital distortion, TouchDesigner node networks, Kim Asendorf, and @seg.cpu.

## Architecture

| Layer | Tech |
|-------|------|
| Build / UI | Vite 5, React 18, TypeScript, Tailwind CSS |
| Graphics | Raw WebGPU (multi-pass ping-pong), custom WGSL shaders |
| Video engine | WebCodecs API + `GPUExternalTexture` (`importExternalTexture`) — zero CPU readback |
| Computer Vision | `@mediapipe/tasks-vision` ImageSegmenter (Selfie), GPU delegate |
| Capture | `MediaRecorder` / `canvas.captureStream` (WebM/VP9) |

### Render passes (ping-pong)
1. **Copy** — WebCodecs external texture → internal render target
2. **Luminance/Motion (compute)** — downsampled luminance + frame-delta motion map (64×64)
3. **Datamosh** — motion-vector UV displacement feedback loop with freeze/smear + decay
4. **Mosaic** — adaptive grid + bit-crush driven by motion/luminance
5. **Motion Tracer** — accumulation trails with per-channel chromatic aberration along motion paths
6. **Slit-Scan** — horizontal/vertical UV tearing + block shifting + RGB split on luminance spikes
7. **Shapes** — halftone / cross / glyph procedural overlay warped by optical flow + pointer
8. **Composite** — mask-routed composition (foreground / background / global) with edge feathering + temporal mask smoothing
9. **Present** — swapchain blit

## Requirements

- A browser with WebGPU (Chrome ≥113, Edge, or Safari on macOS/iOS 17.4+)
- For iPhone 17 Pro/Max: Safari or Chrome on iOS 17.4+, enable WebGPU if behind a flag
- HTTPS or `localhost` (required for `getUserMedia` and WebGPU on most browsers)

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (http://localhost:5173)
npm run dev

# 3. Production build
npm run build

# 4. Preview production build
npm run preview
```

## Usage

- **Camera:** Click "CAM" to open the live webcam (front by default). Use "SWITCH CAM" to toggle front/back (iPhone).
- **Video file:** Click "FILE" and select an `.mp4`, `.mov`, or `.webm`. It loops automatically.
- **Effects:** Toggle Datamosh, Mosaic, Tracer, Slit-Scan, Shapes from the HUD or the right-hand panel. Each has sliders.
- **Mask routing:** Click FG / BG / ALL to apply effects to foreground only, background only, or the whole frame (requires camera with segmentation loaded).
- **Freeze I-Frame / Smear:** Hold the current frame in the datamosh feedback loop.
- **Record:** Click "REC" to capture the processed output to WebM/VP9. Click "STOP REC" to download.
- **Hide HUD:** Click the `X` in the top HUD for a clean output (video recording). Click again to restore.
- **Resolution:** Use the slider in the right panel (0.75 = lower res for iOS thermal safety, 1.0 = full).

## Mobile / iOS notes

- `playsinline`, `muted`, `autoplay` are set on the video element for strict iOS compliance.
- DPR is clamped to max 2.0; internal render scale defaults to 1.0 (toggle to 0.75 on iPhone to sustain 60 FPS and avoid thermal throttling).
- MediaPipe segmentation model (~few MB) loads from CDN on first use; GPU delegate is requested.

## Project structure

```
src/
  main.tsx             # React entry
  App.tsx              # App container, render loop, state
  index.css            # Tailwind + industrial HUD styles
  types/               # TS interfaces
  lib/
    webgpu.ts          # WebGPU device/context + texture/buffer helpers
    webgpu-types.ts    # WebGPU ambient types + runtime enum constants
    video.ts           # WebCodecs camera/file engine + importExternalTexture
    segmentation.ts    # MediaPipe ImageSegmenter wrapper
    maskTexture.ts     # Upload + ping-pong of segmentation masks
    passes.ts          # Multi-pass ping-pong render engine
  shaders/             # WGSL shader source (copy, luminance, datamosh, mosaic, tracer, slitscan, shapes, composite, present)
  components/
    HUD.tsx            # Translucent industrial HUD (toggleable)
    ControlsPanel.tsx  # Per-effect sliders
    SourceSelector.tsx # CAM / FILE / SWITCH CAM
    ExportControls.tsx # Record / download
```

## Notes

- This is a raw-WebGPU engine (not Three.js) for maximum control over the ping-pong/compute passes. The `three` dependency remains installed but unused.
- Memory: `VideoFrame`, `ImageBitmap`, WebGPU textures, and MediaPipe resources are explicitly disposed on source switch and unmount.
- Segmentation runs asynchronously (~1-frame lag); mask is blended temporally to prevent jitter.
