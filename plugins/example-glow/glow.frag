#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float intensity;
out vec4 outColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float a = intensity / 100.0;
  outColor = vec4(c.rgb + vec3(a * 0.15), c.a);
}
