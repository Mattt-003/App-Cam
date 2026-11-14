// WebGPU ambient type shims + runtime enum constants.
// Provides types and the numeric enum values browsers expose at runtime,
// so the engine compiles and runs without @types/webgpu.

// ---- Runtime enum values (available in browsers with WebGPU) ----
export const GPUTextureUsage = {
  TEXTURE_BINDING: 0x00000004,
  RENDER_ATTACHMENT: 0x00000008,
  COPY_DST: 0x00000020,
  COPY_SRC: 0x00000010,
  STORAGE_BINDING: 0x00000040,
} as const;

export const GPUBufferUsage = {
  UNIFORM: 0x00000004,
  STORAGE: 0x00000008,
  COPY_DST: 0x00000020,
  COPY_SRC: 0x00000010,
  MAP_READ: 0x00000001,
  MAP_WRITE: 0x00000002,
  VERTEX: 0x00000040,
  INDEX: 0x00000080,
} as const;

export const GPUFilterMode = { linear: 'linear', nearest: 'nearest' } as const;

export const GPUShaderStage = {
  VERTEX: 0x00000001,
  FRAGMENT: 0x00000002,
  COMPUTE: 0x00000004,
} as const;

// ---- Types ----
export type GPUTextureFormat = 'rgba8unorm' | 'bgra8unorm' | 'rgba32float' | 'r32float' | 'depth24plus';
export type GPUTextureSampleType = 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint';
export type GPUTextureViewDimension = '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
export type GPUStorageTextureAccess = 'write-only' | 'read-write' | 'read-only';
export type GPUSamplerBindingType = 'filtering' | 'non-filtering' | 'comparison';
export type GPULoadOp = 'clear' | 'load';
export type GPUStoreOp = 'store';
export type GPUTextureAspect = 'all' | 'stencil-only' | 'depth-only';
export type GPUPrimitiveTopology = 'triangle-list' | 'triangle-strip' | 'line-list' | 'point-list';
export type GPUCullMode = 'none' | 'front' | 'back';
export type GPUFrontFace = 'cw' | 'ccw';
export type GPUBlendOperation = 'add' | 'subtract' | 'reverse-subtract' | 'min' | 'max';
export type GPUBlendFactor =
  | 'zero' | 'one' | 'src-color' | 'one-minus-src-color' | 'src-alpha' | 'one-minus-src-alpha'
  | 'dst-color' | 'one-minus-dst-color' | 'dst-alpha' | 'one-minus-dst-alpha'
  | 'src-alpha-saturated' | 'blend-color' | 'one-minus-blend-color';

export interface GPUExtent3D { width: number; height: number; depthOrArrayLayers?: number; }
export interface GPUOrigin3D { x?: number; y?: number; z?: number; }
export interface GPUColor { r: number; g: number; b: number; a: number; }

export interface GPUTextureDescriptor {
  size: GPUExtent3D;
  mipmapCount?: number;
  format: GPUTextureFormat;
  usage: number;
}
export interface GPUTextureViewDescriptor {
  format?: GPUTextureFormat;
  dimension?: GPUTextureViewDimension;
  aspect?: GPUTextureAspect;
  baseMipLevel?: number;
  mipLevelCount?: number;
  baseArrayLayer?: number;
  arrayLayerCount?: number;
}
export interface GPUTextureView {}
export interface GPUTexture {
  destroy(): void;
  createView(desc?: GPUTextureViewDescriptor): GPUTextureView;
}

export interface GPUBufferDescriptor { size: number; usage: number; mappedAtCreation?: boolean; }
export interface GPUBuffer { destroy(): void; }

export interface GPUSamplerDescriptor {
  magFilter: 'linear' | 'nearest';
  minFilter: 'linear' | 'nearest';
  mipmapFilter: 'linear' | 'nearest';
}
export interface GPUSampler {}

export interface GPUBindGroupLayoutEntry {
  binding: number;
  visibility: number;
  buffer?: GPUBufferBindingLayout;
  texture?: GPUTextureBindingLayout;
  storageTexture?: GPUStorageTextureBindingLayout;
  sampler?: GPUSamplerBindingLayout;
}
export interface GPUBufferBindingLayout { type?: 'uniform' | 'storage' | 'read-only-storage'; hasDynamicOffset?: boolean; minBindingSize?: number; }
export interface GPUTextureBindingLayout { sampleType?: GPUTextureSampleType; viewDimension?: GPUTextureViewDimension; multisampled?: boolean; }
export interface GPUStorageTextureBindingLayout { access?: GPUStorageTextureAccess; format?: GPUTextureFormat; viewDimension?: GPUTextureViewDimension; }
export interface GPUSamplerBindingLayout { type?: GPUSamplerBindingType; }

export interface GPUBindGroupLayout {}
export interface GPUBindGroupDescriptor { layout: GPUBindGroupLayout; entries: GPUBindGroupEntry[]; }
export interface GPUBindGroupEntry { binding: number; resource: GPUBindingResource; }
export type GPUBindingResource = GPUSampler | GPUTextureView | GPUBuffer;
export interface GPUBindGroup {}

export interface GPUPipelineLayoutDescriptor { bindGroupLayouts: GPUBindGroupLayout[]; }
export interface GPUBindGroupLayoutDescriptor { entries: GPUBindGroupLayoutEntry[]; }
export interface GPUPipelineLayout {}

export interface GPUShaderModuleDescriptor { code: string; }
export interface GPUShaderModule {}

