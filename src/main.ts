// main.ts
// Vite + TypeScript single-file WebGL2 derivative/PQA diagnostic.
//
// Test coverage:
//   - Core article-style scalar broadcast: procedural + RGBA8 texture.
//   - Fractional float-like + real-float values: procedural + RGBA8 + R32F texture.
//   - Vector width tests: procedural vec2 + vec4 message passing.
//   - JBU-shaped 2x half-res gather.
//   - texture() NEAREST / LINEAR offset-gather tests for blur/bloom-like use.
//   - Shadow-specific tests: manual depth compare + optional sampler2DShadow.
//   - Robustness probes: viewport offsets, odd dimensions, and unsafe divergent-branch negative demo.
//   - JSON report: compact summary + copyable JSON device/test result.
//
// Important implementation notes:
//
//   - Uses ONE WebGL2 context for all tests. The visible diagnostic canvases are 2D canvases.
//     This avoids hitting browser/mobile WebGL context limits when friends run the page.
//
//   - The article describes the core capability test as drawing a small rectangle, setting one
//     selected quad pixel/corner to 1 and the other lanes to 0, applying QuadMove/message passing,
//     then reading back. This file keeps that idea, but repeats it across a larger matrix of use
//     cases so friends only have to run one page.
//
//   - WebGL's gl_FragCoord.xy is pixel-centered: 0.5, 1.5, 2.5, ... . The article's helper code
//     assumes integer screen coordinates, so every shader here explicitly uses floor(gl_FragCoord.xy)
//     before computing 2x2 lane parity. Without that adaptation the sign vector is wrong in WebGL2.
//
//   - The article-style broadcast tests use four separate 8x8 draws/readbacks, one for each source
//     lane. The visible canvases then copy those results into four strips. This avoids rerunning the
//     shader in shifted viewports, which would change gl_FragCoord parity and accidentally test a
//     different condition.
//
//   - Texture tests use RGBA8 where possible, because 0/1 and byte/255 values are enough for the
//     support checks and avoid unrelated float-texture requirements. The R32F path is tested
//     separately and intentionally uses non-byte-normalized real float values.
//
//   - Manual shadow compare and sampler2DShadow are separate tests. Manual compare uses a
//     DEPTH_COMPONENT16 texture with TEXTURE_COMPARE_MODE = NONE and a regular sampler2D. The
//     sampler2DShadow path uses TEXTURE_COMPARE_MODE = COMPARE_REF_TO_TEXTURE.
//
//   - The robustness probes are intentionally informational. Odd target sizes, viewport offsets,
//     and divergent branches tell us where an engine should apply warnings or fallback paths; they
//     do not change the main required PQA verdict.

const NL = String.fromCharCode(10);

const app =
  document.querySelector<HTMLDivElement>('#app') ??
  document.body.appendChild(document.createElement('div'));

document.body.style.margin = '0';
document.body.style.background = '#101218';
document.body.style.color = '#e8ecf1';
document.body.style.fontFamily =
  'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

app.innerHTML = `
  <div style="padding: 24px; max-width: 1120px;">
    <h1 style="margin: 0 0 8px; font-size: 24px;">WebGL2 PQA Robustness Test — Updated</h1>
    <p style="margin: 0 0 14px; color: #aeb7c2; line-height: 1.45;">
      Tests derivative-based pixel quad message passing using tiny framebuffers.
      Broadcast tests show four strips: lower-left, lower-right, upper-left, upper-right source lane.
      JBU, blur/bloom, shadow, and robustness probes render compact diagnostic canvases.
    </p>
    <div id="result" style="padding:16px;border-radius:12px;background:#171b24;border:1px solid #2a3140;line-height:1.45;">Running...</div>
    <div style="margin-top:14px;padding:14px;border-radius:12px;background:#171b24;border:1px solid #2a3140;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
        <strong>JSON report</strong>
        <button id="copyReportButton" type="button" style="padding:8px 12px;border-radius:8px;border:1px solid #3a4558;background:#202838;color:#e8ecf1;cursor:pointer;">Copy JSON</button>
      </div>
      <textarea id="jsonReport" readonly spellcheck="false" style="box-sizing:border-box;width:100%;min-height:220px;padding:12px;border-radius:8px;border:1px solid #2a3140;background:#0e121a;color:#d9e2ef;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.4;resize:vertical;">Running...</textarea>
    </div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:18px;">
      ${[
        [
          'procCanvas',
          'Binary procedural scalar',
          '4 strips: LL, LR, UL, UR source lane',
          32,
          8,
          512,
          128,
        ],
        [
          'texCanvas',
          'Binary RGBA8 texture scalar',
          '4 strips: LL, LR, UL, UR source lane',
          32,
          8,
          512,
          128,
        ],
        [
          'fracProcCanvas',
          'Fractional procedural scalar',
          '4 strips: LL, LR, UL, UR source lane',
          32,
          8,
          512,
          128,
        ],
        [
          'fracTexCanvas',
          'Fractional RGBA8 texture scalar',
          '4 strips: LL, LR, UL, UR source lane',
          32,
          8,
          512,
          128,
        ],
        [
          'floatTexCanvas',
          'R32F real-float texture scalar',
          '4 strips: LL, LR, UL, UR source lane',
          32,
          8,
          512,
          128,
        ],
        [
          'vec2Canvas',
          'Procedural vec2',
          '4 strips: LL, LR, UL, UR source lane',
          32,
          8,
          512,
          128,
        ],
        [
          'vec4Canvas',
          'Procedural vec4',
          '4 strips: LL, LR, UL, UR source lane',
          32,
          8,
          512,
          128,
        ],
        [
          'jbuCanvas',
          'JBU-shaped half-res gather',
          '8×8 high-res; 5×5 low-res texture',
          8,
          8,
          256,
          256,
        ],
        [
          'nearestCanvas',
          'texture() NEAREST offset gather',
          'blur/bloom-shaped texture() taps',
          8,
          8,
          256,
          256,
        ],
        [
          'linearCanvas',
          'texture() LINEAR offset gather',
          'blur/bloom-shaped interpolated taps',
          8,
          8,
          256,
          256,
        ],
        [
          'manualShadowCanvas',
          'Manual depth shadow compare gather',
          'DEPTH_COMPONENT16 sampler2D fetch + manual compare',
          8,
          8,
          256,
          256,
        ],
        [
          'shadowSamplerCanvas',
          'sampler2DShadow gather',
          'hardware shadow compare sampler, if supported',
          8,
          8,
          256,
          256,
        ],
        [
          'viewportOffsetCanvas',
          'Viewport offset probe',
          '8×8 PQA viewport at offset (1,1) inside a 10×10 target',
          10,
          10,
          256,
          256,
        ],
        [
          'oddSizeCanvas',
          'Odd-size target probe',
          '9×9 target; last row/column may need fallback in real passes',
          9,
          9,
          256,
          256,
        ],
        [
          'divergentCanvas',
          'Invalid divergent branch demo',
          'intentionally unsafe derivative-in-branch case; expected to fail',
          8,
          8,
          256,
          256,
        ],
      ]
        .map(
          ([id, label, note, w, h, sw, sh]) => `
        <div><div style="margin-bottom:6px;color:#aeb7c2;">${label}</div>
        <canvas id="${id}" width="${w}" height="${h}" style="width:${sw}px;height:${sh}px;image-rendering:pixelated;border:1px solid #2a3140;border-radius:8px;background:black;"></canvas>
        <div style="margin-top:6px;color:#7f8a99;font-size:13px;max-width:${sw}px;">${note}</div></div>`
        )
        .join('')}
    </div>
  </div>
`;

