// Mask Routing & Final Composite.
// Applies effects independently to Foreground / Background / Global Frame
// using the MediaPipe segmentation alpha mask with edge feathering and
// temporal smoothing.
export const composite = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  amount: f32,
  edgeFeather: f32,
  temporalSmoothing: f32,
  route: f32, // 0=foreground, 1=background, 2=global
  fgAmount: f32,
  bgAmount: f32,
};

[[group(0), binding(0)]] var<uniform> uniforms: Uniforms;
[[group(0), binding(1)]] var source_texture: texture_2d<f32>;
[[group(0), binding(2)]] var source_sampler: sampler;
[[group(0), binding(3)]] var effect_texture: texture_2d<f32>;
[[group(0), binding(4)]] var effect_sampler: sampler;
[[group(0), binding(5)]] var mask_texture: texture_2d<f32>;
[[group(0), binding(6)]] var mask_sampler: sampler;
[[group(0), binding(7)]] var prev_mask_texture: texture_2d<f32>;
[[group(0), binding(8)]] var prev_mask_sampler: sampler;

[[stage(fragment)]]
fn main([[builtin(position)]] fragCoord: vec4<f32>) -> [[location(0)]] vec4<f32> {
  let uv = fragCoord.xy / uniforms.resolution;

  let src = textureSampleLevel(source_texture, source_sampler, uv, 0.0);
  let eff = textureSampleLevel(effect_texture, effect_sampler, uv, 0.0);

  // Segmentation mask (alpha channel)
  let maskRaw = textureSampleLevel(mask_texture, mask_sampler, uv, 0.0);
  let maskPrev = textureSampleLevel(prev_mask_texture, prev_mask_sampler, uv, 0.0);

  // Temporal smoothing of the mask to prevent jitter
  let maskSmoothed = mix(maskPrev, maskRaw, uniforms.temporalSmoothing);

  // Edge feathering
  let feather = uniforms.edgeFeather * 0.02;
  let mask = smoothstep(0.5 - feather, 0.5 + feather, maskSmoothed.r);

  // Route: 0=foreground (apply effect where mask=1), 1=background (where mask=0), 2=global (everywhere)
  let routeFactor = select(
    select(1.0 - mask, mask, uniforms.route < 2.0 ? (uniforms.route < 1.0 ? 0.0 : 1.0) : 1.0),
    1.0,
    uniforms.route >= 2.0,
  );

  let fgMix = mix(src, eff, mask * uniforms.fgAmount * uniforms.amount);
  let bgMix = mix(src, eff, (1.0 - mask) * uniforms.bgAmount * uniforms.amount);

  let out = mix(fgMix, bgMix, mask);
  let finalMix = mix(src, out, routeFactor * uniforms.amount);

  return finalMix;
}
`;
