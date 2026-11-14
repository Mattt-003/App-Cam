// Light- & Motion-Activated Mosaics.
// Adaptive grid/Voronoi pixelation where cell size, bit-crushing and contrast
// scale with local motion speed and brightness.
export const mosaic = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  amount: f32,
  speed: f32,
  threshold: f32,
  scale: f32,
  cells: f32,      // base grid size
  quantize: f32,   // bit-crush levels
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
  let lum = motion.r; // luminance from r channel

  // Adaptive cell size: more motion -> smaller/sharper cells; more luminance -> larger
  let cellBase = uniforms.cells * uniforms.scale;
  let cellSize = cellBase * (1.0 - motionMag * 0.8) * (0.6 + lum * 0.6);
  let invCell = 1.0 / max(cellSize, 0.01);

  // Snap to grid
  let grid = floor(uv * invCell) / invCell;
  let jitter = sin(uv * 100.0 + uniforms.time) * 0.005 * uniforms.amount;
  let cellUV = grid + jitter;

  // Sample color at cell center
  let color = textureSampleLevel(source_texture, source_sampler, cellUV, 0.0);

  // Bit-crush / quantize based on motion + amount
  let levels = max(1.0, 256.0 * (1.0 - uniforms.quantize * 0.9 - motionMag * 0.5));
  let quantized = floor(color.rgb * levels) / levels;

  // Contrast scale with luminance threshold
  let contrast = 1.0 + (lum - uniforms.threshold) * 2.0 * uniforms.amount;
  let q = (quantized - 0.5) * contrast + 0.5;

  // Only apply where motion/brightness exceeds threshold
  let mask = smoothstep(uniforms.threshold, uniforms.threshold + 0.3, lum + motionMag);
  let out = mix(color, vec4<f32>(q, color.a), mask * uniforms.amount);

  return out;
}
`;