type Lane = [number, number];
type SourceMode = 'procedural' | 'texture';
type TestKind = 'binaryScalar' | 'fractionalScalar' | 'vec2' | 'vec4';
type TextureStorage = 'rgba8' | 'r32f';
type SamplingFilter = 'nearest' | 'linear';
type DepthCompareMode = 'none' | 'shadow';

type SourceLaneResult = {
  sourceLaneName: string;
  sourceLane: Lane;
  passCount: number;
  failCount: number;
  failedPixels: Array<{
    x: number;
    y: number;
    rgba: [number, number, number, number];
  }>;
};

type TestResult = {
  name: string;
  width: number;
  height: number;
  sourceResults: SourceLaneResult[];
  skipped?: boolean;
  skipReason?: string;
};

type SimpleResult = {
  name: string;
  width: number;
  height: number;
  passCount: number;
  failCount: number;
  failedPixels: Array<{
    x: number;
    y: number;
    rgba: [number, number, number, number];
  }>;
  skipped?: boolean;
  skipReason?: string;
  informational?: boolean;
};

type RunResult = { result: TestResult; glInfo: Record<string, string> };
type SimpleRunResult = { result: SimpleResult; glInfo: Record<string, string> };

const resultEl = document.querySelector<HTMLDivElement>('#result')!;
const jsonReportEl =
  document.querySelector<HTMLTextAreaElement>('#jsonReport')!;
const copyReportButton =
  document.querySelector<HTMLButtonElement>('#copyReportButton')!;

const TEST_W = 8;
const TEST_H = 8;
const VIS_W = TEST_W * 4;
const VIS_H = TEST_H;
const JBU_LOW_W = 5;
const JBU_LOW_H = 5;
const SAMPLE_TEX_W = 12;
const SAMPLE_TEX_H = 12;
const SHADOW_TEX_W = 12;
const SHADOW_TEX_H = 12;
const SHADOW_REF = 0.47;

const SOURCE_LANES: Array<{ name: string; lane: Lane }> = [
  { name: 'LL / lower-left  (0,0)', lane: [0, 0] },
  { name: 'LR / lower-right (1,0)', lane: [1, 0] },
  { name: 'UL / upper-left  (0,1)', lane: [0, 1] },
  { name: 'UR / upper-right (1,1)', lane: [1, 1] },
];

const TEST_KIND_ID: Record<TestKind, number> = {
  binaryScalar: 0,
  fractionalScalar: 1,
  vec2: 2,
  vec4: 3,
};
const SOURCE_MODE_ID: Record<SourceMode, number> = {
  procedural: 0,
  texture: 1,
};

const vertexSource = `#version 300 es
precision highp float;
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() { gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0); }
`;

const commonPqa = `
vec4 initQuadVector() {
  // Adaptation from the article's InitQuad helper:
  // the original code assumes integer screen coordinates, while WebGL's
  // gl_FragCoord is pixel-centered. floor() converts 0.5,1.5,... to 0,1,...
  // so lane parity and the +/- derivative signs line up with 2x2 pixels.
  vec2 screenCoord = floor(gl_FragCoord.xy);
  vec2 lane = mod(screenCoord, 2.0);
  vec2 q = lane * 2.0 - 1.0;
  return vec4(q, -q);
}
vec4 quadGatherFloat(float value) {
  vec4 qv = initQuadVector();
  vec4 r = vec4(value);
  r.y = r.x + dFdx(r.x) * qv.z;
  r.zw = r.xy + dFdy(r.xy) * qv.w;
  return r;
}
float moveFloat(vec4 g, ivec2 currentLane, ivec2 sourceLane) {
  bool sameX = sourceLane.x == currentLane.x;
  bool sameY = sourceLane.y == currentLane.y;
  if ( sameX &&  sameY) return g.x;
  if (!sameX &&  sameY) return g.y;
  if ( sameX && !sameY) return g.z;
  return g.w;
}
`;

const broadcastFragmentSource = `#version 300 es
precision highp float;
precision highp int;
uniform int uSourceMode;
uniform int uTestKind;
uniform int uRealFloatValues;
uniform ivec2 uSourceLane;
uniform sampler2D uTestTex;
out vec4 outColor;
${commonPqa}
void quadGatherVec2(vec2 value, out vec2 cur, out vec2 h, out vec2 v, out vec2 d) {
  vec4 qv = initQuadVector();
  cur = value;
  h = cur + dFdx(cur) * qv.z;
  v = cur + dFdy(cur) * qv.w;
  d = h + dFdy(h) * qv.w;
}
void quadGatherVec4(vec4 value, out vec4 cur, out vec4 h, out vec4 v, out vec4 d) {
  vec4 qv = initQuadVector();
  cur = value;
  h = cur + dFdx(cur) * qv.z;
  v = cur + dFdy(cur) * qv.w;
  d = h + dFdy(h) * qv.w;
}
vec2 moveVec2(vec2 cur, vec2 h, vec2 v, vec2 d, ivec2 currentLane, ivec2 sourceLane) {
  bool sameX = sourceLane.x == currentLane.x; bool sameY = sourceLane.y == currentLane.y;
  if ( sameX &&  sameY) return cur; if (!sameX && sameY) return h; if (sameX && !sameY) return v; return d;
}
vec4 moveVec4(vec4 cur, vec4 h, vec4 v, vec4 d, ivec2 currentLane, ivec2 sourceLane) {
  bool sameX = sourceLane.x == currentLane.x; bool sameY = sourceLane.y == currentLane.y;
  if ( sameX &&  sameY) return cur; if (!sameX && sameY) return h; if (sameX && !sameY) return v; return d;
}
float laneMatches(ivec2 a, ivec2 b) { return (a.x == b.x && a.y == b.y) ? 1.0 : 0.0; }
float laneFractionalValue(ivec2 lane) {
  // Deliberately non-affine over the 2x2 quad.
  // This catches implementations where dFdx/dFdy behave like one coarse
  // derivative per quad, which can reconstruct affine ramps but not arbitrary
  // per-lane messages.
  int idx = lane.x + lane.y * 2;
  if (idx == 0) return 32.0 / 255.0;
  if (idx == 1) return 113.0 / 255.0;
  if (idx == 2) return 181.0 / 255.0;
  return 77.0 / 255.0;
}
float laneRealFloatValue(ivec2 lane) {
  int idx = lane.x + lane.y * 2;
  if (idx == 0) return 0.03125;
  if (idx == 1) return 0.27182818;
  if (idx == 2) return 0.61803399;
  return 0.9375;
}
vec2 laneVec2Value(ivec2 lane) {
  // Also deliberately non-affine component-wise.
  int idx = lane.x + lane.y * 2;
  if (idx == 0) return vec2(17.0, 211.0) / 255.0;
  if (idx == 1) return vec2(83.0, 29.0) / 255.0;
  if (idx == 2) return vec2(197.0, 143.0) / 255.0;
  return vec2(41.0, 251.0) / 255.0;
}
vec4 laneVec4Value(ivec2 lane) {
  // Deliberately non-affine component-wise.
  int idx = lane.x + lane.y * 2;
  if (idx == 0) return vec4(23.0, 71.0, 197.0, 149.0) / 255.0;
  if (idx == 1) return vec4(139.0, 11.0, 53.0, 223.0) / 255.0;
  if (idx == 2) return vec4(5.0, 173.0, 241.0, 37.0) / 255.0;
  return vec4(211.0, 97.0, 19.0, 181.0) / 255.0;
}
float expectedScalarForLane(ivec2 lane) { return uRealFloatValues != 0 ? laneRealFloatValue(lane) : laneFractionalValue(lane); }
float getScalarSource(ivec2 pixel, ivec2 lane) {
  if (uSourceMode == 1) return texelFetch(uTestTex, pixel, 0).r;
  if (uTestKind == 0) return laneMatches(lane, uSourceLane);
  return expectedScalarForLane(lane);
}
void main() {
  ivec2 pixel = ivec2(floor(gl_FragCoord.xy));
  ivec2 lane = pixel & 1;
  bool pass = false;
  bool sourcePatternLooksValid = true;
  if (uTestKind == 0 || uTestKind == 1) {
    float sourceValue = getScalarSource(pixel, lane);
    vec4 gathered = quadGatherFloat(sourceValue);
    float moved = moveFloat(gathered, lane, uSourceLane);
    float expected = (uTestKind == 0) ? 1.0 : expectedScalarForLane(uSourceLane);
    float tolerance = (uTestKind == 0) ? 0.01 : (uRealFloatValues != 0 ? 1e-4 : 1.5 / 255.0);
    pass = abs(moved - expected) <= tolerance;
    if (uTestKind == 0) sourcePatternLooksValid = (lane.x == uSourceLane.x && lane.y == uSourceLane.y) ? abs(sourceValue - 1.0) < 0.01 : abs(sourceValue) < 0.01;
    else sourcePatternLooksValid = abs(sourceValue - expectedScalarForLane(lane)) <= tolerance;
  } else if (uTestKind == 2) {
    vec2 cur, h, v, d; quadGatherVec2(laneVec2Value(lane), cur, h, v, d);
    vec2 err = abs(moveVec2(cur, h, v, d, lane, uSourceLane) - laneVec2Value(uSourceLane));
    pass = max(err.x, err.y) <= (1.5 / 255.0);
  } else {
    vec4 cur, h, v, d; quadGatherVec4(laneVec4Value(lane), cur, h, v, d);
    vec4 err = abs(moveVec4(cur, h, v, d, lane, uSourceLane) - laneVec4Value(uSourceLane));
    pass = max(max(err.x, err.y), max(err.z, err.w)) <= (1.5 / 255.0);
  }
  if (pass && sourcePatternLooksValid) outColor = vec4(0.05,0.85,0.20,1.0);
  else if (pass) outColor = vec4(0.95,0.65,0.05,1.0);
  else outColor = vec4(0.95,0.12,0.08,1.0);
}
`;

