// "3D photo" renderer: displaces the image by its AI depth map so near objects move
// more than far ones (real parallax), and optionally blurs by depth (AI bokeh).

const VERT = `
attribute vec2 a;
varying vec2 vUv;
void main() {
  vUv = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5);
  gl_Position = vec4(a, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
uniform sampler2D uImg;
uniform sampler2D uBlur;
uniform sampler2D uDepth;
uniform vec2 uOffset;
uniform float uZoom;
uniform float uFocus;
uniform float uBokeh;
uniform float uDofFocus;
varying vec2 vUv;

void main() {
  // Invert uv = 0.5 + (p - 0.5) * (1 + zoom * d) + offset * (d - focus) by fixed-point iteration.
  vec2 p = vUv;
  float d = 0.0;
  for (int i = 0; i < 8; i++) {
    d = texture2D(uDepth, p).r;
    p = 0.5 + (vUv - uOffset * (d - uFocus) - 0.5) / (1.0 + uZoom * d);
  }
  p = clamp(p, 0.001, 0.999);
  vec4 sharp = texture2D(uImg, p);
  vec4 soft = texture2D(uBlur, p);
  float blurAmount = uBokeh * smoothstep(0.08, 0.45, abs(d - uDofFocus));
  gl_FragColor = mix(sharp, soft, blurAmount);
}`

type Source = (HTMLImageElement | HTMLCanvasElement) & { width: number; height: number }

export class DepthRenderer {
  readonly canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  /** Depth value of the main subject, used as the focus plane for bokeh. */
  readonly subjectDepth: number

  constructor(image: Source, depth: HTMLCanvasElement, maxSide = 1280) {
    const k = Math.min(1, maxSide / Math.max(image.width, image.height))
    this.canvas = document.createElement('canvas')
    this.canvas.width = Math.round(image.width * k)
    this.canvas.height = Math.round(image.height * k)
    const gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false })
    if (!gl) throw new Error('Tu dispositivo no soporta WebGL, necesario para el modo 3D.')
    this.gl = gl

    const prog = gl.createProgram()!
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const) {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error')
      gl.attachShader(prog, sh)
    }
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    for (const n of ['uImg', 'uBlur', 'uDepth', 'uOffset', 'uZoom', 'uFocus', 'uBokeh', 'uDofFocus']) this.uniforms[n] = gl.getUniformLocation(prog, n)

    const blurred = document.createElement('canvas')
    blurred.width = this.canvas.width
    blurred.height = this.canvas.height
    const b = blurred.getContext('2d')!
    b.filter = `blur(${Math.max(4, Math.round(Math.max(blurred.width, blurred.height) / 90))}px)`
    b.drawImage(image, 0, 0, blurred.width, blurred.height)

    this.texture(0, image, 'uImg')
    this.texture(1, blurred, 'uBlur')
    this.texture(2, smoothDepth(depth), 'uDepth')
    this.subjectDepth = percentile(depth, 0.9)
  }

  private texture(unit: number, src: TexImageSource, name: string) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.uniform1i(this.uniforms[name], unit)
  }

  render(o: { offsetX: number; offsetY: number; zoom: number; bokeh: number }) {
    const gl = this.gl
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.uniform2f(this.uniforms.uOffset, o.offsetX, o.offsetY)
    gl.uniform1f(this.uniforms.uZoom, o.zoom)
    gl.uniform1f(this.uniforms.uFocus, 0.35)
    gl.uniform1f(this.uniforms.uBokeh, o.bokeh)
    gl.uniform1f(this.uniforms.uDofFocus, this.subjectDepth)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return this.canvas
  }
}

// Softens depth edges so displacement doesn't tear hard silhouettes.
function smoothDepth(depth: HTMLCanvasElement) {
  const c = document.createElement('canvas')
  c.width = depth.width
  c.height = depth.height
  const ctx = c.getContext('2d')!
  ctx.filter = `blur(${Math.max(2, Math.round(Math.max(c.width, c.height) / 200))}px)`
  ctx.drawImage(depth, 0, 0)
  return c
}

function percentile(depth: HTMLCanvasElement, q: number) {
  const data = depth.getContext('2d')!.getImageData(0, 0, depth.width, depth.height).data
  const hist = new Array(256).fill(0)
  for (let i = 0; i < data.length; i += 4) hist[data[i]]++
  const target = (data.length / 4) * q
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= target) return v / 255
  }
  return 1
}
