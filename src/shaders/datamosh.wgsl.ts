// True Datamosh: ping-pong framebuffer with motion-vector UV displacement.
// Retains previous frames, displaces UVs along optical flow, with freeze/smear
// and decay controls so pixels drag, melt, and corrupt organically.
export const datamosh = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  amount: f32,
  speed: f32,
  decay: f32,
  freeze: f32,      // 1 = freeze i-frame, no new feedback
  smear: f32,       // extra smear intensity
  threshold: f32,   // motion threshold to apply datamosh
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

  // Read motion at this pixel (downsampled motion map, sampled at full res)
  let motion = textureSampleLevel(motion_texture, motion_sampler, uv, 0.0);
  let motionMag = motion.a;
  let motionVec = motion.gb * 2.0 - 1.0; // center around 0

  // Base sample from source
  let src = textureSampleLevel(source_texture, source_sampler, uv, 0.0);

  // Feedback sample displaced along motion vector
  let flow = motionVec * uniforms.amount * uniforms.speed * 0.02;
  let smearOffset = flow * uniforms.smear;
  let displacedUV = uv + flow + smearOffset * sin(uniforms.time * 2.0) * 0.01;

  let fb = textureSampleLevel(feedback_texture, feedback_sampler, displacedUV, 0.0);

  // Decay the feedback so it doesn't accumulate forever
  let decayed = fb * (1.0 - uniforms.decay * 0.01);

  // Mix: when freeze=1, hold the i-frame (clean feedback); otherwise blend decayed feedback with source
  let moshed = mix(src, decayed, 1.0 - uniforms.freeze);

  // Apply only where motion exceeds threshold, else clean
  let mask = smoothstep(uniforms.threshold, uniforms.threshold + 0.2, motionMag);
  let out = mix(src, moshed, mask * uniforms.amount);

  return out;
}
`;