const jbuFragmentSource = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uLowTex;
out vec4 outColor;
${commonPqa}
float lowValue(ivec2 coord) { return texelFetch(uLowTex, coord, 0).r; }
void main() {
  ivec2 pixel = ivec2(floor(gl_FragCoord.xy));
  ivec2 lane = pixel & 1;
  ivec2 base = pixel >> 1;
  float fetched = lowValue(base + lane);
  vec4 gathered = quadGatherFloat(fetched);
  vec4 got = vec4(moveFloat(gathered,lane,ivec2(0,0)), moveFloat(gathered,lane,ivec2(1,0)), moveFloat(gathered,lane,ivec2(0,1)), moveFloat(gathered,lane,ivec2(1,1)));
  vec4 expv = vec4(lowValue(base+ivec2(0,0)), lowValue(base+ivec2(1,0)), lowValue(base+ivec2(0,1)), lowValue(base+ivec2(1,1)));
  vec4 err = abs(got - expv);
  bool pass = max(max(err.x, err.y), max(err.z, err.w)) <= (1.5 / 255.0);
  outColor = pass ? vec4(0.05,0.85,0.20,1.0) : vec4(0.95,0.12,0.08,1.0);
}
`;

const samplingFragmentSource = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSourceTex;
uniform vec2 uInvSourceSize;
uniform vec2 uSubTexelOffset;
out vec4 outColor;
${commonPqa}
float sampleTap(ivec2 base, ivec2 tapLane) {
  vec2 texelCoord = vec2(base + tapLane) + uSubTexelOffset;
  return texture(uSourceTex, texelCoord * uInvSourceSize).r;
}
void main() {
  ivec2 pixel = ivec2(floor(gl_FragCoord.xy));
  ivec2 lane = pixel & 1;
  ivec2 base = (pixel >> 1) + ivec2(3, 3);
  float fetched = sampleTap(base, lane);
  vec4 gathered = quadGatherFloat(fetched);
  vec4 got = vec4(moveFloat(gathered,lane,ivec2(0,0)), moveFloat(gathered,lane,ivec2(1,0)), moveFloat(gathered,lane,ivec2(0,1)), moveFloat(gathered,lane,ivec2(1,1)));
  vec4 expv = vec4(sampleTap(base,ivec2(0,0)), sampleTap(base,ivec2(1,0)), sampleTap(base,ivec2(0,1)), sampleTap(base,ivec2(1,1)));
  vec4 err = abs(got - expv);
  bool pass = max(max(err.x, err.y), max(err.z, err.w)) <= (2.0 / 255.0);
  outColor = pass ? vec4(0.05,0.85,0.20,1.0) : vec4(0.95,0.12,0.08,1.0);
}
`;

const manualShadowFragmentSource = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uDepthTex;
uniform vec2 uInvDepthSize;
uniform float uRefDepth;
out vec4 outColor;
${commonPqa}
float shadowTap(ivec2 base, ivec2 tapLane) {
  vec2 uv = (vec2(base + tapLane) + vec2(0.5)) * uInvDepthSize;
  float depth = texture(uDepthTex, uv).r;
  return uRefDepth <= depth ? 1.0 : 0.0;
}
void main() {
  ivec2 pixel = ivec2(floor(gl_FragCoord.xy));
  ivec2 lane = pixel & 1;
  ivec2 base = (pixel >> 1) + ivec2(3, 3);
  float fetched = shadowTap(base, lane);
  vec4 gathered = quadGatherFloat(fetched);
  vec4 got = vec4(moveFloat(gathered,lane,ivec2(0,0)), moveFloat(gathered,lane,ivec2(1,0)), moveFloat(gathered,lane,ivec2(0,1)), moveFloat(gathered,lane,ivec2(1,1)));
  vec4 expv = vec4(shadowTap(base,ivec2(0,0)), shadowTap(base,ivec2(1,0)), shadowTap(base,ivec2(0,1)), shadowTap(base,ivec2(1,1)));
  vec4 err = abs(got - expv);
  bool pass = max(max(err.x, err.y), max(err.z, err.w)) <= 0.01;
  outColor = pass ? vec4(0.05,0.85,0.20,1.0) : vec4(0.95,0.12,0.08,1.0);
}
`;

const samplerShadowFragmentSource = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DShadow;
uniform sampler2DShadow uShadowMap;
uniform vec2 uInvShadowSize;
uniform float uRefDepth;
out vec4 outColor;
${commonPqa}
float shadowTap(ivec2 base, ivec2 tapLane) {
  vec2 uv = (vec2(base + tapLane) + vec2(0.5)) * uInvShadowSize;
  return texture(uShadowMap, vec3(uv, uRefDepth));
}
void main() {
  ivec2 pixel = ivec2(floor(gl_FragCoord.xy));
  ivec2 lane = pixel & 1;
  ivec2 base = (pixel >> 1) + ivec2(3, 3);
  float fetched = shadowTap(base, lane);
  vec4 gathered = quadGatherFloat(fetched);
  vec4 got = vec4(moveFloat(gathered,lane,ivec2(0,0)), moveFloat(gathered,lane,ivec2(1,0)), moveFloat(gathered,lane,ivec2(0,1)), moveFloat(gathered,lane,ivec2(1,1)));
  vec4 expv = vec4(shadowTap(base,ivec2(0,0)), shadowTap(base,ivec2(1,0)), shadowTap(base,ivec2(0,1)), shadowTap(base,ivec2(1,1)));
  vec4 err = abs(got - expv);
  bool pass = max(max(err.x, err.y), max(err.z, err.w)) <= 0.01;
  outColor = pass ? vec4(0.05,0.85,0.20,1.0) : vec4(0.95,0.12,0.08,1.0);
}
`;

