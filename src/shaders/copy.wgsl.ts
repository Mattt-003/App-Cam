// Blit an external (WebCodecs/camera) texture into an internal render target.
// Also applies a simple luminance pass used by reactive effects.
export const copy = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  amount: f32,
};

[[group(0), binding(0)]] var<uniform> uniforms: Uniforms;
[[group(0), binding(1)]] var source_texture: texture_external_texture;
[[group(0), binding(2)]] var source_sampler: sampler;

[[stage(fragment)]]
fn main([[builtin(position)]] fragCoord: vec4<f32>) -> [[location(0)]] vec4<f32> {
  let uv = fragCoord.xy / uniforms.resolution;
  let color = textureSampleLevel(source_texture, source_sampler, uv, 0.0);
  return color;
}
`;
