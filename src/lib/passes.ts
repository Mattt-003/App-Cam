import {
  createTexture,
  createRenderTexture,
  createStorageTexture,
  createSampler,
  createBindGroupLayout,
  createBindGroup,
  createPipelineLayout,
  createShaderModule,
  createBuffer,
  destroyTexture,
  resizeCanvas,
} from './webgpu';
import { GPUBufferUsage, GPUShaderStage } from './webgpu-types';
import type {
  GPUDevice,
  GPUTexture,
  GPUBuffer,
  GPUSampler,
  GPUBindGroupLayout,
  GPUBindGroup,
  GPUBindGroupEntry,
  GPUPipelineLayout,
  GPUShaderModule,
  GPURenderPipeline,
  GPUComputePipeline,
  GPUCommandEncoder,
  GPUComputePassEncoder,
  GPURenderPassEncoder,
  GPURenderPassDescriptor,
  GPUColorTargetState,
  GPUExternalTexture,
  GPUCommandBuffer,
} from './webgpu-types';
import type { WebGPUContext } from './webgpu';
import type { AppConfig } from '../types';
import * as Shaders from '../shaders';

const FULLSCREEN_VERTEX = `
[[group(0), binding(0)]] var<uniform> uniforms: Uniforms;
struct Uniforms { resolution: vec2<f32>; };
[[stage(vertex)]]
fn vs_main([[builtin(vertex_index)]] vid: u32) -> [[builtin(position)]] vec4<f32> {
  let pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  return vec4<f32>(pos[vid], 0.0, 1.0);
}
`;

interface PassResources {
  pipeline: GPURenderPipeline | GPUComputePipeline;
  bindGroup: GPUBindGroup;
  layout: GPUBindGroupLayout;
  isCompute: boolean;
}

export class RenderPasses {
  private device: GPUDevice;
  private ctx: WebGPUContext;
  private width: number;
  private height: number;
  private scale: number;
  private internalW: number;
  private internalH: number;

  // Ping-pong textures
  private feedbackA: GPUTexture | null = null;
  private feedbackB: GPUTexture | null = null;
  private feedbackRead: GPUTexture | null = null;
  private feedbackWrite: GPUTexture | null = null;

  // Luminance/motion map (small)
  private motionMap: GPUTexture | null = null;
  private motionMapPrev: GPUTexture | null = null;

  // Mask textures (segmentation)
  private maskTex: GPUTexture | null = null;
  private maskPrevTex: GPUTexture | null = null;

  // Uniform buffers
  private uniformBuffer: GPUBuffer | null = null;
  private motionBuffer: GPUBuffer | null = null;

  // Samplers
  private linearSampler: GPUSampler;
  private nearestSampler: GPUSampler;

  // Pipeline cache
  private pipelines = new Map<string, PassResources>();

  private quadVertexBuffer: GPUBuffer | null = null;