const robustnessFragmentSource = `#version 300 es
precision highp float;
precision highp int;
uniform int uProbeKind;
out vec4 outColor;
${commonPqa}
float sourceValue(ivec2 lane) { return (lane.x == 0 && lane.y == 0) ? 1.0 : 0.0; }
void main() {
  ivec2 pixel = ivec2(floor(gl_FragCoord.xy));
  ivec2 lane = pixel & 1;
  float src = sourceValue(lane);
  float moved = 0.0;
  if (uProbeKind == 2) {
    // Intentionally invalid pattern, not a support test:
    // only one lane enters the derivative/message-passing path. Derivatives
    // inside non-uniform control flow are unsafe/undefined in GLSL ES. This
    // demo is expected to fail and simply shows what not to do.
    if (lane.x == 0 && lane.y == 0) {
      vec4 gathered = quadGatherFloat(src);
      moved = moveFloat(gathered, lane, ivec2(0,0));
    } else {
      moved = 0.0;
    }
  } else {
    // Valid article-style path: every lane executes the same derivative code.
    vec4 gathered = quadGatherFloat(src);
    moved = moveFloat(gathered, lane, ivec2(0,0));
  }
  bool pass = abs(moved - 1.0) < 0.01;
  outColor = pass ? vec4(0.05,0.85,0.20,1.0) : vec4(0.95,0.12,0.08,1.0);
}
`;

function glErrorName(gl: WebGL2RenderingContext, err: number): string {
  switch (err) {
    case gl.INVALID_ENUM:
      return 'INVALID_ENUM';
    case gl.INVALID_VALUE:
      return 'INVALID_VALUE';
    case gl.INVALID_OPERATION:
      return 'INVALID_OPERATION';
    case gl.INVALID_FRAMEBUFFER_OPERATION:
      return 'INVALID_FRAMEBUFFER_OPERATION';
    case gl.OUT_OF_MEMORY:
      return 'OUT_OF_MEMORY';
    case gl.CONTEXT_LOST_WEBGL:
      return 'CONTEXT_LOST_WEBGL';
    default:
      return `0x${err.toString(16)}`;
  }
}

function assertNoGlError(gl: WebGL2RenderingContext, label: string): void {
  const errors: string[] = [];
  for (;;) {
    const err = gl.getError();
    if (err === gl.NO_ERROR) break;
    errors.push(`${glErrorName(gl, err)} (0x${err.toString(16)})`);
  }
  if (errors.length > 0) {
    throw new Error(`${label}: GL error(s): ${errors.join(', ')}`);
  }
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program.');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown program link error.';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function createResultTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create result texture.');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  assertNoGlError(gl, `createResultTexture ${width}x${height}`);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function laneFractionalByte(lane: Lane): number {
  // Deliberately non-affine over the 2x2 quad. Keep this in sync with
  // laneFractionalValue() in the broadcast fragment shader.
  const idx = lane[0] + lane[1] * 2;
  return [32, 113, 181, 77][idx];
}

function laneRealFloatValue(lane: Lane): number {
  const idx = lane[0] + lane[1] * 2;
  return [0.03125, 0.27182818, 0.61803399, 0.9375][idx];
}

function uniqueByte(x: number, y: number): number {
  return (19 + x * 37 + y * 53) & 255;
}

function createScalarSourceTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  sourceLane: Lane,
  testKind: TestKind,
  textureStorage: TextureStorage
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create source texture.');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  if (textureStorage === 'r32f') {
    const data = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lane: Lane = [x & 1, y & 1];
        const selected = lane[0] === sourceLane[0] && lane[1] === sourceLane[1];
        data[y * width + x] =
          testKind === 'binaryScalar'
            ? selected
              ? 1.0
              : 0.0
            : laneRealFloatValue(lane);
      }
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      width,
      height,
      0,
      gl.RED,
      gl.FLOAT,
      data
    );
  } else {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lane: Lane = [x & 1, y & 1];
        const selected = lane[0] === sourceLane[0] && lane[1] === sourceLane[1];
        const i = (y * width + x) * 4;
        data[i] =
          testKind === 'binaryScalar'
            ? selected
              ? 255
              : 0
            : laneFractionalByte(lane);
        data[i + 3] = 255;
      }
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );
  }

  assertNoGlError(gl, `createScalarSourceTexture ${textureStorage}`);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function createUniqueRgba8Texture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  filter: number
): WebGLTexture {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = uniqueByte(x, y);
      data[i + 3] = 255;
    }
  }
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create RGBA8 texture.');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data
  );
  assertNoGlError(gl, `createUniqueRgba8Texture ${width}x${height}`);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function createDepthTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  compareMode: DepthCompareMode
): WebGLTexture {
  const data = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = Math.round((uniqueByte(x, y) / 255) * 65535);
    }
  }

  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create depth texture.');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_COMPARE_MODE,
    compareMode === 'shadow' ? gl.COMPARE_REF_TO_TEXTURE : gl.NONE
  );
  if (compareMode === 'shadow') {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.DEPTH_COMPONENT16,
    width,
    height,
    0,
    gl.DEPTH_COMPONENT,
    gl.UNSIGNED_SHORT,
    data
  );
  assertNoGlError(gl, `createDepthTexture ${compareMode}`);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function analyzePixelsRegion(
  pixels: Uint8Array,
  fullWidth: number,
  x0: number,
  y0: number,
  width: number,
  height: number,
  visualXOffset = 0
) {
  let passCount = 0;
  let failCount = 0;
  const failedPixels: Array<{
    x: number;
    y: number;
    rgba: [number, number, number, number];
  }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = x0 + x;
      const srcY = y0 + y;
      const i = (srcY * fullWidth + srcX) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      if (g > r && g > 128) {
        passCount++;
      } else {
        failCount++;
        if (failedPixels.length < 16) {
          failedPixels.push({
            x: visualXOffset + srcX,
            y: srcY,
            rgba: [r, g, b, a],
          });
        }
      }
    }
  }

  return { passCount, failCount, failedPixels };
}

function analyzePixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  visualXOffset = 0
) {
  return analyzePixelsRegion(pixels, width, 0, 0, width, height, visualXOffset);
}

function copyRegionIntoComposite(
  dst: Uint8Array,
  dstWidth: number,
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstX: number,
  dstY: number
) {
  for (let y = 0; y < srcHeight; y++) {
    for (let x = 0; x < srcWidth; x++) {
      const si = (y * srcWidth + x) * 4;
      const di = ((dstY + y) * dstWidth + (dstX + x)) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
}

function drawPixelsToCanvas(
  canvas: HTMLCanvasElement,
  pixelsBottomLeft: Uint8Array,
  width: number,
  height: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`2D canvas unavailable for #${canvas.id}.`);
  const image = ctx.createImageData(width, height);

  // readPixels returns rows bottom-to-top. ImageData expects rows top-to-bottom.
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const si = (srcY * width + x) * 4;
      const di = (y * width + x) * 4;
      image.data[di] = pixelsBottomLeft[si];
      image.data[di + 1] = pixelsBottomLeft[si + 1];
      image.data[di + 2] = pixelsBottomLeft[si + 2];
      image.data[di + 3] = pixelsBottomLeft[si + 3];
    }
  }

  ctx.putImageData(image, 0, 0);
}

function derivativeHintName(gl: WebGL2RenderingContext, value: number): string {
  if (value === gl.FASTEST) return 'FASTEST';
  if (value === gl.NICEST) return 'NICEST';
  if (value === gl.DONT_CARE) return 'DONT_CARE';
  return `0x${value.toString(16)}`;
}

