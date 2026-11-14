import { createTexture, destroyTexture, type WebGPUContext } from './webgpu';
import { GPUTextureUsage } from './webgpu-types';
import type { GPUDevice, GPUTexture } from './webgpu-types';

export class MaskTextureManager {
  private device: GPUDevice;
  private ctx: WebGPUContext;
  private texture: GPUTexture | null = null;
  private prevTexture: GPUTexture | null = null;
  private width = 0;
  private height = 0;

  constructor(ctx: WebGPUContext) {
    this.device = ctx.device;
    this.ctx = ctx;
  }

  ensureSize(w: number, h: number): void {
    if (w === this.width && h === this.height && this.texture) return;
    destroyTexture(this.texture);
    destroyTexture(this.prevTexture);
    this.width = w;
    this.height = h;
    this.texture = createTexture(this.device, w, h, {
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.prevTexture = createTexture(this.device, w, h, {
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  uploadImageBitmap(bitmap: ImageBitmap, target: GPUTexture): void {
    this.device.queue.copyExternalImageToTexture(
      { source: bitmap, flipY: false },
      { texture: target, origin: { x: 0, y: 0 } },
      { width: bitmap.width, height: bitmap.height },
    );
  }

  get current(): GPUTexture | null { return this.texture; }
  get previous(): GPUTexture | null { return this.prevTexture; }

  swap(): void {
    [this.texture, this.prevTexture] = [this.prevTexture, this.texture];
  }

  destroy(): void {
    destroyTexture(this.texture);
    destroyTexture(this.prevTexture);
    this.texture = null;
    this.prevTexture = null;
  }
}
