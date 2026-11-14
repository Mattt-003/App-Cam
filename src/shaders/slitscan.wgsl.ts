// Light-Reactive Slides: Slit-Scan & Slice Displacement.
// Instant horizontal/vertical UV tearing, block shifting, RGB splitting
// triggered when luminance spikes exceed a threshold.
export const slitscan = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  amount: f32,
  speed: f32,
  threshold: f32,
  scale: f32,
  slices: f32,
  mode: f32, // 0=horizontal slit, 1=vertical slit, 2=blocks
};

[[group(0), binding(0)]] var<uniform> uniforms: Uniforms;
[[group(0), binding(1)]] var source_texture: texture_2d<f32>;
[[group(0), binding(2)]] var source_sampler: sampler;
[[group(0), binding(3)]] var motion_texture: texture_2d<f32>;
[[group(0), binding(4)]] var motion_sampler: sampler;

[[stage(fragment)]]
fn main([[builtin(position)]] fragCoord: vec4<f32>) -> [[location(0)]] vec4<f32> {
  let uv = fragCoord.xy / uniforms.resolution;
  let motion = textureSampleLevel(motion_texture, motion_sampler, uv, 0.0);
  let motionMag = motion.a;
  let lum = motion.r;

  let trigger = smoothstep(uniforms.threshold, uniforms.threshold + 0.4, lum + motionMag);
  let t = uniforms.time * uniforms.speed;

  let nUV = uv;
  let sliceCount = max(1.0, uniforms.slices * (1.0 + trigger * 4.0));

  if (uniforms.mode < 1.0) {
    // Horizontal slit-scan: displace X based on Y + time
    let slit = floor(uv.y * sliceCount) / sliceCount;
    let tear = sin((uv.y * 50.0) + t) * 0.05 * uniforms.amount;
    nUV.x = uv.x + tear + trigger * 0.1 * sin(t + uv.y * 100.0);
    nUV.y = slit;
  } else if (uniforms.mode < 2.0) {
    // Vertical slit-scan: displace Y based on X + time
    let slit = floor(uv.x * sliceCount) / sliceCount;
    let tear = sin((uv.x * 50.0) + t) * 0.05 * uniforms.amount;
    nUV.x = slit;
    nUV.y = uv.y + tear + trigger * 0.1 * cos(t + uv.x * 100.0);
  } else {
    // Block shifting: quantize into blocks and shift each
    let block = floor(uv * sliceCount) / sliceCount;
    let shift = sin((uv.x + uv.y) * 20.0 + t) * 0.04 * uniforms.amount * trigger;
    nUV = block + shift;
  }

  // RGB split on the displaced UVs
  let r = textureSampleLevel(source_texture, source_sampler, vec2<f32>(nUV.x + 0.005 * trigger, nUV.y), 0.0).r;
  let g = textureSampleLevel(source_texture, source_sampler, vec2<f32>(nUV.x, nUV.y + 0.005 * trigger), 0.0).g;
  let b = textureSampleLevel(source_texture, source_sampler, vec2<f32>(nUV.x - 0.005 * trigger, nUV.y - 0.005 * trigger), 0.0).b;

  let src = textureSampleLevel(source_texture, source_sampler, uv, 0.0);
  let out = vec4<f32>(r, g, b, src.a);

  return mix(src, out, trigger * uniforms.amount);
}
`;
