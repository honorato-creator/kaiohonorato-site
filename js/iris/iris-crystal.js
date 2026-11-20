/* Iris em cristal: uma esfera de vidro flutuando sobre uma base com anel de luz,
   com uma íris mecânica acesa dentro. O olho acompanha o visitante, a pupila
   abre quando ela ouve, a íris gira quando ela pensa e pulsa com a voz.
   Three.js puro (sem addons), com brilho feito por sprites para rodar leve no celular.
   Mesma interface do iris-orb.js: setState, say, speakAudio, speakBuffer, unlock, stop. */
import * as THREE from './three.module.min.js';

const ORANGE = new THREE.Color('#ff6a26');
const HOT = new THREE.Color('#ffb27a');

function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sprite = (tex, color, opacity, size) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
};

export function createIrisCrystal(host, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);

  /* estúdio invisível só para os reflexos do vidro e do metal */
  const pm = new THREE.PMREMGenerator(renderer);
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: '#141518', side: THREE.BackSide })));
  const box = (w, h, col, p, r) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); if (r) m.rotateZ(r); studio.add(m); };
  box(10, 3, '#ffffff', [-6, 6, 6]); box(3, 8, '#f1ebe4', [8, 1, 3]); box(8, 2, '#ff7a3a', [0, -7, 4]); box(6, 6, '#d8d6c9', [-4, 2, -9]);
  scene.environment = pm.fromScene(studio, .03).texture;

  const root = new THREE.Group(); scene.add(root);
  const orb = new THREE.Group(); root.add(orb);

  /* ---------- a íris dentro do cristal ---------- */
  const eye = new THREE.Group(); orb.add(eye);
  const glowT = glowTexture([[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
  const ringMat = (op) => new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  // fundo escuro do olho (dá contraste para a luz)
  const back = new THREE.Mesh(new THREE.CircleGeometry(.62, 64), new THREE.MeshStandardMaterial({ color: '#05080b', metalness: .9, roughness: .35 }));
  back.position.z = -.08; eye.add(back);
  // aro de metal em volta da íris
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(.62, .045, 24, 96), new THREE.MeshStandardMaterial({ color: '#1b2226', metalness: 1, roughness: .25 }));
  eye.add(bezel);
  // anéis da íris: cada um gira num ritmo
  const rings = [];
  [[.47, .5, .55], [.4, .42, .9], [.3, .33, .7], [.2, .245, 1]].forEach(([a, b, op], i) => {
    const r = new THREE.Mesh(new THREE.RingGeometry(a, b, 96, 1, 0, Math.PI * (i % 2 ? 1.7 : 2)), ringMat(op));
    r.position.z = .01 + i * .012; eye.add(r); rings.push(r);
  });
  // raios da íris (as fibras), dois anéis de traços
  const spokes = (n, r1, r2, op) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, l = r2 - (Math.random() * .5) * (r2 - r1); pts.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * l, Math.sin(a) * l, 0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: HOT, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.z = .03; eye.add(m); return m;
  };
  const fibers = spokes(90, .25, .46, .75);
  const outer = new THREE.Group(); orb.add(outer); // raios de fora, presos no vidro
  { const pts = [];
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, r1 = .68 + Math.random() * .05, r2 = r1 + .06 + Math.random() * .16, z = (Math.random() - .5) * .3;
      pts.push(Math.cos(a) * r1, Math.sin(a) * r1, z, Math.cos(a) * r2, Math.sin(a) * r2, z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    outer.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }))); }
  // pupila: esfera escura e lisa, com o brilho do anel em volta
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(.11, 32, 16), new THREE.MeshStandardMaterial({ color: '#020304', metalness: .6, roughness: .08 }));
  pupil.position.z = .06; eye.add(pupil);
  const halo = new THREE.Mesh(new THREE.RingGeometry(.122, .148, 96), new THREE.MeshBasicMaterial({ color: '#ffd9bf', transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.z = .05; eye.add(halo);
  const coreGlow = sprite(glowT, ORANGE, .9, 1.25); coreGlow.position.z = .02; eye.add(coreGlow);
  const hotGlow = sprite(glowT, new THREE.Color('#ffe2cc'), .55, .55); hotGlow.position.z = .07; eye.add(hotGlow);

  /* ---------- o cristal ---------- */
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshPhysicalMaterial({
    color: '#ffffff', metalness: 0, roughness: .03, transparent: true, opacity: .06, envMapIntensity: 3,
    clearcoat: 1, clearcoatRoughness: .03, ior: 1.45, specularIntensity: 1, depthWrite: false,
  }));
  glass.renderOrder = 2; orb.add(glass);
  // borda de luz do vidro (fresnel): é o que faz parecer uma bola de cristal
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.002, 96, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color('#f1ebe4') }, uWarm: { value: ORANGE.clone() }, uK: { value: .85 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform vec3 uWarm; uniform float uK; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.4); vec3 c = mix(uCol, uWarm, smoothstep(.1,-1.,vY)*.85); gl_FragColor = vec4(c*f*uK*1.6, f*uK); }`,
  }));
  rim.renderOrder = 3; orb.add(rim);
  // reflexo de janela no vidro (o brilho que denuncia que é cristal)
  const shine = sprite(glowTexture([[0, 'rgba(255,255,255,.9)'], [.5, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]), new THREE.Color('#ffffff'), .5, 1);
  shine.scale.set(.55, .2, 1); shine.material.rotation = .7; shine.position.set(-.48, .58, .75); shine.renderOrder = 4; orb.add(shine);
  const shine2 = sprite(glowT, new THREE.Color('#ffffff'), .25, .18); shine2.position.set(.55, -.5, .7); orb.add(shine2);
  // poeira de luz dentro do vidro
  const dust = (() => {
    const n = 140, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(.35 + Math.random() * .6); p.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ map: glowT, color: HOT, size: .035, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    orb.add(m); return m;
  })();

  /* ---------- base com anel de luz ---------- */
  const base = new THREE.Group(); base.position.y = -1.55; root.add(base);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.32, .14, 96), new THREE.MeshStandardMaterial({ color: '#1a2125', metalness: 1, roughness: .32 }));
  base.add(plate);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.2, 96), new THREE.MeshStandardMaterial({ color: '#0b1013', metalness: .8, roughness: .45 }));
  top.rotation.x = -Math.PI / 2; top.position.y = .071; base.add(top);
  const neon = new THREE.Mesh(new THREE.TorusGeometry(.98, .018, 16, 160), new THREE.MeshBasicMaterial({ color: '#ffd2b5' }));
  neon.rotation.x = Math.PI / 2; neon.position.y = .08; base.add(neon);
  const neonGlow = new THREE.Mesh(new THREE.RingGeometry(.86, 1.12, 128), new THREE.MeshBasicMaterial({ map: glowTexture([[0, 'rgba(255,255,255,0)'], [.72, 'rgba(255,255,255,0)'], [.86, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]), color: ORANGE, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  neonGlow.rotation.x = -Math.PI / 2; neonGlow.position.y = .085; base.add(neonGlow);
  // luz que cai do orbe na base
  const pool = sprite(glowT, ORANGE, .35, 2.2); pool.position.y = .2; pool.scale.y = .5; base.add(pool);
  // luzes reais para o metal
  const key = new THREE.PointLight(ORANGE, 6, 6, 1.5); key.position.set(0, -.6, .3); root.add(key);
  scene.add(new THREE.HemisphereLight('#f1ebe4', '#121316', .6));
  const aura = sprite(glowT, ORANGE, .28, 4.2); aura.position.z = -1.2; root.add(aura);

  /* ---------- câmera e tamanho ---------- */
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const fitH = 4.0, fitW = 3.4 / camera.aspect;
    camera.position.set(0, .25, Math.max(fitH, fitW) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
    camera.lookAt(0, -.35, 0); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();
  let visible = true; new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => {
    const r = host.getBoundingClientRect();
    look.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth * .5)));
    look.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * .4)) / (innerHeight * .5)));
  }, { passive: true });

  /* ---------- voz ---------- */
  let talkUntil = 0, analyser = null, buf = null, audioEl = null, synthOn = false, actx = null, bufSrc = null, bufPlaying = false;
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
    if (synthOn || performance.now() < talkUntil) return Math.abs(Math.sin(t * 10.5)) * (.55 + .45 * Math.sin(t * 2.9 + 1));
    return 0;
  }

  /* ---------- vida ---------- */
  const MODES = { idle: { spin: .25, pupil: 1, glow: .75 }, listen: { spin: .35, pupil: 1.45, glow: 1 }, think: { spin: 2.4, pupil: .75, glow: 1.15 }, talk: { spin: .6, pupil: 1.1, glow: 1 } };
  let state = 'idle', spin = .25, pup = 1, gl = .75, level = 0, blink = 0, nextBlink = 3;
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime, m = MODES[state], k = 1 - Math.pow(.02, dt), idle = reduce ? .2 : 1;
    spin += (m.spin - spin) * k; pup += (m.pupil - pup) * k; gl += (m.glow - gl) * k;
    const v = voiceLevel(t); level += (v - level) * (v > level ? .6 : .15);
    look.x += (look.tx - look.x) * k * .8; look.y += (look.ty - look.y) * k * .8;

    orb.position.y = Math.sin(t * 1.1) * .06 * idle;
    orb.rotation.y = look.x * .35; orb.rotation.x = look.y * .25;
    rings.forEach((r, i) => { r.rotation.z += dt * spin * (i % 2 ? -1 : 1) * (1 + i * .35) * idle; });
    fibers.rotation.z -= dt * spin * .3 * idle;
    outer.rotation.z += dt * .05 * idle;
    dust.rotation.y += dt * .08 * idle; dust.rotation.z += dt * .03 * idle;
    // pupila: abre ao ouvir, fecha um pouco ao pensar; "piscada" de luz de vez em quando
    nextBlink -= dt; if (nextBlink < 0) { blink = 1; nextBlink = 3 + Math.random() * 4; }
    blink = Math.max(0, blink - dt * 5);
    const ps = pup * (1 + level * .25);
    pupil.scale.setScalar(ps); halo.scale.setScalar(ps * (1 + level * .15));
    const pulse = gl * (1 + level * .9 + Math.sin(t * 2) * .05) * (1 - blink * .5);
    coreGlow.material.opacity = Math.min(1, .7 * pulse); coreGlow.scale.setScalar(1.15 + level * .5);
    hotGlow.material.opacity = .45 * pulse;
    rings.forEach(r => { r.material.opacity = Math.min(1, r.userData.o ??= r.material.opacity) * Math.min(1.3, pulse); });
    neonGlow.material.opacity = .65 + .3 * pulse; pool.material.opacity = .25 + .25 * pulse;
    key.intensity = 4 + 4 * pulse; aura.material.opacity = .18 + .15 * pulse;
    rim.material.uniforms.uK.value = .8 + level * .25;
    renderer.render(scene, camera);
  }
  frame();
  if (opts.onReady) requestAnimationFrame(() => opts.onReady());

  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    return vs.find(v => /pt[-_]BR/i.test(v.lang) && /female|francisca|luciana|maria|vitoria|thalita/i.test(v.name)) || vs.find(v => /pt[-_]BR/i.test(v.lang));
  }
  return {
    setState(s) { if (MODES[s]) state = s; },
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
    speakAudio(src) {
      const ctx = audioCtx();
      if (!audioEl) { audioEl = new Audio(); audioEl.crossOrigin = 'anonymous'; ctx.createMediaElementSource(audioEl).connect(analyser); }
      ctx.resume(); audioEl.src = src; return audioEl.play();
    },
    async speakBuffer(data) {
      const ctx = audioCtx(); await ctx.resume();
      const audio = await ctx.decodeAudioData(data);
      if (bufSrc) { try { bufSrc.stop(); } catch (e) {} }
      bufSrc = ctx.createBufferSource(); bufSrc.buffer = audio; bufSrc.connect(analyser);
      bufPlaying = true;
      return new Promise(res => { bufSrc.onended = () => { bufPlaying = false; res(); }; bufSrc.start(); });
    },
    unlock() { return audioCtx().resume(); },
    stop() { talkUntil = 0; synthOn = false; if (audioEl) audioEl.pause(); if (bufSrc) { try { bufSrc.stop(); } catch (e) {} bufPlaying = false; } if ('speechSynthesis' in window) speechSynthesis.cancel(); },
    lookAt(x, y) { look.tx = x; look.ty = y; },
  };
}
