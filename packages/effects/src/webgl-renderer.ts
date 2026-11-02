/**
 * Minimal WebGL2 preview compositor used by Program/Source monitors.
 * Renders solid bars / uploaded textures with optional effect pass.
 */

import {
  BLEND_FRAG,
  BLIT_FRAG,
  COLOR_LGG_FRAG,
  CROSSFADE_FRAG,
  FULLSCREEN_VERT,
  GAUSSIAN_BLUR_FRAG,
  MASK_FRAG,
  VIGNETTE_FRAG,
  WIPE_LEFT_FRAG,
  WIPE_RIGHT_FRAG,
} from "./shaders.js";

export interface RendererStats {
  frames: number;
  lastMs: number;
}

export class WebGLPreviewRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly blit: Program;
  private readonly blur: Program;
  private readonly lgg: Program;
  private readonly vignette: Program;
  private readonly crossfade: Program;
  private readonly wipeLeft: Program;
  private readonly wipeRight: Program;
  private readonly blend: Program;
  private readonly mask: Program;
  private readonly quad: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private width: number;
  private height: number;
  readonly stats: RendererStats = { frames: 0, lastMs: 0 };

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.width = canvas.width;
    this.height = canvas.height;
    this.blit = createProgram(gl, FULLSCREEN_VERT, BLIT_FRAG);
    this.blur = createProgram(gl, FULLSCREEN_VERT, GAUSSIAN_BLUR_FRAG);
    this.lgg = createProgram(gl, FULLSCREEN_VERT, COLOR_LGG_FRAG);
    this.vignette = createProgram(gl, FULLSCREEN_VERT, VIGNETTE_FRAG);
    this.crossfade = createProgram(gl, FULLSCREEN_VERT, CROSSFADE_FRAG);
    this.wipeLeft = createProgram(gl, FULLSCREEN_VERT, WIPE_LEFT_FRAG);
    this.wipeRight = createProgram(gl, FULLSCREEN_VERT, WIPE_RIGHT_FRAG);
    this.blend = createProgram(gl, FULLSCREEN_VERT, BLEND_FRAG);
    this.mask = createProgram(gl, FULLSCREEN_VERT, MASK_FRAG);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  /** Uploads RGBA pixels and blits with opacity. */
  drawPixels(pixels: Uint8Array, width: number, height: number, opacity = 1): void {
    const t0 = performance.now();
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    this.drawTexture(this.texture, this.blit, (p) => {
      gl.uniform1f(p.uniforms.u_opacity!, opacity);
    });
    this.stats.frames += 1;
    this.stats.lastMs = performance.now() - t0;
  }

  /** Uploads an ImageBitmap / video frame into the texture and blits. */
  drawImageSource(
    source: TexImageSource,
    opacity = 1,
    blendMode: "normal" | "multiply" | "screen" | "overlay" | "add" = "normal",
  ): void {
    const t0 = performance.now();
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const mode =
      blendMode === "multiply"
        ? 1
        : blendMode === "screen"
          ? 2
          : blendMode === "overlay"
            ? 3
            : blendMode === "add"
              ? 4
              : 0;
    this.drawTexture(this.texture, this.blend, (p) => {
      gl.uniform1f(p.uniforms.u_opacity!, opacity);
      gl.uniform1i(p.uniforms.u_blend!, mode);
    });
    this.stats.frames += 1;
    this.stats.lastMs = performance.now() - t0;
  }

  applyRectMask(
    bounds: { x: number; y: number; w: number; h: number },
    feather: number,
    inverted: boolean,
    kind: "rect" | "ellipse" = "rect",
  ): void {
    const gl = this.gl;
    this.drawTexture(this.texture, this.mask, (p) => {
      gl.uniform4f(p.uniforms.u_bounds!, bounds.x, bounds.y, bounds.w, bounds.h);
      gl.uniform1f(p.uniforms.u_feather!, Math.max(0, feather) / 1080);
      gl.uniform1f(p.uniforms.u_invert!, inverted ? 1 : 0);
      gl.uniform1i(p.uniforms.u_kind!, kind === "ellipse" ? 1 : 0);
    });
  }

  drawTransition(kind: "crossfade" | "wipeLeft" | "wipeRight", progress: number): void {
    const gl = this.gl;
    const program =
      kind === "wipeLeft" ? this.wipeLeft : kind === "wipeRight" ? this.wipeRight : this.crossfade;
    this.drawTexture(this.texture, program, (p) => {
      gl.uniform1f(p.uniforms.progress!, progress);
      if (p.uniforms.to) gl.uniform1i(p.uniforms.to, 0);
    });
  }

  /** Draws SMPTE-like color bars procedurally into a texture then blits. */
  drawColorBars(timeSeconds = 0): void {
    const w = 128;
    const h = 72;
    const pixels = new Uint8Array(w * h * 4);
    const colors = [
      [180, 180, 180],
      [180, 180, 16],
      [16, 180, 180],
      [16, 180, 16],
      [180, 16, 180],
      [180, 16, 16],
      [16, 16, 180],
    ];
    const shift = Math.floor(timeSeconds * 2) % colors.length;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const band = Math.floor((x / w) * colors.length);
        const c = colors[(band + shift) % colors.length]!;
        const i = (y * w + x) * 4;
        pixels[i] = c[0]!;
        pixels[i + 1] = c[1]!;
        pixels[i + 2] = c[2]!;
        pixels[i + 3] = 255;
      }
    }
    this.drawPixels(pixels, w, h, 1);
  }

  applyVignette(amount: number, softness: number): void {
    const gl = this.gl;
    this.drawTexture(this.texture, this.vignette, (p) => {
      gl.uniform1f(p.uniforms.u_amount!, amount);
      gl.uniform1f(p.uniforms.u_softness!, softness);
    });
  }

  applyLgg(lift: number, gamma: number, gain: number, saturation: number, exposure: number): void {
    const gl = this.gl;
    this.drawTexture(this.texture, this.lgg, (p) => {
      gl.uniform3f(p.uniforms.u_lift!, lift, lift, lift);
      gl.uniform3f(p.uniforms.u_gamma!, gamma, gamma, gamma);
      gl.uniform3f(p.uniforms.u_gain!, gain, gain, gain);
      gl.uniform1f(p.uniforms.u_saturation!, saturation);
      gl.uniform1f(p.uniforms.u_exposure!, exposure);
    });
  }

  /** Horizontal Gaussian blur pass using the current texture contents. */
  applyBlur(radius: number): void {
    const gl = this.gl;
    this.drawTexture(this.texture, this.blur, (p) => {
      gl.uniform1f(p.uniforms.u_radius!, radius);
      gl.uniform2f(p.uniforms.u_texel!, 1 / this.width, 1 / this.height);
      gl.uniform2f(p.uniforms.u_dir!, 1, 0);
    });
  }

  /**
   * Mixes the current texture (A) with itself as a progress demo when a second
   * texture is not yet bound — useful for transition progress unit tests in UI.
   */
  drawCrossfadeProgress(progress: number): void {
    const gl = this.gl;
    this.drawTexture(this.texture, this.crossfade, (p) => {
      gl.uniform1f(p.uniforms.progress!, progress);
      if (p.uniforms.to) gl.uniform1i(p.uniforms.to, 0);
    });
  }

  private drawTexture(
    texture: WebGLTexture,
    program: Program,
    setUniforms: (p: Program) => void,
  ): void {
    const gl = this.gl;
    gl.useProgram(program.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(program.attribs.a_pos!);
    gl.vertexAttribPointer(program.attribs.a_pos!, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (program.uniforms.u_tex !== null && program.uniforms.u_tex !== undefined) {
      gl.uniform1i(program.uniforms.u_tex, 0);
    }
    if (program.uniforms.from !== null && program.uniforms.from !== undefined) {
      gl.uniform1i(program.uniforms.from, 0);
    }
    setUniforms(program);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

interface Program {
  program: WebGLProgram;
  attribs: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): Program {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "program link failed");
  }
  return {
    program,
    attribs: { a_pos: gl.getAttribLocation(program, "a_pos") },
    uniforms: {
      u_tex: gl.getUniformLocation(program, "u_tex"),
      u_opacity: gl.getUniformLocation(program, "u_opacity"),
      u_amount: gl.getUniformLocation(program, "u_amount"),
      u_softness: gl.getUniformLocation(program, "u_softness"),
      u_lift: gl.getUniformLocation(program, "u_lift"),
      u_gamma: gl.getUniformLocation(program, "u_gamma"),
      u_gain: gl.getUniformLocation(program, "u_gain"),
      u_saturation: gl.getUniformLocation(program, "u_saturation"),
      u_exposure: gl.getUniformLocation(program, "u_exposure"),
      u_radius: gl.getUniformLocation(program, "u_radius"),
      u_texel: gl.getUniformLocation(program, "u_texel"),
      u_dir: gl.getUniformLocation(program, "u_dir"),
      from: gl.getUniformLocation(program, "from"),
      to: gl.getUniformLocation(program, "to"),
      progress: gl.getUniformLocation(program, "progress"),
      u_blend: gl.getUniformLocation(program, "u_blend"),
      u_bounds: gl.getUniformLocation(program, "u_bounds"),
      u_feather: gl.getUniformLocation(program, "u_feather"),
      u_invert: gl.getUniformLocation(program, "u_invert"),
      u_kind: gl.getUniformLocation(program, "u_kind"),
    },
  };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
  }
  return shader;
}