function makeGlInfo(gl: WebGL2RenderingContext): Record<string, string> {
  const derivativeHint = gl.getParameter(gl.FRAGMENT_SHADER_DERIVATIVE_HINT);
  return {
    VENDOR: String(gl.getParameter(gl.VENDOR)),
    RENDERER: String(gl.getParameter(gl.RENDERER)),
    VERSION: String(gl.getParameter(gl.VERSION)),
    SHADING_LANGUAGE_VERSION: String(
      gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
    ),
    FRAGMENT_SHADER_DERIVATIVE_HINT: `${derivativeHintName(
      gl,
      derivativeHint
    )} (${derivativeHint})`,
  };
}

class TestRunner {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly vao: WebGLVertexArrayObject;
  readonly glInfo: Record<string, string>;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '-10000px';
    this.canvas.style.top = '-10000px';
    this.canvas.style.width = '1px';
    this.canvas.style.height = '1px';
    document.body.appendChild(this.canvas);

    const gl = this.canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 not available.');

    // Ask for the highest-quality derivative path before compiling/running any
    // derivative shaders. This is only a hint, not a guarantee, but the report
    // records the resulting state so we can see whether it changes behavior on
    // any browser/GPU stack.
    gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
    assertNoGlError(gl, 'set FRAGMENT_SHADER_DERIVATIVE_HINT to NICEST');

    this.gl = gl;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO.');
    this.vao = vao;
    this.glInfo = makeGlInfo(gl);
  }

  dispose() {
    this.gl.deleteVertexArray(this.vao);
    this.canvas.remove();
  }

  createFramebuffer(width: number, height: number) {
    const gl = this.gl;
    const tex = createResultTexture(gl, width, height);
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      gl.deleteTexture(tex);
      throw new Error('Failed to create framebuffer.');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    );
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(tex);
      throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
    }
    assertNoGlError(gl, `createFramebuffer ${width}x${height}`);
    return { framebuffer, texture: tex };
  }

  readFramebuffer(width: number, height: number): Uint8Array {
    const gl = this.gl;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    assertNoGlError(gl, `readPixels ${width}x${height}`);
    return pixels;
  }

  clearAndDraw(program: WebGLProgram, viewport: { x: number; y: number; width: number; height: number }) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    assertNoGlError(gl, 'drawArrays');
  }
}

function runBroadcastTest(
  runner: TestRunner,
  canvas: HTMLCanvasElement,
  name: string,
  sourceMode: SourceMode,
  testKind: TestKind,
  textureStorage: TextureStorage = 'rgba8'
): RunResult {
  const gl = runner.gl;
  const program = createProgram(gl, vertexSource, broadcastFragmentSource);
  const fb = runner.createFramebuffer(TEST_W, TEST_H);
  const sourceResults: SourceLaneResult[] = [];
  const composite = new Uint8Array(VIS_W * VIS_H * 4);

  let skipped = false;
  let skipReason = '';

  try {
    const uSourceMode = gl.getUniformLocation(program, 'uSourceMode');
    const uTestKind = gl.getUniformLocation(program, 'uTestKind');
    const uRealFloatValues = gl.getUniformLocation(program, 'uRealFloatValues');
    const uSourceLane = gl.getUniformLocation(program, 'uSourceLane');
    const uTestTex = gl.getUniformLocation(program, 'uTestTex');

    gl.useProgram(program);
    gl.bindVertexArray(runner.vao);

    for (let i = 0; i < SOURCE_LANES.length; i++) {
      const source = SOURCE_LANES[i];
      let sourceTexture: WebGLTexture | null = null;

      if (sourceMode === 'texture') {
        sourceTexture = createScalarSourceTexture(
          gl,
          TEST_W,
          TEST_H,
          source.lane,
          testKind,
          textureStorage
        );
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, fb.framebuffer);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, TEST_W, TEST_H);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(runner.vao);
      gl.uniform1i(uSourceMode, SOURCE_MODE_ID[sourceMode]);
      gl.uniform1i(uTestKind, TEST_KIND_ID[testKind]);
      gl.uniform1i(
        uRealFloatValues,
        textureStorage === 'r32f' && testKind === 'fractionalScalar' ? 1 : 0
      );
      gl.uniform2i(uSourceLane, source.lane[0], source.lane[1]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      gl.uniform1i(uTestTex, 0);
      assertNoGlError(gl, `${name} setup source lane ${source.name}`);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      assertNoGlError(gl, `${name} draw source lane ${source.name}`);

      const pixels = runner.readFramebuffer(TEST_W, TEST_H);
      const analysis = analyzePixels(pixels, TEST_W, TEST_H, i * TEST_W);
      sourceResults.push({
        sourceLaneName: source.name,
        sourceLane: source.lane,
        passCount: analysis.passCount,
        failCount: analysis.failCount,
        failedPixels: analysis.failedPixels,
      });

      copyRegionIntoComposite(composite, VIS_W, pixels, TEST_W, TEST_H, i * TEST_W, 0);
      if (sourceTexture) gl.deleteTexture(sourceTexture);
    }
  } catch (err) {
    skipped = true;
    skipReason = err instanceof Error ? err.message : String(err);
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb.framebuffer);
    gl.deleteTexture(fb.texture);
    gl.deleteProgram(program);
  }

  drawPixelsToCanvas(canvas, composite, VIS_W, VIS_H);

  return {
    result: {
      name,
      width: VIS_W,
      height: VIS_H,
      sourceResults,
      skipped,
      skipReason,
    },
    glInfo: runner.glInfo,
  };
}

