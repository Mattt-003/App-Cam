import type { GPUDevice, GPUExternalTexture } from './webgpu-types';

export interface VideoSourceState {
  element: HTMLVideoElement | null;
  stream: MediaStream | null;
  file: File | null;
  texture: GPUExternalTexture | null;
  frame: VideoFrame | null;
  playing: boolean;
  duration: number;
  currentTime: number;
  videoWidth: number;
  videoHeight: number;
  facingMode: 'user' | 'environment';
}

export class VideoEngine {
  private element: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private externalTexture: GPUExternalTexture | null = null;
  private videoFrame: VideoFrame | null = null;
  private currentFacing: 'user' | 'environment' = 'user';

  constructor(private device: GPUDevice) {}

  async openCamera(facingMode: 'user' | 'environment' = 'user', width = 1280, height = 720): Promise<VideoSourceState> {
    this.close();

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: 60 },
      } as MediaTrackConstraints,
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;
      this.currentFacing = facingMode;
      const el = document.createElement('video');
      el.playsInline = true;
      el.muted = true;
      el.autoplay = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.style.display = 'none';
      document.body.appendChild(el);

      await new Promise<void>((resolve, reject) => {
        el.onloadedmetadata = () => resolve();
        el.onerror = (e) => reject(e);
      });

      await el.play();
      this.element = el;
      return this.getState();
    } catch (err) {
      this.close();
      throw err;
    }
  }

  async openFile(file: File): Promise<VideoSourceState> {
    this.close();

    const el = document.createElement('video');
    el.playsInline = true;
    el.muted = true;
    el.autoplay = true;
    el.loop = true;
    el.style.display = 'none';
    el.src = URL.createObjectURL(file);
    document.body.appendChild(el);

    await new Promise<void>((resolve, reject) => {
      el.oncanplay = () => resolve();
      el.onerror = (e) => reject(e);
    });

    await el.play();
    this.element = el;
    return this.getState();
  }

  async openVideoFrame(frame: VideoFrame): Promise<{ width: number; height: number }> {
    this.close();
    this.videoFrame = frame;
    this.element = null;
    const dims = { width: frame.codedWidth, height: frame.codedHeight };
    frame.close();
    return dims;
  }

  getTexture(device: GPUDevice): GPUExternalTexture | null {
    if (!this.element) return null;
    try {
      this.externalTexture = device.importExternalTexture({ source: this.element });
      return this.externalTexture;
    } catch {
      return null;
    }
  }

  getState(): VideoSourceState {
    return {
      element: this.element,
      stream: this.stream,
      file: this.file,
      texture: this.externalTexture,
      frame: this.videoFrame,
      playing: !!this.element && !this.element.paused,
      duration: this.element ? this.element.duration : 0,
      currentTime: this.element ? this.element.currentTime : 0,
      videoWidth: this.element ? this.element.videoWidth : 0,
      videoHeight: this.element ? this.element.videoHeight : 0,
      facingMode: this.currentFacing,
    };
  }

  private file: File | null = null;

  play(): void {
    if (this.element) this.element.play();
  }

  pause(): void {
    if (this.element) this.element.pause();
  }

  setCurrentTime(t: number): void {
    if (this.element) this.element.currentTime = t;
  }

  toggleLoop(v: boolean): void {
    if (this.element) this.element.loop = v;
  }

  close(): void {
    if (this.element) {
      this.element.pause();
      this.element.srcObject = null;
      try { this.element.remove(); } catch {}
      this.element = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.externalTexture = null;
    this.videoFrame = null;
    if (this.file) {
      try { URL.revokeObjectURL(this.file as unknown as string); } catch {}
      this.file = null;
    }
  }

  destroy(): void {
    this.close();
  }

  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 0);
  }

  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}
