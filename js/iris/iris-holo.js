/* Iris holográfica: a imagem da Iris vira um busto 3D de luz.
   O rosto é uma malha com o formato exato do rosto dela (468 pontos marcados na imagem),
   vestida com a própria imagem. A malha ganha "músculos": pisca, abre a boca com a voz,
   e o busto inteiro acompanha o visitante com o olhar.
   Uso: const iris = createIrisHolo(container, { src }); iris.say('Oi!'); iris.speakAudio(url) */
import * as THREE from './three.module.min.js';
import * as DEF from './iris-face-data-v2.js';

const smooth = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const EYES = [
  { up: [246, 161, 160, 159, 158, 157, 173], lo: [33, 7, 163, 144, 145, 153, 154, 155, 133] },
  { up: [466, 388, 387, 386, 385, 384, 398], lo: [263, 249, 390, 373, 374, 380, 381, 382, 362] },
];
const LIP_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

/* acabamento holográfico comum: varredura, linhas e cintilação sobre a textura */
const holoChunk = `
  uniform float uTime; uniform float uTalk; uniform float uGlow; uniform float uTint;
  vec3 holo(vec3 c, vec2 uv, float y){
    float l = dot(c, vec3(.299,.587,.114));
    c = mix(c, vec3(.25,.95,.9)*(l*1.25+.04) + c*.25, uTint);
    float lines = .9 + .1*sin(y*1.6 + uTime*3.);
    float sweep = smoothstep(.06, 0., abs(fract(uv.y*.6 - uTime*.12) - .5) - .44);
    float flick = .97 + .03*sin(uTime*37.)*sin(uTime*13.);
    vec3 teal = vec3(.37,.95,.9);
    c = pow(c, vec3(.85))*1.18; // clareia sem estourar
    return c*lines*flick*(1. + uGlow*.3 + uTalk*.2) + teal*sweep*.14;
  }`;