function runSimpleDraw(
  runner: TestRunner,
  canvas: HTMLCanvasElement,
  name: string,
  shader: string,
  setup: (
    gl: WebGL2RenderingContext,
    program: WebGLProgram
  ) => WebGLTexture | null,
  options?: {
    framebufferWidth?: number;
    framebufferHeight?: number;
    viewport?: { x: number; y: number; width: number; height: number };
    analyzeRegion?: { x: number; y: number; width: number; height: number; visualXOffset?: number };
    informational?: boolean;
  }
): SimpleRunResult {
  const gl = runner.gl;
  const framebufferWidth = options?.framebufferWidth ?? canvas.width;
  const framebufferHeight = options?.framebufferHeight ?? canvas.height;
  const viewport = options?.viewport ?? {
    x: 0,
    y: 0,
    width: framebufferWidth,
    height: framebufferHeight,
  };
  const analyzeRegion = options?.analyzeRegion ?? {
    x: 0,
    y: 0,
    width: framebufferWidth,
    height: framebufferHeight,
    visualXOffset: 0,
  };

  let texture: WebGLTexture | null = null;
  let program: WebGLProgram | null = null;
  let fb: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null;

  try {
    program = createProgram(gl, vertexSource, shader);
    fb = runner.createFramebuffer(framebufferWidth, framebufferHeight);

    // Important: uniforms are set on the currently active program.
    // setup() must run after useProgram(), otherwise uniform calls generate INVALID_OPERATION.
    gl.useProgram(program);
    gl.bindVertexArray(runner.vao);
    texture = setup(gl, program);
    assertNoGlError(gl, `${name} setup`);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb.framebuffer);
    runner.clearAndDraw(program, viewport);

    const pixels = runner.readFramebuffer(framebufferWidth, framebufferHeight);
    drawPixelsToCanvas(canvas, pixels, framebufferWidth, framebufferHeight);

    const analysis = analyzePixelsRegion(
      pixels,
      framebufferWidth,
      analyzeRegion.x,
      analyzeRegion.y,
      analyzeRegion.width,
      analyzeRegion.height,
      analyzeRegion.visualXOffset ?? 0
    );

    return {
      result: {
        name,
        width: analyzeRegion.width,
        height: analyzeRegion.height,
        passCount: analysis.passCount,
        failCount: analysis.failCount,
        failedPixels: analysis.failedPixels,
        informational: !!options?.informational,
      },
      glInfo: runner.glInfo,
    };
  } catch (err) {
    return {
      result: {
        name,
        width: analyzeRegion.width,
        height: analyzeRegion.height,
        passCount: 0,
        failCount: 0,
        failedPixels: [],
        skipped: true,
        informational: !!options?.informational,
        skipReason: err instanceof Error ? err.message : String(err),
      },
      glInfo: runner.glInfo,
    };
  } finally {
    if (texture) gl.deleteTexture(texture);
    if (fb) {
      gl.deleteFramebuffer(fb.framebuffer);
      gl.deleteTexture(fb.texture);
    }
    if (program) gl.deleteProgram(program);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

function runViewportOffsetProbe(runner: TestRunner, canvas: HTMLCanvasElement): SimpleRunResult {
  return runSimpleDraw(
    runner,
    canvas,
    'viewport offset probe',
    robustnessFragmentSource,
    (gl, program) => {
      gl.uniform1i(gl.getUniformLocation(program, 'uProbeKind'), 0);
      return null;
    },
    {
      framebufferWidth: 10,
      framebufferHeight: 10,
      viewport: { x: 1, y: 1, width: 8, height: 8 },
      analyzeRegion: { x: 1, y: 1, width: 8, height: 8, visualXOffset: 1 },
      informational: true,
    }
  );
}

function runRobustnessProbe(
  runner: TestRunner,
  canvas: HTMLCanvasElement,
  name: string,
  probeKind: number,
  informational = true
): SimpleRunResult {
  return runSimpleDraw(
    runner,
    canvas,
    name,
    robustnessFragmentSource,
    (gl, program) => {
      gl.uniform1i(gl.getUniformLocation(program, 'uProbeKind'), probeKind);
      return null;
    },
    { informational }
  );
}

function runJbuTest(runner: TestRunner, canvas: HTMLCanvasElement): SimpleRunResult {
  return runSimpleDraw(
    runner,
    canvas,
    'JBU-shaped half-res 2x gather',
    jbuFragmentSource,
    (gl, program) => {
      const tex = createUniqueRgba8Texture(
        gl,
        JBU_LOW_W,
        JBU_LOW_H,
        gl.NEAREST
      );
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(program, 'uLowTex'), 0);
      return tex;
    }
  );
}

function runSamplingTest(
  runner: TestRunner,
  canvas: HTMLCanvasElement,
  filter: SamplingFilter
): SimpleRunResult {
  return runSimpleDraw(
    runner,
    canvas,
    `texture() ${filter.toUpperCase()} offset gather`,
    samplingFragmentSource,
    (gl, program) => {
      const tex = createUniqueRgba8Texture(
        gl,
        SAMPLE_TEX_W,
        SAMPLE_TEX_H,
        filter === 'nearest' ? gl.NEAREST : gl.LINEAR
      );
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(program, 'uSourceTex'), 0);
      gl.uniform2f(
        gl.getUniformLocation(program, 'uInvSourceSize'),
        1 / SAMPLE_TEX_W,
        1 / SAMPLE_TEX_H
      );
      gl.uniform2f(
        gl.getUniformLocation(program, 'uSubTexelOffset'),
        filter === 'nearest' ? 0.5 : 0.37,
        filter === 'nearest' ? 0.5 : 0.61
      );
      return tex;
    }
  );
}

function runManualShadowTest(runner: TestRunner, canvas: HTMLCanvasElement): SimpleRunResult {
  return runSimpleDraw(
    runner,
    canvas,
    'manual depth shadow compare offset gather',
    manualShadowFragmentSource,
    (gl, program) => {
      const tex = createDepthTexture(gl, SHADOW_TEX_W, SHADOW_TEX_H, 'none');
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(program, 'uDepthTex'), 0);
      gl.uniform2f(
        gl.getUniformLocation(program, 'uInvDepthSize'),
        1 / SHADOW_TEX_W,
        1 / SHADOW_TEX_H
      );
      gl.uniform1f(gl.getUniformLocation(program, 'uRefDepth'), SHADOW_REF);
      return tex;
    }
  );
}

function runSamplerShadowTest(runner: TestRunner, canvas: HTMLCanvasElement): SimpleRunResult {
  return runSimpleDraw(
    runner,
    canvas,
    'sampler2DShadow offset gather',
    samplerShadowFragmentSource,
    (gl, program) => {
      const tex = createDepthTexture(gl, SHADOW_TEX_W, SHADOW_TEX_H, 'shadow');
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(program, 'uShadowMap'), 0);
      gl.uniform2f(
        gl.getUniformLocation(program, 'uInvShadowSize'),
        1 / SHADOW_TEX_W,
        1 / SHADOW_TEX_H
      );
      gl.uniform1f(gl.getUniformLocation(program, 'uRefDepth'), SHADOW_REF);
      return tex;
    }
  );
}

function totalPassFail(result: TestResult) {
  let pass = 0;
  let fail = 0;
  for (const s of result.sourceResults) {
    pass += s.passCount;
    fail += s.failCount;
  }
  return { pass, fail };
}

function testPassed(result: TestResult): boolean {
  return !result.skipped && totalPassFail(result).fail === 0 && result.sourceResults.length === SOURCE_LANES.length;
}

function simplePassed(result: SimpleResult): boolean {
  return !result.skipped && result.failCount === 0;
}

function summarizeBroadcast(result: TestResult) {
  const totals = totalPassFail(result);
  return {
    name: result.name,
    kind: 'broadcast',
    skipped: !!result.skipped,
    skipReason: result.skipReason ?? null,
    passed: testPassed(result),
    passCount: totals.pass,
    failCount: totals.fail,
    sourceLanes: result.sourceResults.map((s) => ({
      name: s.sourceLaneName,
      lane: s.sourceLane,
      passed: s.failCount === 0,
      passCount: s.passCount,
      failCount: s.failCount,
    })),
  };
}

function summarizeSimple(result: SimpleResult) {
  return {
    name: result.name,
    kind: 'simple',
    informational: !!result.informational,
    skipped: !!result.skipped,
    skipReason: result.skipReason ?? null,
    passed: simplePassed(result),
    passCount: result.passCount,
    failCount: result.failCount,
  };
}

function formatTestResult(result: TestResult): string {
  if (result.skipped) {
    return [
      `SKIPPED: ${result.name}`,
      `Reason: ${result.skipReason ?? 'unknown'}`,
    ].join(NL);
  }
  const totals = totalPassFail(result);
  const total = result.sourceResults.length * TEST_W * TEST_H;
  const lines = [
    totals.fail === 0 ? `PASS: ${result.name}` : `FAIL: ${result.name}`,
    `Actual test size per source lane: ${TEST_W}×${TEST_H}`,
    `Source lanes tested:             ${result.sourceResults.length}`,
    `Pixels tested:                   ${total}`,
    `Passed:                          ${totals.pass}`,
    `Failed:                          ${totals.fail}`,
    '',
  ];
  for (const s of result.sourceResults) {
    lines.push(
      `${s.failCount === 0 ? 'PASS' : 'FAIL'} source ${s.sourceLaneName}: ${
        s.passCount
      } passed, ${s.failCount} failed`
    );
  }
  return lines.join(NL);
}

