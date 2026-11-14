// Compute pass: downsample the current frame into a small luminance/motion map.
// Also computes a simple frame-delta motion signal by comparing current vs previous.
// Outputs a texture of [cellCount x cellCount] where each texel holds:
//   r = luminance, g = motionX, b = motionY, a = delta magnitude
export const luminance = `
struct Uniforms {
  resolution: vec2<f32>,
  cellCount: f32,
  threshold: f32,
};

[[group(0), binding(0)]] var<uniform> uniforms: Uniforms;
[[group(0), binding(1)]] var current_texture: texture_2d<f32>;
[[group(0), binding(2)]] var current_sampler: sampler;
[[group(0), binding(3)]] var previous_texture: texture_2d<f32>;
[[group(0), binding(4)]] var previous_sampler: sampler;
[[group(0), binding(5)]] var output_texture: texture_storage_2d<rgba32float, write>;

[[stage(compute), workgroup_size(16, 16)]]
fn main([[builtin(global_invocation_id)]] id: vec3<u32>) {
  let cc = i32(uniforms.cellCount);
  if (id.x >= u32(cc) || id.y >= u32(cc)) { return; }

  let uv = (vec2<f32>(id.xy) + vec2<f32>(0.5)) / f32(cc);
  let cur = textureSampleLevel(current_texture, current_sampler, uv, 0.0);
  let prev = textureSampleLevel(previous_texture, previous_sampler, uv, 0.0);

  // Luminance (Rec.709)
  let lum = dot(cur.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));

  // Frame delta motion
  let delta = abs(cur - prev);
  let motion = dot(delta.rgb, vec3<f32>(0.333, 0.333, 0.333));
  let mx = (cur.r - prev.r);
  let my = (cur.g - prev.g);

  textureStore(output_texture, id.xy, vec4<f32>(lum, mx, my, motion));
}
`;
