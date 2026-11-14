// Interactive Screen-Wide Shape Patterns.
// Procedural halftone dot matrix / wireframe crosses / ASCII-style glyphs.
// Scale, rotation, and grid distortion warp via optical flow + touch coords.
export const shapes = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  amount: f32,
  speed: f32,
  threshold: f32,
  scale: f32,
  mouse: vec2<f32>,
  mode: f32, // 0=halftone dots, 1=crosses, 2=glyphs
  cellCount: f32,
};

[[group(0), binding(0)]] var<uniform> uniforms: Uniforms;
[[group(0), binding(1)]] var source_texture: texture_2d<f32>;
[[group(0), binding(2)]] var source_sampler: sampler;
[[group(0), binding(3)]] var motion_texture: texture_2d<f32>;
[[group(0), binding(4)]] var motion_sampler: sampler;

fn rot2d(a: f32) -> mat2<f32> {
  return mat2<f32>(cos(a), -sin(a), sin(a), cos(a));
}

[[stage(fragment)]]
fn main([[builtin(position)]] fragCoord: vec4<f32>) -> [[location(0)]] vec4<f32> {
  let uv = fragCoord.xy / uniforms.resolution;
  let motion = textureSampleLevel(motion_texture, motion_sampler, uv, 0.0);
  let motionMag = motion.a;
  let lum = motion.r;

  let center = vec2<f32>(0.5, 0.5);
  let mouseDir = normalize(uniforms.mouse - center);
  let flow = motionVecFrom(motion, uv);

  // Warp UVs by optical flow + mouse
  let warp = flow * uniforms.amount * 0.3 + mouseDir * 0.1 * uniforms.amount;
  let p = (uv - center) + warp;
  p = p * rot2d(uniforms.time * 0.5 * uniforms.speed + uniformMouseAngle(uniforms.mouse));

  let cells = max(4.0, uniforms.cellCount * uniforms.scale);
  let grid = floor(p * cells) / cells;

  // Pattern
  let pattern = shapePattern(uniforms.mode, fract(p * cells), uniforms.time, uniforms.amount, motionMag);

  // Sample source
  let color = textureSampleLevel(source_texture, source_sampler, uv, 0.0);

  // Overlay pattern, brighter where motion/luminance
  let intensity = pattern * (0.4 + motionMag * 0.6 + lum * 0.4) * uniforms.amount;
  let out = color + vec4<f32>(pattern * intensity, pattern * intensity, pattern * intensity, 0.0);

  return out;
}

fn motionVecFrom(m: vec4<f32>, uv: vec2<f32>) -> vec2<f32> {
  return m.gb * 2.0 - 1.0;
}

fn uniformMouseAngle(m: vec2<f32>) -> f32 {
  let d = m - vec2<f32>(0.5, 0.5);
  return atan2(d.y, d.x);
}

fn shapePattern(mode: f32, f: vec2<f32>, time: f32, amount: f32, motion: f32) -> f32 {
  let d = distance(f, vec2<f32>(0.5, 0.5));
  if (mode < 1.0) {
    // Halftone dot matrix
    let r = 0.25 + 0.15 * sin(time * 2.0) * (1.0 + motion);
    return smoothstep(r + 0.02, r, d);
  } else if (mode < 2.0) {
    // Wireframe crosses
    let cross = step(0.48, abs(f.x - 0.5)) * step(0.48, abs(f.y - 0.5));
    let lines = step(0.02, abs(fract(f.x * 8.0 + time) - 0.5)) + step(0.02, abs(fract(f.y * 8.0 - time) - 0.5));
    return cross + lines * 0.5;
  } else {
    // ASCII-style glyph blocks
    let glyph = step(0.5, sin(f.x * 60.0 + time) * cos(f.y * 60.0 - time));
    return glyph * 0.7;
  }
}
`;