  constructor(ctx: WebGPUContext, config: AppConfig) {
    this.ctx = ctx;
    this.device = ctx.device;
    this.scale = config.renderScale;
    const { width, height } = ctx.presentationSize;
    this.width = width;
    this.height = height;
    this.internalW = Math.max(1, Math.floor(width * this.scale));
    this.internalH = Math.max(1, Math.floor(height * this.scale));

    this.linearSampler = createSampler(this.device, 'linear');
    this.nearestSampler = createSampler(this.device, 'nearest');

    this.feedbackA = createRenderTexture(this.device, this.internalW, this.internalH);
    this.feedbackB = createRenderTexture(this.device, this.internalW, this.internalH);
    this.feedbackRead = this.feedbackA;
    this.feedbackWrite = this.feedbackB;

    this.motionMap = createStorageTexture(this.device, 64, 64, 'rgba32float');
    this.motionMapPrev = createStorageTexture(this.device, 64, 64, 'rgba32float');

    this.maskTex = createRenderTexture(this.device, this.internalW, this.internalH);
    this.maskPrevTex = createRenderTexture(this.device, this.internalW, this.internalH);

    this.uniformBuffer = createBuffer(this.device, 256, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.motionBuffer = createBuffer(this.device, 64 * 64 * 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);

    this.initQuad();
  }

  private initQuad(): void {
    const vertices = new Float32Array([
      -1, -1, 3, -1, -1, 3,
    ]);
    this.quadVertexBuffer = createBuffer(this.device, vertices.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    (this.device as any).queue.writeBuffer(this.quadVertexBuffer!, 0, vertices);
  }

  getInternalSize(): { width: number; height: number } {
    return { width: this.internalW, height: this.internalH };
  }

  resize(config: AppConfig): void {
    const { width, height } = this.ctx.presentationSize;
    this.width = width;
    this.height = height;
    this.scale = config.renderScale;
    this.internalW = Math.max(1, Math.floor(width * this.scale));
    this.internalH = Math.max(1, Math.floor(height * this.scale));

    destroyTexture(this.feedbackA);
    destroyTexture(this.feedbackB);
    destroyTexture(this.motionMap);
    destroyTexture(this.motionMapPrev);
    destroyTexture(this.maskTex);
    destroyTexture(this.maskPrevTex);

    this.feedbackA = createRenderTexture(this.device, this.internalW, this.internalH);
    this.feedbackB = createRenderTexture(this.device, this.internalW, this.internalH);
    this.feedbackRead = this.feedbackA;
    this.feedbackWrite = this.feedbackB;

    this.motionMap = createStorageTexture(this.device, 64, 64, 'rgba32float');
    this.motionMapPrev = createStorageTexture(this.device, 64, 64, 'rgba32float');
    this.maskTex = createRenderTexture(this.device, this.internalW, this.internalH);
    this.maskPrevTex = createRenderTexture(this.device, this.internalW, this.internalH);
  }

  private getPass(name: string, shaderCode: string, isCompute: boolean, entry: string, targets?: GPUColorTargetState[]): PassResources {
    const key = `${name}:${shaderCode.length}`;
    let cached = this.pipelines.get(key);
    if (cached) return cached;

    const module = createShaderModule(this.device, shaderCode);

    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ]);

    let pipeline: GPURenderPipeline | GPUComputePipeline;

    if (isCompute) {
      pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: entry },
      });
    } else {
      pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: createShaderModule(this.device, FULLSCREEN_VERTEX), entryPoint: 'vs_main' },
        fragment: { module, entryPoint: entry, targets: targets || [{ format: 'bgra8unorm' } as GPUColorTargetState] },
        primitive: { topology: 'triangle-list' },
        multisample: { count: 1 },
      });
    }

    const bindGroupLayout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ]);

    cached = { pipeline, bindGroup: null as any, layout: bindGroupLayout, isCompute };
    this.pipelines.set(key, cached);
    return cached;
  }

  private bindTextureToGroup(layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[]): GPUBindGroup {
    return createBindGroup(this.device, layout, entries);
  }

  // ---------- Frame orchestration ----------

  renderFrame({
    externalTexture,
    config,
    time,
    delta,
    mouse,
  }: {
    externalTexture: GPUExternalTexture | null;
    config: AppConfig;
    time: number;
    delta: number;
    mouse: [number, number];
  }): GPUTexture {
    const encoder = this.device.createCommandEncoder();

    const readTex = this.feedbackRead!;
    const writeTex = this.feedbackWrite!;

    // 1. Copy live external frame into the read buffer (clean current frame)
    if (externalTexture) {
      this.copyExternalToInternal(encoder, externalTexture, readTex);
    }

    // 1b. Luminance/motion compute pass from the clean frame
    this.computeMotion(encoder, readTex);

    // 2. Ping-pong effects chain: reads readTex, writes into writeTex
    const chained = this.runEffectChain(encoder, readTex, config, time, delta, mouse);

    // 3. Composite with mask routing
    const composed = this.compositeFrame(encoder, chained, config, time);

    // 4. Present to swapchain
    this.presentFrame(encoder, composed);

    this.device.queue.submit([encoder.finish()]);

    // Swap feedback
    [this.feedbackRead, this.feedbackWrite] = [this.feedbackWrite, this.feedbackRead];
    [this.motionMap, this.motionMapPrev] = [this.motionMapPrev, this.motionMap];
    [this.maskTex, this.maskPrevTex] = [this.maskPrevTex, this.maskTex];

    return composed; // internal texture; present already done to canvas
  }

  private copyExternalToInternal(encoder: GPUCommandEncoder, external: GPUExternalTexture, target: GPUTexture): GPUTexture {
    const view = target.createView();
    const rp = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    const pass = this.getPass('copy', Shaders.copy, false, 'main', [{ format: 'rgba8unorm' }]);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ]);
    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: { buffer: this.uniformBuffer! } },
      { binding: 1, resource: external },
      { binding: 2, resource: this.linearSampler },
    ]);

    rp.setPipeline(pass.pipeline as GPURenderPipeline);
    rp.setBindGroup(0, bg);
    rp.draw(3);
    rp.end();

    return this.feedbackWrite!;
  }

  private computeMotion(encoder: GPUCommandEncoder, input: GPUTexture | null): void {
    if (!input) return;
    const module = createShaderModule(this.device, Shaders.luminance);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, sampler: {} },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float' } },
    ]);
    const pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });

    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: { buffer: this.uniformBuffer! } },
      { binding: 1, resource: input.createView() },
      { binding: 2, resource: this.nearestSampler },
      { binding: 3, resource: this.motionMapPrev!.createView() },
      { binding: 4, resource: this.nearestSampler },
      { binding: 5, resource: this.motionMap!.createView() },
    ]);

    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(64 / 16), Math.ceil(64 / 16), 1);
    pass.end();
  }

  private runEffectChain(encoder: GPUCommandEncoder, source: GPUTexture, config: AppConfig, time: number, delta: number, mouse: [number, number]): GPUTexture {
    let current = source;

    // Build uniform data
    this.updateUniforms(config, time, delta, mouse);

    // Datamosh
    if (config.effects.datamosh.enabled) {
      current = this.datamoshPass(encoder, current, config.effects.datamosh, time);
    }

    // Mosaic
    if (config.effects.mosaic.enabled) {
      current = this.mosaicPass(encoder, current, config.effects.mosaic, time);
    }

    // Tracer
    if (config.effects.tracer.enabled) {
      current = this.tracerPass(encoder, current, config.effects.tracer, time);
    }

    // Slitscan
    if (config.effects.slitscan.enabled) {
      current = this.slitscanPass(encoder, current, config.effects.slitscan, time);
    }

    // Shapes overlay
    if (config.effects.shapes.enabled) {
      current = this.shapesPass(encoder, current, config.effects.shapes, time, mouse);
    }

    return current;
  }

  private datamoshPass(encoder: GPUCommandEncoder, input: GPUTexture, params: any, time: number): GPUTexture {
    const pass = this.getPass('datamosh', Shaders.datamosh, false, 'main', [{ format: 'rgba8unorm' }]);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ]);
    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: { buffer: this.uniformBuffer! } },
      { binding: 1, resource: input.createView() },
      { binding: 2, resource: this.linearSampler },
      { binding: 3, resource: this.feedbackWrite!.createView() },
      { binding: 4, resource: this.linearSampler },
      { binding: 5, resource: this.motionMap!.createView() },
      { binding: 6, resource: this.nearestSampler },
    ]);

    const view = this.feedbackWrite!.createView();
    const rp = encoder.beginRenderPass({
      colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    rp.setPipeline(pass.pipeline as GPURenderPipeline);
    rp.setBindGroup(0, bg);
    rp.draw(3);
    rp.end();
    return this.feedbackWrite!;
  }

  private mosaicPass(encoder: GPUCommandEncoder, input: GPUTexture, params: any, time: number): GPUTexture {
    const pass = this.getPass('mosaic', Shaders.mosaic, false, 'main', [{ format: 'rgba8unorm' }]);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ]);
    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: { buffer: this.uniformBuffer! } },
      { binding: 1, resource: input.createView() },
      { binding: 2, resource: this.linearSampler },
      { binding: 3, resource: this.motionMap!.createView() },
      { binding: 4, resource: this.nearestSampler },
    ]);
    const view = this.feedbackWrite!.createView();
    const rp = encoder.beginRenderPass({
      colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    rp.setPipeline(pass.pipeline as GPURenderPipeline);
    rp.setBindGroup(0, bg);
    rp.draw(3);
    rp.end();
    return this.feedbackWrite!;
  }

  private tracerPass(encoder: GPUCommandEncoder, input: GPUTexture, params: any, time: number): GPUTexture {
    const pass = this.getPass('tracer', Shaders.tracer, false, 'main', [{ format: 'rgba8unorm' }]);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ]);
    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: { buffer: this.uniformBuffer! } },
      { binding: 1, resource: input.createView() },
      { binding: 2, resource: this.linearSampler },
      { binding: 3, resource: this.feedbackWrite!.createView() },
      { binding: 4, resource: this.linearSampler },
      { binding: 5, resource: this.motionMap!.createView() },
      { binding: 6, resource: this.nearestSampler },
    ]);
    const view = this.feedbackWrite!.createView();
    const rp = encoder.beginRenderPass({
      colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    rp.setPipeline(pass.pipeline as GPURenderPipeline);
    rp.setBindGroup(0, bg);
    rp.draw(3);
    rp.end();
    return this.feedbackWrite!;
  }

  private slitscanPass(encoder: GPUCommandEncoder, input: GPUTexture, params: any, time: number): GPUTexture {
    const pass = this.getPass('slitscan', Shaders.slitscan, false, 'main', [{ format: 'rgba8unorm' }]);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ]);
    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: { buffer: this.uniformBuffer! } },
      { binding: 1, resource: input.createView() },
      { binding: 2, resource: this.linearSampler },
      { binding: 3, resource: this.motionMap!.createView() },
      { binding: 4, resource: this.nearestSampler },
    ]);
    const view = this.feedbackWrite!.createView();
    const rp = encoder.beginRenderPass({
      colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    rp.setPipeline(pass.pipeline as GPURenderPipeline);
    rp.setBindGroup(0, bg);
    rp.draw(3);
    rp.end();
    return this.feedbackWrite!;
  }

  private shapesPass(encoder: GPUCommandEncoder, input: GPUTexture, params: any, time: number, mouse: [number, number]): GPUTexture {
    const pass = this.getPass('shapes', Shaders.shapes, false, 'main', [{ format: 'rgba8unorm' }]);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ]);
    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: { buffer: this.uniformBuffer! } },
      { binding: 1, resource: input.createView() },
      { binding: 2, resource: this.linearSampler },
      { binding: 3, resource: this.motionMap!.createView() },
      { binding: 4, resource: this.nearestSampler },
    ]);
    const view = this.feedbackWrite!.createView();
    const rp = encoder.beginRenderPass({
      colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    rp.setPipeline(pass.pipeline as GPURenderPipeline);
    rp.setBindGroup(0, bg);
    rp.draw(3);
    rp.end();
    return this.feedbackWrite!;
  }

  private compositeFrame(encoder: GPUCommandEncoder, input: GPUTexture, config: AppConfig, time: number): GPUTexture {
    const pass = this.getPass('composite', Shaders.composite, false, 'main', [{ format: 'rgba8unorm' }]);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 8, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ]);
    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: { buffer: this.uniformBuffer! } },
      { binding: 1, resource: this.feedbackRead!.createView() }, // source = clean frame
      { binding: 2, resource: this.linearSampler },
      { binding: 3, resource: input.createView() }, // effect result
      { binding: 4, resource: this.linearSampler },
      { binding: 5, resource: this.maskTex!.createView() },
      { binding: 6, resource: this.linearSampler },
      { binding: 7, resource: this.maskPrevTex!.createView() },
      { binding: 8, resource: this.linearSampler },
    ]);

    // We render to feedbackWrite (which will become read next frame) OR to a final target.
    // Use feedbackWrite as composite output then present it.
    const view = this.feedbackWrite!.createView();
    const rp = encoder.beginRenderPass({
      colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    rp.setPipeline(pass.pipeline as GPURenderPipeline);
    rp.setBindGroup(0, bg);
    rp.draw(3);
    rp.end();
    return this.feedbackWrite!;
  }

  private presentFrame(encoder: GPUCommandEncoder, texture: GPUTexture): void {
    const canvasTex = this.ctx.context.getCurrentTexture();
    const pass = this.getPass('present', Shaders.present, false, 'main', [{ format: this.ctx.format }]);
    const layout = createBindGroupLayout(this.device, [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ]);
    const bg = createBindGroup(this.device, layout, [
      { binding: 0, resource: texture.createView() },
      { binding: 1, resource: this.linearSampler },
    ]);
    const rp = encoder.beginRenderPass({
      colorAttachments: [{
        view: canvasTex.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    rp.setPipeline(pass.pipeline as GPURenderPipeline);
    rp.setBindGroup(0, bg);
    rp.draw(3);
    rp.end();
  }

  private updateUniforms(config: AppConfig, time: number, delta: number, mouse: [number, number]): void {
    const e = config.effects;
    const data = new Float32Array([
      this.internalW, this.internalH, // resolution
      time, delta, // time, delta
      e.datamosh.amount, e.datamosh.speed, e.datamosh.decay, e.datamosh.threshold,
      e.mosaic.amount, e.mosaic.speed, e.mosaic.decay, e.mosaic.threshold,
      e.tracer.amount, e.tracer.speed, e.tracer.decay, e.tracer.threshold,
      e.slitscan.amount, e.slitscan.speed, e.slitscan.threshold, e.slitscan.scale,
      e.shapes.amount, e.shapes.speed, e.shapes.threshold, e.shapes.scale,
      mouse[0], mouse[1],
      config.edgeFeather, config.temporalSmoothing,
      config.maskRoute === 'foreground' ? 0 : config.maskRoute === 'background' ? 1 : 2,
      e.datamosh.freeze ? 1 : 0, e.datamosh.smear ?? 0, 0, 0,
    ]);
    this.device.queue.writeBuffer(
      this.uniformBuffer!,
      new Uint8Array(data.buffer, 0, data.byteLength),
      0,
    );
  }

  setMaskTexture(texture: GPUTexture | null): void {
    destroyTexture(this.maskTex);
    this.maskTex = texture ?? createRenderTexture(this.device, this.internalW, this.internalH);
  }

  destroy(): void {
    destroyTexture(this.feedbackA);
    destroyTexture(this.feedbackB);
    destroyTexture(this.motionMap);
    destroyTexture(this.motionMapPrev);
    destroyTexture(this.maskTex);
    destroyTexture(this.maskPrevTex);
    if (this.uniformBuffer) this.uniformBuffer.destroy();
    if (this.motionBuffer) this.motionBuffer.destroy();
    if (this.quadVertexBuffer) this.quadVertexBuffer.destroy();
    this.pipelines.clear();
  }
}
