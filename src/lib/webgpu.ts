import {
  GPUTextureUsage,
  GPUBufferUsage,
  GPUFilterMode,
  type GPUAdapter,
  type GPUDevice,
  type GPUCanvasContext,
  type GPUTexture,
  type GPUBuffer,
  type GPUSampler,
  type GPUBindGroupLayoutEntry,
  type GPUBindGroupEntry,
  type GPUBindGroupLayout,
  type GPUBindGroup,
  type GPUPipelineLayout,
  type GPUShaderModule,
  type GPURenderPipeline,
  type GPUComputePipeline,
  type GPUCommandEncoder,
  type GPUComputePassEncoder,
  type GPURenderPassEncoder,
  type GPURenderPassDescriptor,
  type GPUColorTargetState,
  type GPUBlendState,
  type GPUBlendComponent,
  type GPUPrimitiveState,
  type GPUMultisampleState,
  type GPUVertexState,
  type GPUVertexBufferLayout,
  type GPUComputeState,
  type GPUCommandBuffer,
  type GPUTextureView,
  type GPUImageCopyTexture,
  type GPUImageDataLayout,
  type GPUExtent3D,
  type GPUOrigin3D,
  type GPUTextureAspect,
  type GPUBufferBindingLayout,
  type GPUTextureBindingLayout,
  type GPUStorageTextureBindingLayout,
  type GPUSamplerBindingLayout,
  type GPUColor,
  type GPULoadOp,
  type GPUStoreOp,
  type GPUQueue,
  type GPUExternalTexture,
  type GPUBindingResource,
  type GPUTextureFormat,
} from './webgpu-types';

export interface WebGPUContext {
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  presentationSize: { width: number; height: number };
  dpr: number;
}

let globalContext: WebGPUContext | null = null;

export const GPU_FEATURES = [
  'texture-compression-astc',
  'texture-compression-bc',
  'texture-compression-etc2',
  'float32-filterable',
  'float32-blendable',
] as const;

export async function initWebGPU(
  canvas: HTMLCanvasElement,
  options: { dpr?: number; preferLowPower?: boolean } = {},
): Promise<WebGPUContext> {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported on this device/browser.');
  }

  const { dpr = Math.min(window.devicePixelRatio || 1, 2), preferLowPower = false } = options;

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: preferLowPower ? 'low-power' : 'high-performance',
    fallbackToPrimaryAdapter: false,
  });

  if (!adapter) {
    throw new Error('No WebGPU adapter found.');
  }

  const device = await adapter.requestDevice({
    requiredFeatures: [],
    requiredLimits: {
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxStorageTextureBindingSize: 128 * 1024 * 1024,
    },
  });

  device.lost.then((info) => {
    console.warn('WebGPU device lost:', info.message);
    globalContext = null;
  });

  const context = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();

  const updateSize = () => {
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
      size: { width, height },
    });
    return { width, height };
  };

  const presentationSize = updateSize();

  const ctx: WebGPUContext = {
    adapter,
    device,
    context,
    format,
    presentationSize,
    dpr,
  };

  globalContext = ctx;
  return ctx;
}

export function getGlobalContext(): WebGPUContext | null {
  return globalContext;
}

export function createTexture(
  device: GPUDevice,
  width: number,
  height: number,
  {
    format = 'rgba8unorm',
    usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    mipmapCount = 1,
  }: { format?: GPUTextureFormat; usage?: number; mipmapCount?: number } = {},
): GPUTexture {
  return device.createTexture({
    size: { width, height },
    format,
    usage,
    mipmapCount,
  });
}

export function createRenderTexture(
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat = 'rgba8unorm',
): GPUTexture {
  return createTexture(device, width, height, {
    format,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST,
  });
}

export function createStorageTexture(
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat = 'rgba32float',
): GPUTexture {
  return createTexture(device, width, height, {
    format,
    usage:
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST,
  });
}

export function createBuffer(
  device: GPUDevice,
  size: number,
  usage: number,
  mappedAtCreation = false,
): GPUBuffer {
  return device.createBuffer({ size, usage, mappedAtCreation });
}

export function createSampler(device: GPUDevice, filtering: 'linear' | 'nearest' = 'linear'): GPUSampler {
  return device.createSampler({
    magFilter: filtering,
    minFilter: filtering,
    mipmapFilter: filtering,
  });
}

export function createBindGroupLayout(
  device: GPUDevice,
  entries: GPUBindGroupLayoutEntry[],
): GPUBindGroupLayout {
  return device.createBindGroupLayout({ entries });
}

export function createBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  entries: GPUBindGroupEntry[],
): GPUBindGroup {
  return device.createBindGroup({ layout, entries });
}

export function createPipelineLayout(
  device: GPUDevice,
  bindGroupLayouts: GPUBindGroupLayout[],
): GPUPipelineLayout {
  return device.createPipelineLayout({ bindGroupLayouts });
}

export function createShaderModule(device: GPUDevice, code: string): GPUShaderModule {
  return device.createShaderModule({ code });
}

export function resizeCanvas(
  ctx: WebGPUContext,
  canvas: HTMLCanvasElement,
): { width: number; height: number } {
  const width = Math.floor(canvas.clientWidth * ctx.dpr);
  const height = Math.floor(canvas.clientHeight * ctx.dpr);
  ctx.context.configure({
    device: ctx.device,
    format: ctx.format,
    alphaMode: 'premultiplied',
    size: { width, height },
  });
  ctx.presentationSize = { width, height };
  return { width, height };
}

export function destroyTexture(texture: GPUTexture | null): void {
  if (texture) texture.destroy();
}

export function destroyContext(ctx: WebGPUContext | null): void {
  if (!ctx) return;
  destroyTexture(ctx.context as unknown as GPUTexture);
  globalContext = null;
}
