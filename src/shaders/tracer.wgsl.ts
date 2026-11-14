// Motion Tracer: temporal accumulation buffer with chromatic aberration
// offset along high-velocity movement paths.
export const tracer = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  amount: f32,
  speed: f32,
  decay: f32,
  threshold: f32,
  aberration: f32,
};

[[group(0), binding(0)]] var<uniform> uniforms: Uniforms;
[[group(0), binding(1)]] var source_texture: texture_2d<f32>;
[[group(0), binding(2)]] var source_sampler: sampler;
[[group(0), binding(3)]] var feedback_texture: texture_2d<f32>;
[[group(0), binding(4)]] var feedback_sampler: sampler;
[[group(0), binding(5)]] var motion_texture: texture_2d<f32>;
[[group(0), binding(6)]] var motion_sampler: sampler;

[[stage(fragment)]]
fn main([[builtin(position)]] fragCoord: vec4<f32>) -> [[location(0)]] vec4<f32> {
  let uv = fragCoord.xy / uniforms.resolution;
  let motion = textureSampleLevel(motion_texture, motion_sampler, uv, 0.0);
  let motionMag = motion.a;
  let motionVec = motion.gb * 2.0 - 1.0;

  let src = textureSampleLevel(source_texture, source_sampler, uv, 0.0);

  // Read feedback, offset along motion path with chromatic aberration per channel
  let offset = motionVec * uniforms.speed * uniforms.aberration * 0.03;

  let rUV = uv + offset * vec2<f32>(1.0, 0.0);
  let gUV = uv + offset * vec2<f32>(0.0, 1.0);
  let bUV = uv + offset * vec2<f32>(-1.0, -1.0);

  let r = textureSampleLevel(feedback_texture, feedback_sampler, rUV, 0.0).r;
  let g = textureSampleLevel(feedback_texture, feedback_sampler, gUV, 0.0).g;
  let b = textureSampleLevel(feedback_texture, feedback_sampler, bUV, 0.0).b;

  let fb = vec4<f32>(r, g, b, 1.0);

  // Decay feedback
  let decayed = fb * (1.0 - uniforms.decay * 0.01);

  // Accumulate source into trail where motion is high
  let mask = smoothstep(uniforms.threshold, uniforms.threshold + 0.3, motionMag);
  let trail = mix(decayed, src, mask * uniforms.amount * 0.3);

  return trail;
}
`;
