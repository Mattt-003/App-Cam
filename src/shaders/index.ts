export { copy } from './copy.wgsl';
export { luminance } from './luminance.wgsl';
export { datamosh } from './datamosh.wgsl';
export { mosaic } from './mosaic.wgsl';
export { tracer } from './tracer.wgsl';
export { slitscan } from './slitscan.wgsl';
export { shapes } from './shapes.wgsl';
export { composite } from './composite.wgsl';
export { present } from './present.wgsl';

export type ShaderName = keyof typeof import('./index');