export function createIrisHolo(host, opts = {}) {
  const { W, H, LM, TRI } = opts.data || DEF;
  const BLINK_REACH = opts.blinkReach ?? 0.9; // quanto da pele acima do olho acompanha a pálpebra
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 5000);

  const tex = new THREE.TextureLoader().load(opts.src || 'img/iris-holo.webp');
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  const bust = new THREE.Group(); scene.add(bust);
  const cx = W / 2, cy = H / 2;

  /* ---------- fundo: o busto inteiro como um painel de luz ---------- */
  const uniforms = { uTime: { value: 0 }, uTalk: { value: 0 }, uGlow: { value: 0 }, uTint: { value: opts.tint ?? 0.1 }, map: { value: tex } };
  const vtx = `varying vec2 vUv; varying float vY; void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.); vY = wp.y; gl_Position = projectionMatrix*viewMatrix*wp; }`;
  const bgMat = new THREE.ShaderMaterial({
    uniforms, transparent: true,
    vertexShader: vtx,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vY; ${holoChunk}
      void main(){ vec4 t4 = texture2D(map, vUv); vec3 c = t4.rgb; float a = t4.a;
        // brilho ciano na silhueta, como borda de holograma
        float e = 0.; vec2 px = vec2(2.5)/vec2(textureSize(map,0));
        e += texture2D(map, vUv+vec2(px.x,0.)).a + texture2D(map, vUv-vec2(px.x,0.)).a + texture2D(map, vUv+vec2(0.,px.y)).a + texture2D(map, vUv-vec2(0.,px.y)).a;
        float rim = clamp(a - e*.25 + .5, 0., 1.)*a; rim = smoothstep(.55,.95,rim)*0. + (1.-smoothstep(.0,.9,e*.25))*a;
        c += vec3(.37,.95,.9)*rim*.9;
        float edge = smoothstep(0., .04, vUv.x)*smoothstep(1., .96, vUv.x)*smoothstep(0., .03, vUv.y)*smoothstep(1., .97, vUv.y);
        gl_FragColor = vec4(holo(c, vUv, vY), a*edge); }`,
  });

  /* ---------- rosto: malha com o formato do rosto dela ---------- */
  const N = 468;
  const base = new Float32Array(N * 3), uv = new Float32Array(N * 2);
  let zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < N; i++) { const z = -LM[i * 3 + 2]; zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); }
  const PLANE_Z = zMin - 1; // o painel fica logo atrás do ponto mais fundo do rosto
  // peso de "borda": perto do contorno o rosto se cola no painel, sem emenda
  const ovalPts = OVAL.map(i => [LM[i * 3], LM[i * 3 + 1]]);
  const faceW = Math.abs(LM[454 * 3] - LM[234 * 3]);
  for (let i = 0; i < N; i++) {
    const x = LM[i * 3], y = LM[i * 3 + 1], z = -LM[i * 3 + 2];
    let d = Infinity; for (const [ox, oy] of ovalPts) d = Math.min(d, Math.hypot(x - ox, y - oy));
    const inner = smooth(0, faceW * 0.16, d);
    base[i * 3] = x - cx; base[i * 3 + 1] = -(y - cy); base[i * 3 + 2] = PLANE_Z + (z - PLANE_Z) * inner * 1.15 + 0.3;
    uv[i * 2] = x / W; uv[i * 2 + 1] = 1 - y / H;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(TRI);
  const pos = geo.attributes.position;
  const faceMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vtx,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vY; ${holoChunk}
      void main(){ gl_FragColor = vec4(holo(texture2D(map, vUv).rgb, vUv, vY), 1.); }`,
  });
  const face = new THREE.Mesh(geo, faceMat);

  /* interior da boca (aparece quando ela abre a boca) */
  const P = i => [LM[i * 3] - cx, -(LM[i * 3 + 1] - cy), -LM[i * 3 + 2]];
  const mL = P(78), mR = P(308), mU = P(13), mD = P(14);
  const mouthW = Math.abs(mR[0] - mL[0]);
  const mc = document.createElement('canvas'); mc.width = 128; mc.height = 64; const g = mc.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, '#0b1618'); grd.addColorStop(.5, '#05090a'); grd.addColorStop(1, '#0b1416');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(200,240,238,.55)'; g.beginPath(); g.ellipse(64, 6, 40, 7, 0, 0, Math.PI * 2); g.fill(); // dentes de cima, discretos
  const mouthTex = new THREE.CanvasTexture(mc); mouthTex.colorSpace = THREE.SRGBColorSpace;
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(mouthW * 1.05, mouthW * 0.75), new THREE.MeshBasicMaterial({ map: mouthTex }));
  mouth.position.set((mL[0] + mR[0]) / 2, (mU[1] + mD[1]) / 2 - mouthW * 0.3, Math.min(mU[2], mD[2]) - 4);

  /* ---------- montagem ---------- */
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), bgMat);
  plane.position.z = PLANE_Z;
  bust.add(plane, mouth, face);
  plane.renderOrder = 0; mouth.renderOrder = 1; face.renderOrder = 2;
  bgMat.depthWrite = false; mouth.material.depthWrite = false;

  /* partículas de luz subindo e anel na base */
  const PC = 260, pp = new Float32Array(PC * 3), ps = new Float32Array(PC);
  for (let i = 0; i < PC; i++) { pp[i * 3] = (Math.random() - .5) * W * .9; pp[i * 3 + 1] = (Math.random() - .5) * H; pp[i * 3 + 2] = PLANE_Z + Math.random() * 60; ps[i] = Math.random(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('seed', new THREE.BufferAttribute(ps, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: uniforms.uTime, uH: { value: H }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uH; uniform float uPx; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y + uTime*(10. + seed*25.) + uH*.5, uH) - uH*.5;
        vA = smoothstep(-uH*.5, -uH*.3, p.y)*smoothstep(uH*.5, uH*.2, p.y)*(.35 + .65*seed);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = (1.5 + seed*2.5)*uPx; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-.5); gl_FragColor = vec4(.45,1.,.95, smoothstep(.5,0.,d)*vA); }`,
  });
  bust.add(new THREE.Points(pg, pMat));
  const ring = new THREE.Mesh(new THREE.RingGeometry(W * .3, W * .31, 96), new THREE.MeshBasicMaterial({ color: '#5FE3F0', transparent: true, opacity: .5, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2.3; ring.position.set(0, -H * .5 + 4, PLANE_Z + 20); bust.add(ring);

  /* ---------- pesos dos "músculos" ---------- */
  const wBlink = new Float32Array(N), blinkTarget = new Float32Array(N), wJaw = new Float32Array(N), wUp = new Float32Array(N), wCorner = new Float32Array(N);
  EYES.forEach(e => {
    const up = e.up.map(P), lo = e.lo.map(P);
    const ex = (lo[0][0] + lo[lo.length - 1][0]) / 2, ew = Math.abs(lo[lo.length - 1][0] - lo[0][0]);
    const loY = x => { let best = lo[0], bd = Infinity; for (const p of lo) { const d = Math.abs(p[0] - x); if (d < bd) { bd = d; best = p; } } return best[1]; };
    const eyTop = Math.max(...up.map(p => p[1])), eyBot = Math.min(...lo.map(p => p[1])), eh = eyTop - eyBot;
    for (let i = 0; i < N; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      if (Math.abs(x - ex) > ew * 0.75) continue;
      const ly = loY(x) + eh * 0.12;
      if (y > ly && y < eyTop + eh * (1 + BLINK_REACH)) {
        const fx = 1 - smooth(ew * 0.42, ew * 0.75, Math.abs(x - ex));
        const fy = 1 - smooth(eyTop, eyTop + eh * (1 + BLINK_REACH), y);
        wBlink[i] = fx * fy; blinkTarget[i] = ly + (y - eyTop > 0 ? (y - eyTop) * 0.55 : 0);
      }
    }
  });
  const mcx = (mL[0] + mR[0]) / 2, mcy = (mU[1] + mD[1]) / 2, chinY = P(152)[1];
  for (let i = 0; i < N; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    const below = mcy - y, span = mcy - chinY;
    const side = 1 - smooth(mouthW * 0.9, mouthW * 1.8, Math.abs(x - mcx));
    wJaw[i] = below > -1 ? smooth(-1, span * 0.35, below) * side : 0;
    const rUp = Math.hypot((x - mcx) / (mouthW * 0.7), (y - mcy) / (span * 0.5));
    wUp[i] = y > mcy ? (1 - smooth(0.4, 1.1, rUp)) : 0;
    wCorner[i] = (1 - smooth(0.3, 1, Math.hypot((x - mcx) / (mouthW * 0.75), (y - mcy) / (span * 0.35)))) * Math.sign(x - mcx) * Math.min(1, Math.abs(x - mcx) / (mouthW * 0.5));
  }
  LIP_IN.forEach(i => { if (base[i * 3 + 1] < mcy - 0.01) wJaw[i] = Math.max(wJaw[i], 1); });

  /* ---------- vida ---------- */
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => {
    const r = host.getBoundingClientRect();
    look.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth * .5)));
    look.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * .35)) / (innerHeight * .5)));
  }, { passive: true });
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const fit = Math.max(H * 1.08, (W * 1.08) / camera.aspect);
    camera.position.set(0, 0, fit / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();
  let visible = true; new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);

  const clock = new THREE.Clock();
  let nextBlink = 1.5, blinkT = -1, talkUntil = 0, level = 0, jaw = 0, wide = 0;
  let analyser = null, buf = null, audioEl = null, synthOn = false, actx = null, bufSrc = null, bufPlaying = false;
  function audioCtx() {
    if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); analyser = actx.createAnalyser(); analyser.fftSize = 1024; buf = new Uint8Array(analyser.fftSize); analyser.connect(actx.destination); }
    return actx;
  }

  function voiceLevel(t) {
    if (analyser && (bufPlaying || (audioEl && !audioEl.paused))) {
      analyser.getByteTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
      return Math.min(1, Math.sqrt(s / buf.length) * 5.5);
    }
    if (synthOn || performance.now() < talkUntil) {
      return Math.abs(Math.sin(t * 10.5)) * (0.55 + 0.45 * Math.sin(t * 2.9 + 1)) * (0.75 + 0.25 * Math.sin(t * 21));
    }
    return 0;
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    const k = 1 - Math.pow(.004, dt), idle = reduce ? 0 : 1;
    look.x += (look.tx - look.x) * k; look.y += (look.ty - look.y) * k;

    // voz -> mandíbula, com ataque rápido e soltura suave
    const v = voiceLevel(t);
    level += (v - level) * (v > level ? .6 : .2);
    const talking = level > .04;
    jaw += (Math.min(1, level * 1.1) - jaw) * .5;
    wide += ((talking ? Math.sin(t * 4.7) * .5 : 0) - wide) * .15;

    // piscar natural
    nextBlink -= dt;
    if (nextBlink <= 0 && blinkT < 0) { blinkT = 0; nextBlink = Math.random() < .15 ? .3 : 2.2 + Math.random() * 3.8; }
    let bl = 0;
    if (blinkT >= 0) { blinkT += dt; const d = .18; bl = blinkT < d ? Math.sin((blinkT / d) * Math.PI) : 0; if (blinkT >= d) blinkT = -1; }

    const arr = pos.array, faceH = mcy - chinY;
    for (let i = 0; i < N; i++) {
      const j = i * 3; let x = base[j], y = base[j + 1], z = base[j + 2];
      if (wBlink[i]) y += (blinkTarget[i] - y) * bl * wBlink[i];
      if (wJaw[i]) { y -= jaw * faceH * .32 * wJaw[i]; z -= jaw * 3 * wJaw[i]; }
      if (wUp[i]) y += jaw * faceH * .05 * wUp[i];
      if (wCorner[i]) x += (wide * .08 - jaw * .04) * mouthW * wCorner[i];
      arr[j] = x; arr[j + 1] = y; arr[j + 2] = z;
    }
    pos.needsUpdate = true;

    // o busto acompanha o visitante e respira
    bust.rotation.y = look.x * .2 + Math.sin(t * .31) * .025 * idle;
    bust.rotation.x = look.y * .1 + Math.sin(t * .47) * .015 * idle - jaw * .02;
    bust.position.y = Math.sin(t * 1.2) * 2 * idle;
    bust.scale.setScalar(1 + Math.sin(t * 1.2) * .003 * idle);

    uniforms.uTime.value = t; uniforms.uTalk.value = Math.min(1, level * 1.5);
    uniforms.uGlow.value += ((talking ? .6 : .1 + .08 * Math.sin(t * 1.7)) - uniforms.uGlow.value) * .08;
    ring.material.opacity = .35 + level * .5; ring.rotation.z = t * .2;
    renderer.render(scene, camera);
  }
  frame();

  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    return vs.find(v => /pt[-_]BR/i.test(v.lang) && /female|francisca|luciana|maria|vitoria|thalita/i.test(v.name)) || vs.find(v => /pt[-_]BR/i.test(v.lang));
  }

  return {
    /* boca segue o texto (sem áudio) ou a voz do navegador */
    say(text, { voice = false } = {}) {
      const ms = Math.min(9000, 600 + text.length * 55);
      if (voice && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; u.rate = 1.04; u.pitch = 1.08;
        const vv = pickVoice(); if (vv) u.voice = vv;
        u.onstart = () => { synthOn = true; }; u.onend = u.onerror = () => { synthOn = false; };
        speechSynthesis.speak(u);
      } else talkUntil = performance.now() + ms;
      return ms;
    },
    /* toca um áudio (ex.: voz da Iris no ElevenLabs) e a boca acompanha o som de verdade */
    speakAudio(src) {
      const ctx = audioCtx();
      if (!audioEl) { audioEl = new Audio(); audioEl.crossOrigin = 'anonymous'; ctx.createMediaElementSource(audioEl).connect(analyser); }
      ctx.resume(); audioEl.src = src; return audioEl.play();
    },
    /* toca um áudio já baixado (ArrayBuffer, ex.: MP3 do ElevenLabs); resolve quando termina */
    async speakBuffer(data) {
      const ctx = audioCtx(); await ctx.resume();
      const audio = await ctx.decodeAudioData(data);
      if (bufSrc) { try { bufSrc.stop(); } catch (e) {} }
      bufSrc = ctx.createBufferSource(); bufSrc.buffer = audio; bufSrc.connect(analyser);
      bufPlaying = true;
      return new Promise(res => { bufSrc.onended = () => { bufPlaying = false; res(); }; bufSrc.start(); });
    },
    /* precisa ser chamado num clique: libera o som no navegador */
    unlock() { return audioCtx().resume(); },
    stop() { talkUntil = 0; synthOn = false; if (audioEl) audioEl.pause(); if (bufSrc) { try { bufSrc.stop(); } catch (e) {} bufPlaying = false; } if ('speechSynthesis' in window) speechSynthesis.cancel(); },
    lookAt(x, y) { look.tx = x; look.ty = y; },
  };
}