function formatSimpleResult(result: SimpleResult, extra: string): string {
  if (result.skipped) {
    return [
      `SKIPPED: ${result.name}`,
      `Reason: ${result.skipReason ?? 'unknown'}`,
    ].join(NL);
  }
  const total = result.width * result.height;
  const label = result.informational
    ? result.failCount === 0
      ? 'INFO PASS'
      : 'INFO FAIL'
    : result.failCount === 0
    ? 'PASS'
    : 'FAIL';
  const lines = [
    `${label}: ${result.name}`,
    extra,
    `Pixels tested: ${total}`,
    `Passed:        ${result.passCount}`,
    `Failed:        ${result.failCount}`,
  ];
  if (result.failCount > 0 && result.failedPixels.length > 0) {
    lines.push('First failed pixels:');
    for (const p of result.failedPixels) {
      lines.push(`  (${p.x}, ${p.y}) rgba = [${p.rgba.join(', ')}]`);
    }
  }
  return lines.join(NL);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusLine(ok: boolean, label: string, warning = false): string {
  const icon = ok ? '✅' : warning ? '⚠️' : '❌';
  return `<div style="margin:3px 0;">${icon} ${escapeHtml(label)}</div>`;
}

function detailsBlock(title: string, body: string, state: 'pass' | 'fail' | 'skip' | 'info' | 'expected'): string {
  const icon = state === 'pass' ? '✅' : state === 'fail' ? '❌' : state === 'skip' ? '⏭️' : state === 'expected' ? '✅' : 'ℹ️';
  const border = state === 'fail' ? '#5a2a2a' : state === 'skip' ? '#5a4a2a' : '#2a3140';
  const background = state === 'fail' ? '#211719' : state === 'skip' ? '#211d15' : '#111722';
  return `
    <details style="margin:8px 0;border:1px solid ${border};border-radius:10px;background:${background};overflow:hidden;">
      <summary style="padding:10px 12px;cursor:pointer;font-weight:650;color:#e8ecf1;">
        ${icon} ${escapeHtml(title)}
      </summary>
      <pre style="margin:0;padding:12px;border-top:1px solid ${border};white-space:pre-wrap;overflow:auto;color:#cfd8e3;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.45;">${escapeHtml(body)}</pre>
    </details>`;
}

function broadcastDetailBlock(result: TestResult): string {
  const state: 'pass' | 'fail' | 'skip' = result.skipped ? 'skip' : testPassed(result) ? 'pass' : 'fail';
  return detailsBlock(result.name, formatTestResult(result), state);
}

function simpleDetailBlock(result: SimpleResult, extra: string, expectedFailure = false): string {
  let state: 'pass' | 'fail' | 'skip' | 'info' | 'expected';
  if (result.skipped) state = 'skip';
  else if (expectedFailure) state = result.failCount > 0 ? 'expected' : 'info';
  else if (result.informational) state = simplePassed(result) ? 'pass' : 'info';
  else state = simplePassed(result) ? 'pass' : 'fail';
  return detailsBlock(result.name, formatSimpleResult(result, extra), state);
}

try {
  const runner = new TestRunner();

  const binaryProc = runBroadcastTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#procCanvas')!,
    'binary procedural scalar source-lane move/broadcast',
    'procedural',
    'binaryScalar'
  );
  const binaryTex = runBroadcastTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#texCanvas')!,
    'binary RGBA8 texture scalar source-lane move/broadcast',
    'texture',
    'binaryScalar',
    'rgba8'
  );
  const fracProc = runBroadcastTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#fracProcCanvas')!,
    'fractional procedural scalar source-lane move/broadcast',
    'procedural',
    'fractionalScalar'
  );
  const fracTex = runBroadcastTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#fracTexCanvas')!,
    'fractional RGBA8 texture scalar source-lane move/broadcast',
    'texture',
    'fractionalScalar',
    'rgba8'
  );
  const floatTex = runBroadcastTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#floatTexCanvas')!,
    'R32F real-float texture scalar source-lane move/broadcast',
    'texture',
    'fractionalScalar',
    'r32f'
  );
  const vec2Test = runBroadcastTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#vec2Canvas')!,
    'procedural vec2 source-lane move/broadcast',
    'procedural',
    'vec2'
  );
  const vec4Test = runBroadcastTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#vec4Canvas')!,
    'procedural vec4 source-lane move/broadcast',
    'procedural',
    'vec4'
  );
  const jbuTest = runJbuTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#jbuCanvas')!
  );
  const nearestTest = runSamplingTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#nearestCanvas')!,
    'nearest'
  );
  const linearTest = runSamplingTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#linearCanvas')!,
    'linear'
  );
  const manualShadowTest = runManualShadowTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#manualShadowCanvas')!
  );
  const samplerShadowTest = runSamplerShadowTest(
    runner,
    document.querySelector<HTMLCanvasElement>('#shadowSamplerCanvas')!
  );
  const viewportOffsetProbe = runViewportOffsetProbe(
    runner,
    document.querySelector<HTMLCanvasElement>('#viewportOffsetCanvas')!
  );
  const oddSizeProbe = runRobustnessProbe(
    runner,
    document.querySelector<HTMLCanvasElement>('#oddSizeCanvas')!,
    'odd-size target probe',
    0,
    true
  );
  const divergentProbe = runRobustnessProbe(
    runner,
    document.querySelector<HTMLCanvasElement>('#divergentCanvas')!,
    'invalid divergent branch demo',
    2,
    true
  );

  const capabilities = {
    scalarBroadcast:
      testPassed(binaryProc.result) && testPassed(binaryTex.result),
    fractionalScalarBroadcast:
      testPassed(fracProc.result) && testPassed(fracTex.result),
    realFloatR32FBroadcast: testPassed(floatTex.result),
    vectorBroadcast:
      testPassed(vec2Test.result) && testPassed(vec4Test.result),
    jbuGather: simplePassed(jbuTest.result),
    textureNearestGather: simplePassed(nearestTest.result),
    textureLinearGather: simplePassed(linearTest.result),
    textureNearestLinearGather:
      simplePassed(nearestTest.result) && simplePassed(linearTest.result),
    manualDepthShadowCompareGather: simplePassed(manualShadowTest.result),
    shadowSamplerGather: simplePassed(samplerShadowTest.result),
    viewportOffsetProbePassed: simplePassed(viewportOffsetProbe.result),
    oddSizeProbePassed: simplePassed(oddSizeProbe.result),
    invalidDivergentBranchDemoFailedAsExpected:
      !divergentProbe.result.skipped && divergentProbe.result.failCount > 0,
  };

  const milestone1Passed = capabilities.scalarBroadcast;
  const milestone2Passed =
    capabilities.fractionalScalarBroadcast && capabilities.realFloatR32FBroadcast;
  const milestone3Passed = capabilities.vectorBroadcast;
  const milestone4Passed = capabilities.jbuGather;
  const milestone5Passed = capabilities.textureNearestLinearGather;
  const milestone6Passed =
    capabilities.manualDepthShadowCompareGather && capabilities.shadowSamplerGather;
  const milestone7Complete =
    !viewportOffsetProbe.result.skipped &&
    !oddSizeProbe.result.skipped &&
    !divergentProbe.result.skipped;

  const allRequiredPassed =
    milestone1Passed &&
    milestone2Passed &&
    milestone3Passed &&
    milestone4Passed &&
    milestone5Passed &&
    milestone6Passed;

  const report = {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    verdict: {
      requiredPassed: allRequiredPassed,
      pqaRecommendedForAllTestedFastPaths: allRequiredPassed,
      note: allRequiredPassed
        ? 'Required PQA tests passed. Use the capability buckets and robustness probes to decide exact engine fast paths and fallbacks.'
        : 'At least one required PQA test failed or was skipped. Enable only the capability buckets that passed, and keep other PQA fast paths disabled.',
    },
    capabilities,
    testGroups: {
      coreScalarBroadcast: milestone1Passed,
      fractionalAndR32F: milestone2Passed,
      vectorWidths: milestone3Passed,
      jbuShapedGather: milestone4Passed,
      textureSamplingBlurBloom: milestone5Passed,
      shadowCompareGather: milestone6Passed,
      robustnessProbesExecuted: milestone7Complete,
      jsonReport: true,
    },
    gl: runner.glInfo,
    requiredTests: [
      summarizeBroadcast(binaryProc.result),
      summarizeBroadcast(binaryTex.result),
      summarizeBroadcast(fracProc.result),
      summarizeBroadcast(fracTex.result),
      summarizeBroadcast(floatTex.result),
      summarizeBroadcast(vec2Test.result),
      summarizeBroadcast(vec4Test.result),
      summarizeSimple(jbuTest.result),
      summarizeSimple(nearestTest.result),
      summarizeSimple(linearTest.result),
      summarizeSimple(manualShadowTest.result),
      summarizeSimple(samplerShadowTest.result),
    ],
    informationalProbes: [
      summarizeSimple(viewportOffsetProbe.result),
      summarizeSimple(oddSizeProbe.result),
      summarizeSimple(divergentProbe.result),
    ],
  };

  jsonReportEl.value = JSON.stringify(report, null, 2);
  copyReportButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(jsonReportEl.value);
      copyReportButton.textContent = 'Copied!';
      window.setTimeout(() => {
        copyReportButton.textContent = 'Copy JSON';
      }, 1200);
    } catch {
      jsonReportEl.focus();
      jsonReportEl.select();
      copyReportButton.textContent = 'Select + copy';
      window.setTimeout(() => {
        copyReportButton.textContent = 'Copy JSON';
      }, 1800);
    }
  };

  const detailedResultsHtml = [
    broadcastDetailBlock(binaryProc.result),
    broadcastDetailBlock(binaryTex.result),
    broadcastDetailBlock(fracProc.result),
    broadcastDetailBlock(fracTex.result),
    broadcastDetailBlock(floatTex.result),
    broadcastDetailBlock(vec2Test.result),
    broadcastDetailBlock(vec4Test.result),
    simpleDetailBlock(
      jbuTest.result,
      `High-res: 8×8; low-res texture: ${JBU_LOW_W}×${JBU_LOW_H}`
    ),
    simpleDetailBlock(
      nearestTest.result,
      `High-res: 8×8; source texture: ${SAMPLE_TEX_W}×${SAMPLE_TEX_H}; filter: NEAREST`
    ),
    simpleDetailBlock(
      linearTest.result,
      `High-res: 8×8; source texture: ${SAMPLE_TEX_W}×${SAMPLE_TEX_H}; filter: LINEAR; fractional offsets: 0.37, 0.61`
    ),
    simpleDetailBlock(
      manualShadowTest.result,
      `High-res: 8×8; depth source: DEPTH_COMPONENT16 sampler2D with compare mode NONE; reference depth: ${SHADOW_REF}`
    ),
    simpleDetailBlock(
      samplerShadowTest.result,
      `High-res: 8×8; depth source: DEPTH_COMPONENT16 sampler2DShadow with COMPARE_REF_TO_TEXTURE; reference depth: ${SHADOW_REF}`
    ),
    simpleDetailBlock(
      viewportOffsetProbe.result,
      'Viewport: x=1, y=1, width=8, height=8 inside a 10×10 target. Passing means global gl_FragCoord parity still works for this offset.'
    ),
    simpleDetailBlock(
      oddSizeProbe.result,
      'Target: 9×9. If this fails at borders, use a fallback for the final odd row/column.'
    ),
    simpleDetailBlock(
      divergentProbe.result,
      'Intentionally invalid derivative-in-nonuniform-branch demo. Failure is expected/healthy; passing does not make this pattern safe.',
      true
    ),
  ].join('');

  resultEl.innerHTML = `
    <section style="margin-bottom:14px;padding:14px;border-radius:10px;background:#111722;border:1px solid #263044;">
      <div style="font-size:18px;font-weight:750;margin-bottom:8px;">Quick status</div>
      <div style="font-size:15px;margin-bottom:10px;color:${allRequiredPassed ? '#bdf7c8' : '#ffc9c9'};">
        ${allRequiredPassed
          ? '✅ Overall: all required PQA derivative message-passing tests passed.'
          : '❌ Overall: one or more required PQA tests failed or were skipped.'}
      </div>
      <div style="font-weight:700;margin:12px 0 5px;">Required capabilities</div>
      ${statusLine(capabilities.scalarBroadcast, 'Scalar broadcast (procedural + RGBA8 texture)')}
      ${statusLine(capabilities.fractionalScalarBroadcast, 'Fractional scalar broadcast (procedural + RGBA8 texture)')}
      ${statusLine(capabilities.realFloatR32FBroadcast, 'Real-float R32F broadcast')}
      ${statusLine(capabilities.vectorBroadcast, 'Vector broadcast (vec2 + vec4)')}
      ${statusLine(capabilities.jbuGather, 'JBU-shaped half-res gather')}
      ${statusLine(capabilities.textureNearestGather, 'texture() NEAREST offset gather')}
      ${statusLine(capabilities.textureLinearGather, 'texture() LINEAR offset gather')}
      ${statusLine(capabilities.manualDepthShadowCompareGather, 'Manual depth shadow compare gather')}
      ${statusLine(capabilities.shadowSamplerGather, 'sampler2DShadow compare gather')}
      <div style="font-weight:700;margin:12px 0 5px;">Informational probes</div>
      ${statusLine(capabilities.viewportOffsetProbePassed, 'Viewport offset probe')}
      ${statusLine(capabilities.oddSizeProbePassed, 'Odd-size target probe')}
      ${statusLine(
        capabilities.invalidDivergentBranchDemoFailedAsExpected,
        'Invalid divergent branch demo failed as expected',
        true
      )}
    </section>

    <section style="margin-bottom:14px;padding:14px;border-radius:10px;background:#111722;border:1px solid #263044;">
      <div style="font-size:16px;font-weight:750;margin-bottom:4px;">Practical meaning</div>
      <div style="color:#cfd8e3;">
        ${allRequiredPassed
          ? 'PQA looks viable for the tested scalar/vector, JBU, blur/bloom, and shadow-like paths. Use the robustness probes to decide where to apply fallbacks or warnings.'
          : 'Enable only the specific capability buckets that passed. Keep failed or skipped PQA fast paths disabled on this device/browser.'}
      </div>
    </section>

    <section style="margin-bottom:14px;">
      <div style="font-size:16px;font-weight:750;margin-bottom:4px;">Detailed results</div>
      <div style="color:#aeb7c2;margin-bottom:8px;">Click a test row to expand the full readback details.</div>
      ${detailedResultsHtml}
    </section>

    <section style="margin-top:14px;padding:14px;border-radius:10px;background:#111722;border:1px solid #263044;">
      <div style="font-size:16px;font-weight:750;margin-bottom:8px;">GL info</div>
      <pre style="margin:0;white-space:pre-wrap;color:#cfd8e3;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.45;">${escapeHtml([
        `VENDOR:                   ${runner.glInfo.VENDOR}`,
        `RENDERER:                 ${runner.glInfo.RENDERER}`,
        `VERSION:                  ${runner.glInfo.VERSION}`,
        `SHADING_LANGUAGE_VERSION: ${runner.glInfo.SHADING_LANGUAGE_VERSION}`,
          `FRAGMENT_SHADER_DERIVATIVE_HINT: ${runner.glInfo.FRAGMENT_SHADER_DERIVATIVE_HINT}`,
      ].join(NL))}</pre>
    </section>
  `;
} catch (err) {
  resultEl.textContent = [
    'Error:',
    err instanceof Error ? err.message : String(err),
  ].join(NL);
  jsonReportEl.value = JSON.stringify(
    {
      reportVersion: 1,
      generatedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
      userAgent: navigator.userAgent,
    },
    null,
    2
  );
}
