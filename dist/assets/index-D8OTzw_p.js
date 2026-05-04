(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`
`,t=document.querySelector(`#app`)??document.body.appendChild(document.createElement(`div`));document.body.style.margin=`0`,document.body.style.background=`#101218`,document.body.style.color=`#e8ecf1`,document.body.style.fontFamily=`system-ui, -apple-system, BlinkMacSystemFont, sans-serif`,t.innerHTML=`
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
      ${[[`procCanvas`,`Binary procedural scalar`,`4 strips: LL, LR, UL, UR source lane`,32,8,512,128],[`texCanvas`,`Binary RGBA8 texture scalar`,`4 strips: LL, LR, UL, UR source lane`,32,8,512,128],[`fracProcCanvas`,`Fractional procedural scalar`,`4 strips: LL, LR, UL, UR source lane`,32,8,512,128],[`fracTexCanvas`,`Fractional RGBA8 texture scalar`,`4 strips: LL, LR, UL, UR source lane`,32,8,512,128],[`floatTexCanvas`,`R32F real-float texture scalar`,`4 strips: LL, LR, UL, UR source lane`,32,8,512,128],[`vec2Canvas`,`Procedural vec2`,`4 strips: LL, LR, UL, UR source lane`,32,8,512,128],[`vec4Canvas`,`Procedural vec4`,`4 strips: LL, LR, UL, UR source lane`,32,8,512,128],[`jbuCanvas`,`JBU-shaped half-res gather`,`8×8 high-res; 5×5 low-res texture`,8,8,256,256],[`nearestCanvas`,`texture() NEAREST offset gather`,`blur/bloom-shaped texture() taps`,8,8,256,256],[`linearCanvas`,`texture() LINEAR offset gather`,`blur/bloom-shaped interpolated taps`,8,8,256,256],[`manualShadowCanvas`,`Manual depth shadow compare gather`,`DEPTH_COMPONENT16 sampler2D fetch + manual compare`,8,8,256,256],[`shadowSamplerCanvas`,`sampler2DShadow gather`,`hardware shadow compare sampler, if supported`,8,8,256,256],[`viewportOffsetCanvas`,`Viewport offset probe`,`8×8 PQA viewport at offset (1,1) inside a 10×10 target`,10,10,256,256],[`oddSizeCanvas`,`Odd-size target probe`,`9×9 target; last row/column may need fallback in real passes`,9,9,256,256],[`divergentCanvas`,`Invalid divergent branch demo`,`intentionally unsafe derivative-in-branch case; expected to fail`,8,8,256,256]].map(([e,t,n,r,i,a,o])=>`
        <div><div style="margin-bottom:6px;color:#aeb7c2;">${t}</div>
        <canvas id="${e}" width="${r}" height="${i}" style="width:${a}px;height:${o}px;image-rendering:pixelated;border:1px solid #2a3140;border-radius:8px;background:black;"></canvas>
        <div style="margin-top:6px;color:#7f8a99;font-size:13px;max-width:${a}px;">${n}</div></div>`).join(``)}
    </div>
  </div>
`;var n=document.querySelector(`#result`),r=document.querySelector(`#jsonReport`),i=document.querySelector(`#copyReportButton`),a=8,o=8,s=a*4,c=o,l=5,u=5,d=12,f=12,p=12,m=12,h=.47,g=[{name:`LL / lower-left  (0,0)`,lane:[0,0]},{name:`LR / lower-right (1,0)`,lane:[1,0]},{name:`UL / upper-left  (0,1)`,lane:[0,1]},{name:`UR / upper-right (1,1)`,lane:[1,1]}],_={binaryScalar:0,fractionalScalar:1,vec2:2,vec4:3},v={procedural:0,texture:1},y=`#version 300 es
precision highp float;
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() { gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0); }
`,b=`
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
`,x=`#version 300 es
precision highp float;
precision highp int;
uniform int uSourceMode;
uniform int uTestKind;
uniform int uRealFloatValues;
uniform ivec2 uSourceLane;
uniform sampler2D uTestTex;
out vec4 outColor;
${b}
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
float laneFractionalValue(ivec2 lane) { int byteValue = 32 + lane.x * 64 + lane.y * 128; return float(byteValue) / 255.0; }
float laneRealFloatValue(ivec2 lane) {
  int idx = lane.x + lane.y * 2;
  if (idx == 0) return 0.03125;
  if (idx == 1) return 0.27182818;
  if (idx == 2) return 0.61803399;
  return 0.9375;
}
vec2 laneVec2Value(ivec2 lane) { int idx = lane.x + lane.y * 2; return vec2(float(17 + idx * 37) / 255.0, float(211 - idx * 29) / 255.0); }
vec4 laneVec4Value(ivec2 lane) { int idx = lane.x + lane.y * 2; return vec4(float(23 + idx * 31) / 255.0, float(71 + idx * 17) / 255.0, float(197 - idx * 23) / 255.0, float(149 - idx * 11) / 255.0); }
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
`,S=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uLowTex;
out vec4 outColor;
${b}
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
`,C=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSourceTex;
uniform vec2 uInvSourceSize;
uniform vec2 uSubTexelOffset;
out vec4 outColor;
${b}
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
`,w=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uDepthTex;
uniform vec2 uInvDepthSize;
uniform float uRefDepth;
out vec4 outColor;
${b}
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
`,T=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DShadow;
uniform sampler2DShadow uShadowMap;
uniform vec2 uInvShadowSize;
uniform float uRefDepth;
out vec4 outColor;
${b}
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
`,E=`#version 300 es
precision highp float;
precision highp int;
uniform int uProbeKind;
out vec4 outColor;
${b}
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
`;function D(e,t){switch(t){case e.INVALID_ENUM:return`INVALID_ENUM`;case e.INVALID_VALUE:return`INVALID_VALUE`;case e.INVALID_OPERATION:return`INVALID_OPERATION`;case e.INVALID_FRAMEBUFFER_OPERATION:return`INVALID_FRAMEBUFFER_OPERATION`;case e.OUT_OF_MEMORY:return`OUT_OF_MEMORY`;case e.CONTEXT_LOST_WEBGL:return`CONTEXT_LOST_WEBGL`;default:return`0x${t.toString(16)}`}}function O(e,t){let n=[];for(;;){let t=e.getError();if(t===e.NO_ERROR)break;n.push(`${D(e,t)} (0x${t.toString(16)})`)}if(n.length>0)throw Error(`${t}: GL error(s): ${n.join(`, `)}`)}function k(e,t,n){let r=e.createShader(t);if(!r)throw Error(`Failed to create shader.`);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r)??`Unknown shader compile error.`;throw e.deleteShader(r),Error(t)}return r}function A(e,t,n){let r=k(e,e.VERTEX_SHADER,t),i=k(e,e.FRAGMENT_SHADER,n),a=e.createProgram();if(!a)throw Error(`Failed to create program.`);if(e.attachShader(a,r),e.attachShader(a,i),e.linkProgram(a),e.deleteShader(r),e.deleteShader(i),!e.getProgramParameter(a,e.LINK_STATUS)){let t=e.getProgramInfoLog(a)??`Unknown program link error.`;throw e.deleteProgram(a),Error(t)}return a}function j(e,t,n){let r=e.createTexture();if(!r)throw Error(`Failed to create result texture.`);return e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t,n,0,e.RGBA,e.UNSIGNED_BYTE,null),O(e,`createResultTexture ${t}x${n}`),e.bindTexture(e.TEXTURE_2D,null),r}function M(e){return 32+e[0]*64+e[1]*128}function N(e){return[.03125,.27182818,.61803399,.9375][e[0]+e[1]*2]}function P(e,t){return 19+e*37+t*53&255}function F(e,t,n,r,i,a){let o=e.createTexture();if(!o)throw Error(`Failed to create source texture.`);if(e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.pixelStorei(e.UNPACK_ALIGNMENT,1),a===`r32f`){let a=new Float32Array(t*n);for(let e=0;e<n;e++)for(let n=0;n<t;n++){let o=[n&1,e&1],s=o[0]===r[0]&&o[1]===r[1];a[e*t+n]=i===`binaryScalar`?+!!s:N(o)}e.texImage2D(e.TEXTURE_2D,0,e.R32F,t,n,0,e.RED,e.FLOAT,a)}else{let a=new Uint8Array(t*n*4);for(let e=0;e<n;e++)for(let n=0;n<t;n++){let o=[n&1,e&1],s=o[0]===r[0]&&o[1]===r[1],c=(e*t+n)*4;a[c]=i===`binaryScalar`?s?255:0:M(o),a[c+3]=255}e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t,n,0,e.RGBA,e.UNSIGNED_BYTE,a)}return O(e,`createScalarSourceTexture ${a}`),e.bindTexture(e.TEXTURE_2D,null),o}function I(e,t,n,r){let i=new Uint8Array(t*n*4);for(let e=0;e<n;e++)for(let n=0;n<t;n++){let r=(e*t+n)*4;i[r]=P(n,e),i[r+3]=255}let a=e.createTexture();if(!a)throw Error(`Failed to create RGBA8 texture.`);return e.bindTexture(e.TEXTURE_2D,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t,n,0,e.RGBA,e.UNSIGNED_BYTE,i),O(e,`createUniqueRgba8Texture ${t}x${n}`),e.bindTexture(e.TEXTURE_2D,null),a}function L(e,t,n,r){let i=new Uint16Array(t*n);for(let e=0;e<n;e++)for(let n=0;n<t;n++)i[e*t+n]=Math.round(P(n,e)/255*65535);let a=e.createTexture();if(!a)throw Error(`Failed to create depth texture.`);return e.bindTexture(e.TEXTURE_2D,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_COMPARE_MODE,r===`shadow`?e.COMPARE_REF_TO_TEXTURE:e.NONE),r===`shadow`&&e.texParameteri(e.TEXTURE_2D,e.TEXTURE_COMPARE_FUNC,e.LEQUAL),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texImage2D(e.TEXTURE_2D,0,e.DEPTH_COMPONENT16,t,n,0,e.DEPTH_COMPONENT,e.UNSIGNED_SHORT,i),O(e,`createDepthTexture ${r}`),e.bindTexture(e.TEXTURE_2D,null),a}function R(e,t,n,r,i,a,o=0){let s=0,c=0,l=[];for(let u=0;u<a;u++)for(let a=0;a<i;a++){let i=n+a,d=r+u,f=(d*t+i)*4,p=e[f],m=e[f+1],h=e[f+2],g=e[f+3];m>p&&m>128?s++:(c++,l.length<16&&l.push({x:o+i,y:d,rgba:[p,m,h,g]}))}return{passCount:s,failCount:c,failedPixels:l}}function ee(e,t,n,r=0){return R(e,t,0,0,t,n,r)}function te(e,t,n,r,i,a,o){for(let s=0;s<i;s++)for(let i=0;i<r;i++){let c=(s*r+i)*4,l=((o+s)*t+(a+i))*4;e[l]=n[c],e[l+1]=n[c+1],e[l+2]=n[c+2],e[l+3]=n[c+3]}}function z(e,t,n,r){let i=e.getContext(`2d`);if(!i)throw Error(`2D canvas unavailable for #${e.id}.`);let a=i.createImageData(n,r);for(let e=0;e<r;e++){let i=r-1-e;for(let r=0;r<n;r++){let o=(i*n+r)*4,s=(e*n+r)*4;a.data[s]=t[o],a.data[s+1]=t[o+1],a.data[s+2]=t[o+2],a.data[s+3]=t[o+3]}}i.putImageData(a,0,0)}function ne(e){return{VENDOR:String(e.getParameter(e.VENDOR)),RENDERER:String(e.getParameter(e.RENDERER)),VERSION:String(e.getParameter(e.VERSION)),SHADING_LANGUAGE_VERSION:String(e.getParameter(e.SHADING_LANGUAGE_VERSION))}}var re=class{canvas;gl;vao;glInfo;constructor(){this.canvas=document.createElement(`canvas`),this.canvas.width=1,this.canvas.height=1,this.canvas.style.position=`absolute`,this.canvas.style.left=`-10000px`,this.canvas.style.top=`-10000px`,this.canvas.style.width=`1px`,this.canvas.style.height=`1px`,document.body.appendChild(this.canvas);let e=this.canvas.getContext(`webgl2`,{antialias:!1,depth:!1,stencil:!1,alpha:!1,preserveDrawingBuffer:!1});if(!e)throw Error(`WebGL2 not available.`);this.gl=e;let t=e.createVertexArray();if(!t)throw Error(`Failed to create VAO.`);this.vao=t,this.glInfo=ne(e)}dispose(){this.gl.deleteVertexArray(this.vao),this.canvas.remove()}createFramebuffer(e,t){let n=this.gl,r=j(n,e,t),i=n.createFramebuffer();if(!i)throw n.deleteTexture(r),Error(`Failed to create framebuffer.`);n.bindFramebuffer(n.FRAMEBUFFER,i),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,r,0);let a=n.checkFramebufferStatus(n.FRAMEBUFFER);if(a!==n.FRAMEBUFFER_COMPLETE)throw n.bindFramebuffer(n.FRAMEBUFFER,null),n.deleteFramebuffer(i),n.deleteTexture(r),Error(`Framebuffer incomplete: 0x${a.toString(16)}`);return O(n,`createFramebuffer ${e}x${t}`),{framebuffer:i,texture:r}}readFramebuffer(e,t){let n=this.gl,r=new Uint8Array(e*t*4);return n.readPixels(0,0,e,t,n.RGBA,n.UNSIGNED_BYTE,r),O(n,`readPixels ${e}x${t}`),r}clearAndDraw(e,t){let n=this.gl;n.disable(n.DEPTH_TEST),n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.SCISSOR_TEST),n.viewport(t.x,t.y,t.width,t.height),n.clearColor(0,0,0,1),n.clear(n.COLOR_BUFFER_BIT),n.useProgram(e),n.bindVertexArray(this.vao),n.drawArrays(n.TRIANGLES,0,3),O(n,`drawArrays`)}};function B(e,t,n,r,i,l=`rgba8`){let u=e.gl,d=A(u,y,x),f=e.createFramebuffer(a,o),p=[],m=new Uint8Array(s*c*4),h=!1,b=``;try{let t=u.getUniformLocation(d,`uSourceMode`),c=u.getUniformLocation(d,`uTestKind`),h=u.getUniformLocation(d,`uRealFloatValues`),y=u.getUniformLocation(d,`uSourceLane`),b=u.getUniformLocation(d,`uTestTex`);u.useProgram(d),u.bindVertexArray(e.vao);for(let x=0;x<g.length;x++){let S=g[x],C=null;r===`texture`&&(C=F(u,a,o,S.lane,i,l)),u.bindFramebuffer(u.FRAMEBUFFER,f.framebuffer),u.disable(u.DEPTH_TEST),u.disable(u.BLEND),u.disable(u.CULL_FACE),u.disable(u.SCISSOR_TEST),u.viewport(0,0,a,o),u.clearColor(0,0,0,1),u.clear(u.COLOR_BUFFER_BIT),u.useProgram(d),u.bindVertexArray(e.vao),u.uniform1i(t,v[r]),u.uniform1i(c,_[i]),u.uniform1i(h,+(l===`r32f`&&i===`fractionalScalar`)),u.uniform2i(y,S.lane[0],S.lane[1]),u.activeTexture(u.TEXTURE0),u.bindTexture(u.TEXTURE_2D,C),u.uniform1i(b,0),O(u,`${n} setup source lane ${S.name}`),u.drawArrays(u.TRIANGLES,0,3),O(u,`${n} draw source lane ${S.name}`);let w=e.readFramebuffer(a,o),T=ee(w,a,o,x*a);p.push({sourceLaneName:S.name,sourceLane:S.lane,passCount:T.passCount,failCount:T.failCount,failedPixels:T.failedPixels}),te(m,s,w,a,o,x*a,0),C&&u.deleteTexture(C)}}catch(e){h=!0,b=e instanceof Error?e.message:String(e)}finally{u.bindFramebuffer(u.FRAMEBUFFER,null),u.deleteFramebuffer(f.framebuffer),u.deleteTexture(f.texture),u.deleteProgram(d)}return z(t,m,s,c),{result:{name:n,width:s,height:c,sourceResults:p,skipped:h,skipReason:b},glInfo:e.glInfo}}function V(e,t,n,r,i,a){let o=e.gl,s=a?.framebufferWidth??t.width,c=a?.framebufferHeight??t.height,l=a?.viewport??{x:0,y:0,width:s,height:c},u=a?.analyzeRegion??{x:0,y:0,width:s,height:c,visualXOffset:0},d=null,f=null,p=null;try{f=A(o,y,r),p=e.createFramebuffer(s,c),o.useProgram(f),o.bindVertexArray(e.vao),d=i(o,f),O(o,`${n} setup`),o.bindFramebuffer(o.FRAMEBUFFER,p.framebuffer),e.clearAndDraw(f,l);let m=e.readFramebuffer(s,c);z(t,m,s,c);let h=R(m,s,u.x,u.y,u.width,u.height,u.visualXOffset??0);return{result:{name:n,width:u.width,height:u.height,passCount:h.passCount,failCount:h.failCount,failedPixels:h.failedPixels,informational:!!a?.informational},glInfo:e.glInfo}}catch(t){return{result:{name:n,width:u.width,height:u.height,passCount:0,failCount:0,failedPixels:[],skipped:!0,informational:!!a?.informational,skipReason:t instanceof Error?t.message:String(t)},glInfo:e.glInfo}}finally{d&&o.deleteTexture(d),p&&(o.deleteFramebuffer(p.framebuffer),o.deleteTexture(p.texture)),f&&o.deleteProgram(f),o.bindTexture(o.TEXTURE_2D,null),o.bindFramebuffer(o.FRAMEBUFFER,null)}}function ie(e,t){return V(e,t,`viewport offset probe`,E,(e,t)=>(e.uniform1i(e.getUniformLocation(t,`uProbeKind`),0),null),{framebufferWidth:10,framebufferHeight:10,viewport:{x:1,y:1,width:8,height:8},analyzeRegion:{x:1,y:1,width:8,height:8,visualXOffset:1},informational:!0})}function H(e,t,n,r,i=!0){return V(e,t,n,E,(e,t)=>(e.uniform1i(e.getUniformLocation(t,`uProbeKind`),r),null),{informational:i})}function ae(e,t){return V(e,t,`JBU-shaped half-res 2x gather`,S,(e,t)=>{let n=I(e,l,u,e.NEAREST);return e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n),e.uniform1i(e.getUniformLocation(t,`uLowTex`),0),n})}function U(e,t,n){return V(e,t,`texture() ${n.toUpperCase()} offset gather`,C,(e,t)=>{let r=I(e,d,f,n===`nearest`?e.NEAREST:e.LINEAR);return e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r),e.uniform1i(e.getUniformLocation(t,`uSourceTex`),0),e.uniform2f(e.getUniformLocation(t,`uInvSourceSize`),1/d,1/f),e.uniform2f(e.getUniformLocation(t,`uSubTexelOffset`),n===`nearest`?.5:.37,n===`nearest`?.5:.61),r})}function oe(e,t){return V(e,t,`manual depth shadow compare offset gather`,w,(e,t)=>{let n=L(e,p,m,`none`);return e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n),e.uniform1i(e.getUniformLocation(t,`uDepthTex`),0),e.uniform2f(e.getUniformLocation(t,`uInvDepthSize`),1/p,1/m),e.uniform1f(e.getUniformLocation(t,`uRefDepth`),h),n})}function se(e,t){return V(e,t,`sampler2DShadow offset gather`,T,(e,t)=>{let n=L(e,p,m,`shadow`);return e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n),e.uniform1i(e.getUniformLocation(t,`uShadowMap`),0),e.uniform2f(e.getUniformLocation(t,`uInvShadowSize`),1/p,1/m),e.uniform1f(e.getUniformLocation(t,`uRefDepth`),h),n})}function W(e){let t=0,n=0;for(let r of e.sourceResults)t+=r.passCount,n+=r.failCount;return{pass:t,fail:n}}function G(e){return!e.skipped&&W(e).fail===0&&e.sourceResults.length===g.length}function K(e){return!e.skipped&&e.failCount===0}function q(e){let t=W(e);return{name:e.name,kind:`broadcast`,skipped:!!e.skipped,skipReason:e.skipReason??null,passed:G(e),passCount:t.pass,failCount:t.fail,sourceLanes:e.sourceResults.map(e=>({name:e.sourceLaneName,lane:e.sourceLane,passed:e.failCount===0,passCount:e.passCount,failCount:e.failCount}))}}function J(e){return{name:e.name,kind:`simple`,informational:!!e.informational,skipped:!!e.skipped,skipReason:e.skipReason??null,passed:K(e),passCount:e.passCount,failCount:e.failCount}}function ce(t){if(t.skipped)return[`SKIPPED: ${t.name}`,`Reason: ${t.skipReason??`unknown`}`].join(e);let n=W(t),r=t.sourceResults.length*a*o,i=[n.fail===0?`PASS: ${t.name}`:`FAIL: ${t.name}`,`Actual test size per source lane: ${a}×${o}`,`Source lanes tested:             ${t.sourceResults.length}`,`Pixels tested:                   ${r}`,`Passed:                          ${n.pass}`,`Failed:                          ${n.fail}`,``];for(let e of t.sourceResults)i.push(`${e.failCount===0?`PASS`:`FAIL`} source ${e.sourceLaneName}: ${e.passCount} passed, ${e.failCount} failed`);return i.join(e)}function le(t,n){if(t.skipped)return[`SKIPPED: ${t.name}`,`Reason: ${t.skipReason??`unknown`}`].join(e);let r=t.width*t.height,i=[`${t.informational?t.failCount===0?`INFO PASS`:`INFO FAIL`:t.failCount===0?`PASS`:`FAIL`}: ${t.name}`,n,`Pixels tested: ${r}`,`Passed:        ${t.passCount}`,`Failed:        ${t.failCount}`];if(t.failCount>0&&t.failedPixels.length>0){i.push(`First failed pixels:`);for(let e of t.failedPixels)i.push(`  (${e.x}, ${e.y}) rgba = [${e.rgba.join(`, `)}]`)}return i.join(e)}function Y(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function X(e,t,n=!1){return`<div style="margin:3px 0;">${e?`✅`:n?`⚠️`:`❌`} ${Y(t)}</div>`}function Z(e,t,n){let r=n===`pass`?`✅`:n===`fail`?`❌`:n===`skip`?`⏭️`:n===`expected`?`✅`:`ℹ️`,i=n===`fail`?`#5a2a2a`:n===`skip`?`#5a4a2a`:`#2a3140`;return`
    <details style="margin:8px 0;border:1px solid ${i};border-radius:10px;background:${n===`fail`?`#211719`:n===`skip`?`#211d15`:`#111722`};overflow:hidden;">
      <summary style="padding:10px 12px;cursor:pointer;font-weight:650;color:#e8ecf1;">
        ${r} ${Y(e)}
      </summary>
      <pre style="margin:0;padding:12px;border-top:1px solid ${i};white-space:pre-wrap;overflow:auto;color:#cfd8e3;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.45;">${Y(t)}</pre>
    </details>`}function Q(e){let t=e.skipped?`skip`:G(e)?`pass`:`fail`;return Z(e.name,ce(e),t)}function $(e,t,n=!1){let r;return r=e.skipped?`skip`:n?e.failCount>0?`expected`:`info`:e.informational?K(e)?`pass`:`info`:K(e)?`pass`:`fail`,Z(e.name,le(e,t),r)}try{let t=new re,a=B(t,document.querySelector(`#procCanvas`),`binary procedural scalar source-lane move/broadcast`,`procedural`,`binaryScalar`),o=B(t,document.querySelector(`#texCanvas`),`binary RGBA8 texture scalar source-lane move/broadcast`,`texture`,`binaryScalar`,`rgba8`),s=B(t,document.querySelector(`#fracProcCanvas`),`fractional procedural scalar source-lane move/broadcast`,`procedural`,`fractionalScalar`),c=B(t,document.querySelector(`#fracTexCanvas`),`fractional RGBA8 texture scalar source-lane move/broadcast`,`texture`,`fractionalScalar`,`rgba8`),p=B(t,document.querySelector(`#floatTexCanvas`),`R32F real-float texture scalar source-lane move/broadcast`,`texture`,`fractionalScalar`,`r32f`),m=B(t,document.querySelector(`#vec2Canvas`),`procedural vec2 source-lane move/broadcast`,`procedural`,`vec2`),g=B(t,document.querySelector(`#vec4Canvas`),`procedural vec4 source-lane move/broadcast`,`procedural`,`vec4`),_=ae(t,document.querySelector(`#jbuCanvas`)),v=U(t,document.querySelector(`#nearestCanvas`),`nearest`),y=U(t,document.querySelector(`#linearCanvas`),`linear`),b=oe(t,document.querySelector(`#manualShadowCanvas`)),x=se(t,document.querySelector(`#shadowSamplerCanvas`)),S=ie(t,document.querySelector(`#viewportOffsetCanvas`)),C=H(t,document.querySelector(`#oddSizeCanvas`),`odd-size target probe`,0,!0),w=H(t,document.querySelector(`#divergentCanvas`),`invalid divergent branch demo`,2,!0),T={scalarBroadcast:G(a.result)&&G(o.result),fractionalScalarBroadcast:G(s.result)&&G(c.result),realFloatR32FBroadcast:G(p.result),vectorBroadcast:G(m.result)&&G(g.result),jbuGather:K(_.result),textureNearestGather:K(v.result),textureLinearGather:K(y.result),textureNearestLinearGather:K(v.result)&&K(y.result),manualDepthShadowCompareGather:K(b.result),shadowSamplerGather:K(x.result),viewportOffsetProbePassed:K(S.result),oddSizeProbePassed:K(C.result),invalidDivergentBranchDemoFailedAsExpected:!w.result.skipped&&w.result.failCount>0},E=T.scalarBroadcast,D=T.fractionalScalarBroadcast&&T.realFloatR32FBroadcast,O=T.vectorBroadcast,k=T.jbuGather,A=T.textureNearestLinearGather,j=T.manualDepthShadowCompareGather&&T.shadowSamplerGather,M=!S.result.skipped&&!C.result.skipped&&!w.result.skipped,N=E&&D&&O&&k&&A&&j,P={reportVersion:1,generatedAt:new Date().toISOString(),userAgent:navigator.userAgent,verdict:{requiredPassed:N,pqaRecommendedForAllTestedFastPaths:N,note:N?`Required PQA tests passed. Use the capability buckets and robustness probes to decide exact engine fast paths and fallbacks.`:`At least one required PQA test failed or was skipped. Enable only the capability buckets that passed, and keep other PQA fast paths disabled.`},capabilities:T,testGroups:{coreScalarBroadcast:E,fractionalAndR32F:D,vectorWidths:O,jbuShapedGather:k,textureSamplingBlurBloom:A,shadowCompareGather:j,robustnessProbesExecuted:M,jsonReport:!0},gl:t.glInfo,requiredTests:[q(a.result),q(o.result),q(s.result),q(c.result),q(p.result),q(m.result),q(g.result),J(_.result),J(v.result),J(y.result),J(b.result),J(x.result)],informationalProbes:[J(S.result),J(C.result),J(w.result)]};r.value=JSON.stringify(P,null,2),i.onclick=async()=>{try{await navigator.clipboard.writeText(r.value),i.textContent=`Copied!`,window.setTimeout(()=>{i.textContent=`Copy JSON`},1200)}catch{r.focus(),r.select(),i.textContent=`Select + copy`,window.setTimeout(()=>{i.textContent=`Copy JSON`},1800)}};let F=[Q(a.result),Q(o.result),Q(s.result),Q(c.result),Q(p.result),Q(m.result),Q(g.result),$(_.result,`High-res: 8×8; low-res texture: ${l}×${u}`),$(v.result,`High-res: 8×8; source texture: ${d}×${f}; filter: NEAREST`),$(y.result,`High-res: 8×8; source texture: ${d}×${f}; filter: LINEAR; fractional offsets: 0.37, 0.61`),$(b.result,`High-res: 8×8; depth source: DEPTH_COMPONENT16 sampler2D with compare mode NONE; reference depth: ${h}`),$(x.result,`High-res: 8×8; depth source: DEPTH_COMPONENT16 sampler2DShadow with COMPARE_REF_TO_TEXTURE; reference depth: ${h}`),$(S.result,`Viewport: x=1, y=1, width=8, height=8 inside a 10×10 target. Passing means global gl_FragCoord parity still works for this offset.`),$(C.result,`Target: 9×9. If this fails at borders, use a fallback for the final odd row/column.`),$(w.result,`Intentionally invalid derivative-in-nonuniform-branch demo. Failure is expected/healthy; passing does not make this pattern safe.`,!0)].join(``);n.innerHTML=`
    <section style="margin-bottom:14px;padding:14px;border-radius:10px;background:#111722;border:1px solid #263044;">
      <div style="font-size:18px;font-weight:750;margin-bottom:8px;">Quick status</div>
      <div style="font-size:15px;margin-bottom:10px;color:${N?`#bdf7c8`:`#ffc9c9`};">
        ${N?`✅ Overall: all required PQA derivative message-passing tests passed.`:`❌ Overall: one or more required PQA tests failed or were skipped.`}
      </div>
      <div style="font-weight:700;margin:12px 0 5px;">Required capabilities</div>
      ${X(T.scalarBroadcast,`Scalar broadcast (procedural + RGBA8 texture)`)}
      ${X(T.fractionalScalarBroadcast,`Fractional scalar broadcast (procedural + RGBA8 texture)`)}
      ${X(T.realFloatR32FBroadcast,`Real-float R32F broadcast`)}
      ${X(T.vectorBroadcast,`Vector broadcast (vec2 + vec4)`)}
      ${X(T.jbuGather,`JBU-shaped half-res gather`)}
      ${X(T.textureNearestGather,`texture() NEAREST offset gather`)}
      ${X(T.textureLinearGather,`texture() LINEAR offset gather`)}
      ${X(T.manualDepthShadowCompareGather,`Manual depth shadow compare gather`)}
      ${X(T.shadowSamplerGather,`sampler2DShadow compare gather`)}
      <div style="font-weight:700;margin:12px 0 5px;">Informational probes</div>
      ${X(T.viewportOffsetProbePassed,`Viewport offset probe`)}
      ${X(T.oddSizeProbePassed,`Odd-size target probe`)}
      ${X(T.invalidDivergentBranchDemoFailedAsExpected,`Invalid divergent branch demo failed as expected`,!0)}
    </section>

    <section style="margin-bottom:14px;padding:14px;border-radius:10px;background:#111722;border:1px solid #263044;">
      <div style="font-size:16px;font-weight:750;margin-bottom:4px;">Practical meaning</div>
      <div style="color:#cfd8e3;">
        ${N?`PQA looks viable for the tested scalar/vector, JBU, blur/bloom, and shadow-like paths. Use the robustness probes to decide where to apply fallbacks or warnings.`:`Enable only the specific capability buckets that passed. Keep failed or skipped PQA fast paths disabled on this device/browser.`}
      </div>
    </section>

    <section style="margin-bottom:14px;">
      <div style="font-size:16px;font-weight:750;margin-bottom:4px;">Detailed results</div>
      <div style="color:#aeb7c2;margin-bottom:8px;">Click a test row to expand the full readback details.</div>
      ${F}
    </section>

    <section style="margin-top:14px;padding:14px;border-radius:10px;background:#111722;border:1px solid #263044;">
      <div style="font-size:16px;font-weight:750;margin-bottom:8px;">GL info</div>
      <pre style="margin:0;white-space:pre-wrap;color:#cfd8e3;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.45;">${Y([`VENDOR:                   ${t.glInfo.VENDOR}`,`RENDERER:                 ${t.glInfo.RENDERER}`,`VERSION:                  ${t.glInfo.VERSION}`,`SHADING_LANGUAGE_VERSION: ${t.glInfo.SHADING_LANGUAGE_VERSION}`].join(e))}</pre>
    </section>
  `}catch(t){n.textContent=[`Error:`,t instanceof Error?t.message:String(t)].join(e),r.value=JSON.stringify({reportVersion:1,generatedAt:new Date().toISOString(),error:t instanceof Error?t.message:String(t),userAgent:navigator.userAgent},null,2)}