export interface GPUVertexBufferLayout {}
export interface GPUVertexState { module: GPUShaderModule; entryPoint: string; buffers?: GPUVertexBufferLayout[]; }
export interface GPUColorTargetState { format: GPUTextureFormat; blend?: GPUBlendState; writeMask?: number; }
export interface GPUBlendState { color: GPUBlendComponent; alpha: GPUBlendComponent; }
export interface GPUBlendComponent { srcFactor: GPUBlendFactor; dstFactor: GPUBlendFactor; operation: GPUBlendOperation; }
export interface GPUFragmentState { module: GPUShaderModule; entryPoint: string; targets: GPUColorTargetState[]; }
export interface GPUPrimitiveState { topology?: GPUPrimitiveTopology; cullMode?: GPUCullMode; frontFace?: GPUFrontFace; }
export interface GPUDepthStencilState {}
export interface GPUMultisampleState { count?: number; mask?: number; alphaToCoverageEnabled?: boolean; }

export interface GPURenderPipelineDescriptor {
  layout: GPUPipelineLayout | 'auto';
  vertex: GPUVertexState;
  fragment: GPUFragmentState;
  primitive: GPUPrimitiveState;
  depthStencil?: GPUDepthStencilState;
  multisample: GPUMultisampleState;
}
export interface GPURenderPipeline {}

export interface GPUComputeState { module: GPUShaderModule; entryPoint: string; }
export interface GPUComputePipelineDescriptor { layout: GPUPipelineLayout | 'auto'; compute: GPUComputeState; }
export interface GPUComputePipeline {}

export interface GPUCommandEncoderDescriptor {}
export interface GPUCommandEncoder {
  beginRenderPass(desc: GPURenderPassDescriptor): GPURenderPassEncoder;
  beginComputePass(desc?: GPUComputePassDescriptor): GPUComputePassEncoder;
  copyTextureToTexture(source: GPUImageCopyTexture, destination: GPUImageCopyTexture, size: GPUExtent3D): void;
  finish(desc?: GPUCommandBufferDescriptor): GPUCommandBuffer;
}
export interface GPUComputePassDescriptor {}
export interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[], dynamicOffsetsData?: Uint32Array): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  end(): void;
}
export interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[], dynamicOffsetsData?: Uint32Array): void;
  setViewport(x: number, y: number, width: number, height: number, minDepth: number, maxDepth: number): void;
  setScissorRect(x: number, y: number, width: number, height: number): void;
  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  end(): void;
}
export interface GPURenderPassColorAttachment {
  view: GPUTextureView;
  clearValue: GPUColor;
  loadOp: GPULoadOp;
  storeOp: GPUStoreOp;
}
export interface GPURenderPassDepthStencilAttachment {}
export interface GPURenderPassDescriptor {
  colorAttachments: (GPURenderPassColorAttachment | null)[];
  depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
}
export interface GPUImageCopyTexture { texture: GPUTexture; mipLevel?: number; origin?: GPUOrigin3D; aspect?: GPUTextureAspect; }
export interface GPUImageDataLayout { offset?: number; bytesPerRow?: number; rowsPerImage?: number; }
export interface GPUCommandBufferDescriptor {}
export interface GPUCommandBuffer {}

export interface GPUQueue {
  submit(cmds: GPUCommandBuffer[]): void;
  writeTexture(destination: GPUImageCopyTexture, data: Uint8Array | Uint16Array | Uint32Array | DataView, layout: GPUImageDataLayout, size: GPUExtent3D): void;
  writeBuffer(buffer: GPUBuffer, data: Uint8Array, offset?: number): void;
  copyExternalImageToTexture(
    source: GPUImageCopyExternalImage,
    destination: GPUImageCopyTexture,
    copySize: GPUExtent3D,
  ): void;
}
export interface GPUImageCopyExternalImage { source: ImageBitmap | OffscreenCanvas | HTMLVideoElement | HTMLCanvasElement; origin?: GPUOrigin3D; flipY?: boolean; }

export interface GPUDeviceLostInfo { message: string; reason: string; }
export interface GPUDevice {
  createTexture(desc: GPUTextureDescriptor): GPUTexture;
  createBuffer(desc: GPUBufferDescriptor): GPUBuffer;
  createSampler(desc: GPUSamplerDescriptor): GPUSampler;
  createBindGroupLayout(desc: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createBindGroup(desc: GPUBindGroupDescriptor): GPUBindGroup;
  createPipelineLayout(desc: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
  createShaderModule(desc: GPUShaderModuleDescriptor): GPUShaderModule;
  createRenderPipeline(desc: GPURenderPipelineDescriptor): GPURenderPipeline;
  createComputePipeline(desc: GPUComputePipelineDescriptor): GPUComputePipeline;
  createCommandEncoder(desc?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
  importExternalTexture(desc: GPUExternalTextureDescriptor): GPUExternalTexture;
  queue: GPUQueue;
  lost: Promise<GPUDeviceLostInfo>;
}
export interface GPUAdapter {
  requestDevice(desc: { requiredFeatures: string[]; requiredLimits: Record<string, number> }): Promise<GPUDevice>;
}
export interface GPUCanvasContext {
  configure(desc: { device: GPUDevice; format: GPUTextureFormat; alphaMode: string; size: GPUExtent3D }): void;
  getCurrentTexture(): GPUTexture;
}
export type GPUCanvasAlphaMode = 'premultiplied' | 'opaque';
export interface GPUExternalTexture {}
export interface GPUExternalTextureDescriptor { source: HTMLVideoElement | OffscreenCanvas | HTMLCanvasElement | ImageBitmap; }

// Ambient navigator.gpu augmentation (does not shadow the global value)
declare global {
  interface Navigator {
    gpu: {
      requestAdapter(options: { powerPreference?: 'low-power' | 'high-performance'; fallbackToPrimaryAdapter?: boolean }): Promise<GPUAdapter | null>;
      getPreferredCanvasFormat(): GPUTextureFormat;
    };
  }
}
export {};
