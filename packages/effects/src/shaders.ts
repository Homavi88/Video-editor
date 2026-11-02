/**
 * GLSL ES 3.00 shader sources for preview compositing and transitions.
 * Compatible with the gl-transitions convention (progress, from, to).
 */

export const FULLSCREEN_VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const BLIT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_opacity;
out vec4 outColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  outColor = vec4(c.rgb, c.a * u_opacity);
}
`;

export const CROSSFADE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D from;
uniform sampler2D to;
uniform float progress;
out vec4 outColor;
void main() {
  vec4 a = texture(from, v_uv);
  vec4 b = texture(to, v_uv);
  outColor = mix(a, b, clamp(progress, 0.0, 1.0));
}
`;

export const WIPE_LEFT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D from;
uniform sampler2D to;
uniform float progress;
out vec4 outColor;
void main() {
  float p = clamp(progress, 0.0, 1.0);
  outColor = v_uv.x < p ? texture(to, v_uv) : texture(from, v_uv);
}
`;

export const GAUSSIAN_BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_radius;
uniform vec2 u_dir;
out vec4 outColor;
void main() {
  vec4 sum = vec4(0.0);
  float total = 0.0;
  float r = max(u_radius, 0.0);
  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    float w = exp(-0.5 * (fi / max(r, 0.001)) * (fi / max(r, 0.001)));
    sum += texture(u_tex, v_uv + u_dir * u_texel * fi * r) * w;
    total += w;
  }
  outColor = sum / total;
}
`;

export const COLOR_LGG_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec3 u_lift;
uniform vec3 u_gamma;
uniform vec3 u_gain;
uniform float u_saturation;
uniform float u_exposure;
out vec4 outColor;
vec3 applyLgg(vec3 c) {
  vec3 g = vec3(1.0) + u_gain;
  vec3 lifted = c * g + u_lift;
  vec3 gam = pow(max(lifted, 0.0), pow(vec3(2.0), -u_gamma));
  float m = exp2(u_exposure);
  gam *= m;
  float y = dot(gam, vec3(0.2126, 0.7152, 0.0722));
  return clamp(mix(vec3(y), gam, u_saturation), 0.0, 1.0);
}
void main() {
  vec4 c = texture(u_tex, v_uv);
  outColor = vec4(applyLgg(c.rgb), c.a);
}
`;

export const VIGNETTE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_amount;
uniform float u_softness;
out vec4 outColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec2 d = v_uv - 0.5;
  float dist = length(d) * 1.41421356;
  float soft = max(u_softness, 0.001);
  float vig = smoothstep(1.0 - soft, 0.0, dist * u_amount);
  outColor = vec4(c.rgb * vig, c.a);
}
`;

export const BLEND_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_opacity;
uniform int u_blend; // 0 normal, 1 multiply, 2 screen, 3 overlay, 4 add
out vec4 outColor;
vec3 blendMode(vec3 base, vec3 blend, int mode) {
  if (mode == 1) return base * blend;
  if (mode == 2) return 1.0 - (1.0 - base) * (1.0 - blend);
  if (mode == 3) {
    return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), step(0.5, base));
  }
  if (mode == 4) return min(base + blend, 1.0);
  return blend;
}
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 rgb = blendMode(vec3(0.0), c.rgb, u_blend);
  outColor = vec4(rgb, c.a * u_opacity);
}
`;

export const MASK_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_bounds; // x,y,w,h normalized
uniform float u_feather;
uniform float u_invert;
uniform int u_kind; // 0 rect, 1 ellipse
out vec4 outColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float alpha = 0.0;
  if (u_kind == 1) {
    vec2 cxy = u_bounds.xy + u_bounds.zw * 0.5;
    vec2 r = max(u_bounds.zw * 0.5, vec2(0.0001));
    vec2 n = (v_uv - cxy) / r;
    float d = 1.0 - length(n);
    alpha = smoothstep(0.0, max(u_feather, 0.001), d);
  } else {
    vec2 p0 = u_bounds.xy;
    vec2 p1 = u_bounds.xy + u_bounds.zw;
    float l = smoothstep(p0.x - u_feather, p0.x + u_feather, v_uv.x);
    float r = 1.0 - smoothstep(p1.x - u_feather, p1.x + u_feather, v_uv.x);
    float t = smoothstep(p0.y - u_feather, p0.y + u_feather, v_uv.y);
    float b = 1.0 - smoothstep(p1.y - u_feather, p1.y + u_feather, v_uv.y);
    alpha = l * r * t * b;
  }
  if (u_invert > 0.5) alpha = 1.0 - alpha;
  outColor = vec4(c.rgb, c.a * alpha);
}
`;

export const WIPE_RIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D from;
uniform sampler2D to;
uniform float progress;
out vec4 outColor;
void main() {
  float p = clamp(progress, 0.0, 1.0);
  outColor = v_uv.x > 1.0 - p ? texture(to, v_uv) : texture(from, v_uv);
}
`;

export const TRANSITION_SHADERS: Record<string, string> = {
  crossDissolve: CROSSFADE_FRAG,
  crossfade: CROSSFADE_FRAG,
  wipeLeft: WIPE_LEFT_FRAG,
  wipeRight: WIPE_RIGHT_FRAG,
};

export const EFFECT_SHADERS: Record<string, string> = {
  "builtin.blur.gaussian": GAUSSIAN_BLUR_FRAG,
  "builtin.color.lgg": COLOR_LGG_FRAG,
  "builtin.vignette": VIGNETTE_FRAG,
  blit: BLIT_FRAG,
};
