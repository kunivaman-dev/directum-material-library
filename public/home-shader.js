(() => {
  const canvas = document.getElementById('home-scene');
  if (!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = 'true';

  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    powerPreference: 'high-performance'
  });
  if (!gl) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !reducedMotion;
  const focus = false;
  const performanceOverride = new URLSearchParams(location.search).get('performance');
  const memory = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const lowPower = performanceOverride === 'low' || (performanceOverride !== 'full' && (memory <= 4 || cores <= 4));
  canvas.dataset.performanceTier = lowPower ? 'reduced' : 'full';
  let width = 1;
  let height = 1;
  let quality = Math.min(devicePixelRatio || 1, lowPower ? 1 : 1.55);
  let slowFrames = 0;
  let fastFrames = 0;
  let lastTime = performance.now();
  let lastDrawTime = 0;
  let animationFrame = 0;
  const pointer = { x: .9, y: -.58, tx: .9, ty: -.58 };

  const vertex = `#version 300 es
    in vec2 position;
    void main() { gl_Position = vec4(position, 0., 1.); }
  `;

  const fragment = `#version 300 es
    precision highp float;
    out vec4 outColor;

    uniform vec2 uResolution;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uMotion;
    uniform float uFocus;
    uniform float uSceneScale;
    uniform float uLowPower;
    uniform sampler2D uBackdrop;
    uniform sampler2D uOverlay;

    #define FAR 8.0
    #define EPS .0016
    #define STEPS 88

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float smin(float a, float b, float k) {
      float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
      return mix(b, a, h) - k * h * (1. - h);
    }

    mat2 rot(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }

    float sdEllipsoid(vec3 p, vec3 r) {
      float k0 = length(p / r);
      float k1 = length(p / (r * r));
      return k0 * (k0 - 1.) / k1;
    }

    float sdOctahedron(vec3 p, float s) {
      p = abs(p);
      return (p.x + p.y + p.z - s) * .57735027;
    }

    vec3 mainCenter() { return vec3(0., .015, 0.); }

    float glassField(vec3 p) {
      vec3 q = (p - mainCenter()) / uSceneScale;
      q.xz *= rot(.16 + sin(uTime * .22) * .055 * uMotion);
      q.xy *= rot(-.06 + sin(uTime * .17) * .035 * uMotion);
      float wobble = .021 * sin(q.y * 6. + uTime) * sin(q.x * 5. - uTime * .7) * uMotion;
      float body = sdEllipsoid(q, vec3(.94 + wobble, .88 - wobble * .4, .63)) * uSceneScale;

      vec3 satellite = vec3(uPointer, .08);
      float drop = length((p - satellite) / vec3(1., 1., .8)) - .205 * uSceneScale;

      vec3 gemP = q;
      gemP.xy *= rot(uTime * .08 * uMotion);
      float gem = sdOctahedron(gemP * vec3(1., 1., 1.12), 1.16) * uSceneScale;
      float shape = smoothstep(.45, 1., uFocus);
      body = mix(body, max(gem, (length(q) - 1.02) * uSceneScale), shape * .36);
      return smin(body, drop, .12);
    }

    vec3 normalAt(vec3 p) {
      vec2 e = vec2(EPS, 0.);
      return normalize(vec3(
        glassField(p + e.xyy) - glassField(p - e.xyy),
        glassField(p + e.yxy) - glassField(p - e.yxy),
        glassField(p + e.yyx) - glassField(p - e.yyx)
      ));
    }

    bool marchOutside(vec3 ro, vec3 rd, out vec3 p, out float travel) {
      float t = 0.;
      for (int i = 0; i < STEPS; i++) {
        if (uLowPower > .5 && i >= 56) break;
        p = ro + rd * t;
        float d = glassField(p);
        if (d < EPS) { travel = t; return true; }
        t += max(d * .72, .008);
        if (t > FAR) break;
      }
      travel = t;
      return false;
    }

    bool findExit(vec3 start, vec3 rd, out vec3 p, out vec3 n) {
      p = start + rd * .025;
      for (int i = 0; i < 70; i++) {
        if (uLowPower > .5 && i >= 44) break;
        float d = glassField(p);
        p += rd * max(abs(d) * .7, .006);
        if (d > 0.) { n = normalAt(p); return true; }
      }
      n = vec3(0., 0., 1.);
      return false;
    }

    vec3 spectrum(float w) {
      vec3 c;
      c.r = smoothstep(510., 600., w) - smoothstep(680., 720., w);
      c.g = smoothstep(430., 530., w) - smoothstep(610., 680., w);
      c.b = smoothstep(360., 430., w) - smoothstep(520., 610., w);
      float edge = smoothstep(390., 430., w) * (1. - smoothstep(690., 720., w));
      return max(c * edge, 0.);
    }

    vec2 wallUv(vec3 ro, vec3 rd) {
      float t = (-2.45 - ro.z) / min(rd.z, -.001);
      vec3 p = ro + rd * max(t, 0.);
      float aspect = uResolution.x / uResolution.y;
      return vec2(.5 + p.x / (5.2 * aspect), .5 + p.y / 5.2);
    }

    vec3 energyField(vec2 uv) {
      float fieldMask = smoothstep(.0, .035, uv.x) * (1. - smoothstep(.965, 1., uv.x));
      fieldMask *= smoothstep(.08, .15, uv.y) * (1. - smoothstep(.85, .92, uv.y));
      float cells = 27.;
      float lane = (uv.x - .015) / .97 * cells;
      float index = floor(lane);
      float localX = abs(fract(lane) - .5);
      float phase = clamp((uv.x - .015) / .97, 0., 1.);
      float drift = sin(uTime * .72 + index * 1.37) * .03 * uMotion;
      float pulse = .68 + .32 * sin(uTime * 1.8 + index * .83);
      float rhythm = .54 + .46 * sin(index * 2.17 + 1.4);
      float halfHeight = .09 + .16 * rhythm * (1. - abs(phase - .5) * .42);
      float vertical = 1. - smoothstep(halfHeight, halfHeight + .055, abs(uv.y - (.5 + drift)));
      float barCore = 1. - smoothstep(.12, .24, localX);
      float barGlow = 1. - smoothstep(.08, .48, localX);

      vec3 blue = vec3(.006, .075, .94);
      vec3 orange = vec3(1.02, .105, .0);
      vec3 hue = mix(blue, orange, smoothstep(.42, .58, phase));
      float gradientPhase = fract(uv.x - uTime * .045);
      float gradientWave = smoothstep(.02, .5, gradientPhase) * (1. - smoothstep(.5, .98, gradientPhase));
      float reveal = pow(gradientWave, 1.18);
      vec3 gradientTint = mix(vec3(.01, .19, 1.28), vec3(1.28, .19, .0), smoothstep(.18, .82, gradientPhase));
      vec3 flowingHue = mix(hue, gradientTint, reveal * .4);
      float flowingLight = .055 + reveal * 1.2;
      float revealedShape = barCore * .44 + barGlow * mix(.025, .14, reveal);
      vec3 bars = flowingHue * vertical * revealedShape * pulse * flowingLight * fieldMask;

      float lineY = .5
        + sin(uv.x * 78. + uTime * 4.1) * .0045 * uMotion
        + sin(uv.x * 173. - uTime * 6.4) * .0024 * uMotion;
      float lineDistance = abs(uv.y - lineY);
      float flicker = .78 + .22 * sin(uTime * 8. + uv.x * 64.);
      float core = exp(-lineDistance * 980.) * flicker;
      float glow = exp(-lineDistance * 82.) * (.72 + .28 * sin(uTime * 2.4 + uv.x * 18.));
      float sparks = pow(max(0., sin(uv.x * 121. - uTime * 7.)), 18.) * exp(-lineDistance * 260.);
      vec3 lineHue = mix(vec3(.02, .32, 1.5), vec3(1.55, .18, .0), smoothstep(.43, .57, uv.x));
      vec3 electricity = lineHue * glow * .72 + vec3(.9, .97, 1.) * core * 1.75 + lineHue * sparks * 1.15;
      float cycle = fract(uTime / 5.);
      float discharge = exp(-pow((cycle - .5) / .105, 2.));
      return bars + electricity * discharge * fieldMask;
    }

    vec3 backdrop(vec3 ro, vec3 rd) {
      vec2 uv = wallUv(ro, rd);
      vec3 c = texture(uBackdrop, uv).rgb;
      c += energyField(uv);
      vec4 overlay = texture(uOverlay, uv);
      c = mix(c, overlay.rgb, overlay.a);
      float vignette = smoothstep(.95, .16, distance(uv, vec2(.5)));
      float luma = dot(c, vec3(.2126, .7152, .0722));
      c = mix(vec3(luma), c, 1.3);
      return c * mix(.64, 1.08, vignette);
    }

    vec3 traceWavelength(vec3 entry, vec3 inDir, vec3 entryN, float ior) {
      vec3 d = refract(inDir, entryN, 1. / ior);
      if (dot(d, d) < .01) d = reflect(inDir, entryN);
      vec3 p = entry;
      vec3 exitN;
      for (int bounce = 0; bounce < 3; bounce++) {
        if (uLowPower > .5 && bounce >= 2) break;
        if (!findExit(p, d, p, exitN)) return backdrop(entry, inDir);
        vec3 outDir = refract(d, -exitN, ior);
        if (dot(outDir, outDir) > .01) return backdrop(p + outDir * .01, outDir);
        d = reflect(d, -exitN);
        p -= exitN * .025;
      }
      return backdrop(p, d);
    }

    vec3 envReflection(vec3 r) {
      float top = smoothstep(-.2, .9, r.y);
      vec3 base = mix(vec3(.004, .009, .018), vec3(.025, .09, .17), top);
      vec3 keyDir = normalize(vec3(-.55, .72, .42));
      vec3 rimDir = normalize(vec3(.68, .28, .66));
      float key = pow(max(dot(r, keyDir), 0.), 56.);
      float rim = pow(max(dot(r, rimDir), 0.), 110.);
      return base + vec3(.48, .82, 1.) * key * 2.7 + vec3(1., .16, .0) * rim * 1.72;
    }

    vec3 addCaustic(vec3 color, vec3 ro, vec3 rd) {
      vec2 uv = wallUv(ro, rd);
      vec2 p = (uv - vec2(.5, .495)) * vec2(uResolution.x / uResolution.y, 1.);
      float a = atan(p.y, p.x);
      float r = length(p);
      float warped = r + sin(a * 5. + uTime * .45) * .008 * uMotion;
      float shadow = smoothstep(.24, .08, warped);
      float core = exp(-92. * warped * warped);
      float ring = exp(-1500. * pow(warped - .13, 2.));
      color *= 1. - shadow * .25;
      color += vec3(1., .12, .0) * core * .2;
      color += spectrum(430. + fract(a / 6.283 + .5) * 260.) * ring * .3;
      return color;
    }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 p = (frag * 2. - uResolution) / uResolution.y;
      vec3 ro = vec3(0., 0., 3.6);
      vec3 rd = normalize(vec3(p * .92, -2.45));
      vec3 entry;
      float travel;

      if (!marchOutside(ro, rd, entry, travel)) {
        vec3 bg = addCaustic(backdrop(ro, rd), ro, rd);
        float grain = (hash21(frag + floor(uTime * 7.)) - .5) * .014;
        outColor = vec4(bg + grain, 1.);
        return;
      }

      vec3 N = normalAt(entry);
      float facing = max(dot(-rd, N), 0.);
      float fresnel = .025 + .64 * pow(1. - facing, 5.);
      vec3 transmitted = vec3(0.);
      vec3 weight = vec3(0.);
      float baseIor = mix(1.49, 1.74, uFocus);
      float spread = mix(.04, .11, uFocus);

      for (int i = 0; i < 7; i++) {
        if (uLowPower > .5 && i >= 4) break;
        float spectrumSteps = mix(6., 3., step(.5, uLowPower));
        float wavelength = mix(410., 690., float(i) / spectrumSteps);
        float curve = pow(550. / wavelength, 2.) - 1.;
        float ior = baseIor + spread * curve;
        vec3 spectral = spectrum(wavelength);
        transmitted += traceWavelength(entry, rd, N, ior) * spectral;
        weight += spectral;
      }
      transmitted /= max(weight, vec3(.001));

      // Keep the optical axis calm so the centered title remains legible.
      float calmCenter = smoothstep(.48, .96, facing);
      transmitted = mix(transmitted, backdrop(ro, rd), calmCenter * .76);

      vec3 reflected = envReflection(reflect(rd, N));
      vec3 view = normalize(-rd);
      vec3 light = normalize(vec3(-.38, .62, .72));
      float highlight = pow(max(dot(reflect(-light, N), view), 0.), 84.);
      float edgeGlow = pow(1. - max(dot(view, N), 0.), 2.5);
      vec3 color = mix(transmitted, reflected, fresnel * .3);
      color = mix(color, backdrop(ro, rd), edgeGlow * .62);
      color += vec3(.92, .98, 1.) * highlight * 2.05;
      vec3 spectralRim = mix(vec3(.01, .18, 1.3), vec3(1.4, .12, .0), smoothstep(-.5, .5, N.x));
      color += spectralRim * edgeGlow * .34;
      color *= exp(-travel * .009);
      outColor = vec4(pow(color, vec3(.94)), 1.);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn('WebGL scene unavailable:', error);
    return;
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const geometry = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {};
  ['uResolution', 'uPointer', 'uTime', 'uMotion', 'uFocus', 'uSceneScale', 'uLowPower', 'uBackdrop', 'uOverlay'].forEach((name) => {
    uniforms[name] = gl.getUniformLocation(program, name);
  });

  const backdropCanvas = document.createElement('canvas');
  const ctx = backdropCanvas.getContext('2d');
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const overlayCanvas = document.createElement('canvas');
  const overlayCtx = overlayCanvas.getContext('2d');
  const overlayTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, overlayTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  function drawBackdrop() {
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    backdropCanvas.width = Math.max(1, Math.round(width * scale));
    backdropCanvas.height = Math.max(1, Math.round(height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    overlayCanvas.width = backdropCanvas.width;
    overlayCanvas.height = backdropCanvas.height;
    overlayCtx.setTransform(scale, 0, 0, scale, 0, 0);
    overlayCtx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(width * .5, height * .4, 0, width * .5, height * .44, Math.max(width, height));
    gradient.addColorStop(0, '#071421');
    gradient.addColorStop(.43, '#030914');
    gradient.addColorStop(1, '#010307');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Counterpoint from the reference: electric blue meets Directum orange at the optical center.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const radius = Math.min(width, height) * .5;
    const blueGlow = ctx.createRadialGradient(width * .34, height * .51, 0, width * .34, height * .51, radius * 1.35);
    blueGlow.addColorStop(0, 'rgba(0, 61, 255, .24)');
    blueGlow.addColorStop(.32, 'rgba(0, 27, 160, .11)');
    blueGlow.addColorStop(1, 'rgba(0, 8, 48, 0)');
    ctx.fillStyle = blueGlow;
    ctx.fillRect(0, 0, width, height);

    const orangeGlow = ctx.createRadialGradient(width * .66, height * .51, 0, width * .66, height * .51, radius * 1.35);
    orangeGlow.addColorStop(0, 'rgba(255, 72, 0, .28)');
    orangeGlow.addColorStop(.32, 'rgba(188, 31, 0, .11)');
    orangeGlow.addColorStop(1, 'rgba(64, 8, 0, 0)');
    ctx.fillStyle = orangeGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();

    const size = Math.min(width * (width < 720 ? .155 : .118), height * .17);
    const centerX = width * .5;
    const centerY = height * .5;
    overlayCtx.textAlign = 'center';
    overlayCtx.textBaseline = 'middle';
    overlayCtx.font = `700 ${size}px Montserrat, Arial, Helvetica, sans-serif`;
    overlayCtx.fillStyle = '#f7f8fb';
    overlayCtx.fillText('DIRECTUM', centerX, centerY - size * .41);
    overlayCtx.fillStyle = '#ff7200';
    overlayCtx.fillText('DESIGN', centerX, centerY + size * .43);

    overlayCtx.save();
    overlayCtx.globalAlpha = .76;
    overlayCtx.fillStyle = '#ff8600';
    overlayCtx.textAlign = 'left';
    overlayCtx.font = `500 ${Math.max(10, width * .0085)}px ui-monospace, monospace`;
    overlayCtx.translate(width * .94, height * .5);
    overlayCtx.rotate(Math.PI / 2);
    overlayCtx.fillText('DIRECTUM / DESIGN SYSTEM', 0, 0);
    overlayCtx.restore();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, backdropCanvas);
    gl.bindTexture(gl.TEXTURE_2D, overlayTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, overlayCanvas);
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.max(1, Math.round(width * quality));
    canvas.height = Math.max(1, Math.round(height * quality));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    drawBackdrop();
  }

  function setQuality(next) {
    const cap = Math.min(devicePixelRatio || 1, lowPower ? 1 : 1.55);
    next = Math.max(lowPower ? .55 : .68, Math.min(next, cap));
    if (Math.abs(next - quality) < .08) return;
    quality = next;
    resize();
  }

  function render(now) {
    animationFrame = 0;
    if (document.hidden) return;
    if (lowPower && now - lastDrawTime < 32) {
      animationFrame = requestAnimationFrame(render);
      return;
    }
    lastDrawTime = now;
    const dt = Math.min(80, now - lastTime);
    lastTime = now;
    const follow = 1 - Math.exp(-dt * .045);
    pointer.x += (pointer.tx - pointer.x) * follow;
    pointer.y += (pointer.ty - pointer.y) * follow;

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.uBackdrop, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, overlayTexture);
    gl.uniform1i(uniforms.uOverlay, 1);
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
    gl.uniform1f(uniforms.uTime, reducedMotion ? 0 : now * .001);
    gl.uniform1f(uniforms.uMotion, motion ? 1 : 0);
    gl.uniform1f(uniforms.uFocus, focus ? 1 : 0);
    gl.uniform1f(uniforms.uSceneScale, width < 720 ? .68 : 1.02);
    gl.uniform1f(uniforms.uLowPower, lowPower ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (dt > (lowPower ? 44 : 25)) { slowFrames++; fastFrames = 0; }
    else if (dt < (lowPower ? 35 : 17.5)) { fastFrames++; slowFrames = Math.max(0, slowFrames - 1); }
    if (slowFrames > 30) { slowFrames = 0; setQuality(quality * .88); }
    if (fastFrames > 180) { fastFrames = 0; setQuality(quality * 1.08); }
    if (!reducedMotion) animationFrame = requestAnimationFrame(render);
  }

  function resumeRendering() {
    if (document.hidden || animationFrame) return;
    lastTime = performance.now();
    lastDrawTime = 0;
    animationFrame = requestAnimationFrame(render);
  }

  function pointToWorld(clientX, clientY) {
    // Matches the camera projection in the fragment shader; the droplet sits under the pointer.
    pointer.tx = ((clientX * 2 - width) / height) * 1.352;
    pointer.ty = ((height - clientY * 2) / height) * 1.352;
  }

  addEventListener('pointermove', (event) => pointToWorld(event.clientX, event.clientY), { passive: true });
  addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (touch) pointToWorld(touch.clientX, touch.clientY);
  }, { passive: true });
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', resumeRendering);

  resize();
  document.fonts?.ready.then(() => drawBackdrop()).catch(() => {});
  resumeRendering();
})();
