// Final present pass: copy the composite texture to the swapchain.
export const present = `
[[group(0), binding(0)]] var source_texture: texture_2d<f32>;
[[group(0), binding(1)]] var source_sampler: sampler;

[[stage(fragment)]]
fn main([[builtin(position)]] fragCoord: vec4<f32>) -> [[location(0)]] vec4<f32> {
  let uv = fragCoord.xy / vec2<f32>(textureDimensions(source_texture));
  return textureSampleLevel(source_texture, source_sampler, uv, 0.0);
}
`;
