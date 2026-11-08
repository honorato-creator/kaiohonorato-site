/* Globo holográfico da abertura: continentes reais em pontos de luz, rede de conexões entre cidades,
   arcos de dados viajando e ícones de automação orbitando. Gira sozinho, segue o cursor e pode ser arrastado.
   Uso: createGlobe(container) */
import * as THREE from '../iris/three.module.min.js';
import { LAND, COAST, CITIES } from './globe-data.js';

const C = { blue: new THREE.Color('#6C8CFF'), cyan: new THREE.Color('#5FE3F0'), violet: new THREE.Color('#A57CFF'), orange: new THREE.Color('#FF6A26'), white: new THREE.Color('#EAF0FF') };
const R = 1;

function ll(lat, lon, r = R) {
  const p = THREE.MathUtils.degToRad(90 - lat), t = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
}
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
/* ícones desenhados em canvas: engrenagem, chaves de código, banco de dados, seta, play */
function iconTexture(kind, color) {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = color; g.shadowBlur = 16;
  const m = s / 2;
  if (kind === 'gear') {
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 40 : 52; const a2 = (i + 1) / 16 * Math.PI * 2; g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r); g.lineTo(m + Math.cos(a2 - .06) * r, m + Math.sin(a2 - .06) * r); }
    g.closePath(); g.stroke(); g.beginPath(); g.arc(m, m, 18, 0, Math.PI * 2); g.stroke();
  } else if (kind === 'code') {
    g.font = '700 70px ui-monospace,Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('{ }', m, m + 4);
  } else if (kind === 'db') {
    g.beginPath(); g.ellipse(m, 34, 34, 12, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(m - 34, 34); g.lineTo(m - 34, 94); g.ellipse(m, 94, 34, 12, 0, Math.PI, 0, true); g.lineTo(m + 34, 34); g.stroke();
    g.beginPath(); g.ellipse(m, 64, 34, 12, 0, 0, Math.PI); g.stroke();
  } else if (kind === 'arrow') {
    g.beginPath(); g.moveTo(22, 50); g.lineTo(70, 50); g.lineTo(70, 32); g.lineTo(106, 64); g.lineTo(70, 96); g.lineTo(70, 78); g.lineTo(22, 78); g.closePath(); g.stroke();
  } else if (kind === 'play') {
    g.beginPath(); g.roundRect(22, 28, 84, 72, 12); g.stroke(); g.beginPath(); g.moveTo(54, 46); g.lineTo(80, 64); g.lineTo(54, 82); g.closePath(); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createGlobe(host, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 700px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
  camera.position.set(0, 0, 4.6);
  const dot = dotTexture();

  const world = new THREE.Group(); scene.add(world);
  world.rotation.set(.32, -1.0, 0); // começa mostrando o Atlântico e o Brasil

  /* corpo escuro do planeta (fica bonito também sobre fundo claro) */
  const body = new THREE.Mesh(new THREE.SphereGeometry(R * .985, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1. - max(dot(vN, vV), 0.);
        vec3 deep = vec3(.03,.035,.09), mid = vec3(.09,.08,.24);
        vec3 c = mix(deep, mid, pow(f, 1.6)) + vec3(.28,.32,.95)*pow(f, 4.)*.9;
        gl_FragColor = vec4(c, 1.); }`,
  }));
  world.add(body);

  /* atmosfera: brilho suave em volta do planeta (sprite radial, funciona sobre fundo claro) */
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d');
  const grd = gg.createRadialGradient(128, 128, 60, 128, 128, 128);
  grd.addColorStop(0, 'rgba(110,120,255,.55)'); grd.addColorStop(.35, 'rgba(120,110,255,.28)'); grd.addColorStop(.7, 'rgba(255,110,60,.08)'); grd.addColorStop(1, 'rgba(255,110,60,0)');
  gg.fillStyle = grd; gg.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(gc); glowTex.colorSpace = THREE.SRGBColorSpace;
  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
  atmo.scale.setScalar(R * 3.3); atmo.position.z = -.6; scene.add(atmo);

  /* continentes: pontos de terra + contornos mais brilhantes */
  function pointsFrom(arr, r, step = 1) {
    const out = [];
    for (let i = 0; i < arr.length; i += 2 * step) out.push(ll(arr[i] / 10, arr[i + 1] / 10, r));
    return out;
  }
  const landPts = pointsFrom(LAND, R * 1.002, small ? 2 : 1), coastPts = pointsFrom(COAST, R * 1.004, small ? 2 : 1);
  function cloud(pts, color, size, alpha) {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const seed = new Float32Array(pts.length).map(() => Math.random() * 6.28);
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMap: { value: dot }, uColor: { value: color }, uSize: { value: size * renderer.getPixelRatio() }, uAlpha: { value: alpha } },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uSize; varying float vA; varying float vFace;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize((modelMatrix*vec4(position,0.)).xyz);
          vFace = dot(n, normalize(cameraPosition)); vA = .65 + .35*sin(uTime*1.3 + seed*5.);
          gl_PointSize = uSize*(4.2/-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; uniform float uAlpha; varying float vA; varying float vFace;
        void main(){ float side = smoothstep(-.15, .35, vFace); vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor, t.a*uAlpha*vA*(.12 + .88*side)); }`,
    });
    return new THREE.Points(g, m);
  }
  const land = cloud(landPts, C.blue.clone().lerp(C.white, .45), 2.8, .8); world.add(land);
  const coast = cloud(coastPts, C.white, 2.8, 1.0); world.add(coast);

  /* malha externa: uma rede geodésica fina por cima, com nós nos vértices */
  const ico = new THREE.IcosahedronGeometry(R * 1.035, 3);
  const lattice = new THREE.LineSegments(new THREE.EdgesGeometry(ico, 1), new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false }));
  world.add(lattice);
  const icoPos = ico.attributes.position, seen = new Set(), latticeNodes = [];
  for (let i = 0; i < icoPos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(icoPos, i), k = v.toArray().map(n => n.toFixed(3)).join();
    if (!seen.has(k)) { seen.add(k); latticeNodes.push(v); }
  }
  const nodeCloud = cloud(latticeNodes.filter((_, i) => i % 2 === 0), C.violet, 4.2, .7); world.add(nodeCloud);

  /* cidades: nós que pulsam, em laranja (marca) e ciano */
  const cityPos = CITIES.map(([, lat, lon]) => ll(lat, lon, R * 1.01));
  const cityGeo = new THREE.BufferGeometry().setFromPoints(cityPos);
  const cityCol = new Float32Array(cityPos.length * 3), citySeed = new Float32Array(cityPos.length);
  cityPos.forEach((_, i) => { const col = i === 0 ? C.orange : (i % 3 ? C.orange.clone().lerp(C.violet, .35) : C.cyan); col.toArray(cityCol, i * 3); citySeed[i] = Math.random() * 6.28; });
  cityGeo.setAttribute('color', new THREE.BufferAttribute(cityCol, 3)); cityGeo.setAttribute('seed', new THREE.BufferAttribute(citySeed, 1));
  const cityMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMap: { value: dot }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute vec3 color; attribute float seed; uniform float uTime; uniform float uPx; varying vec3 vC; varying float vA; varying float vFace;
      void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize((modelMatrix*vec4(position,0.)).xyz);
        vFace = dot(n, normalize(cameraPosition)); float p = .5 + .5*sin(uTime*2.2 + seed*4.);
        vA = .7 + .3*p; gl_PointSize = (9. + 7.*p)*uPx*(4.2/-mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA; varying float vFace;
      void main(){ float side = smoothstep(-.05, .3, vFace); vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC*1.4, t.a*vA*(.08 + .92*side)); }`,
  });
  world.add(new THREE.Points(cityGeo, cityMat));

  /* rede entre cidades: cada uma ligada às 3 mais próximas, em linhas finas pela superfície */
  const netPts = [];
  const great = (a, b, n = 24, lift = .02) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push(a.clone().lerp(b, t).normalize().multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * lift))); } return out; };
  cityPos.forEach((a, i) => {
    cityPos.map((b, j) => [a.distanceTo(b), j]).filter(([, j]) => j !== i).sort((x, y) => x[0] - y[0]).slice(0, 3).forEach(([, j]) => {
      if (j < i) return; const seg = great(a, cityPos[j]);
      for (let k = 0; k < seg.length - 1; k++) netPts.push(seg[k], seg[k + 1]);
    });
  });
  const net = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(netPts), new THREE.LineBasicMaterial({ color: C.violet.clone().lerp(C.white, .3), transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false }));
  world.add(net);

  /* arcos de dados: sobem da superfície e um pulso de luz viaja por eles */
  const ARCS = small ? 6 : 10, arcs = [];
  const arcMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uHead: { value: 0 }, uColor: { value: C.cyan.clone() }, uFade: { value: 1 } },
    vertexShader: `attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uHead; uniform vec3 uColor; uniform float uFade; varying float vT;
      void main(){ float d = uHead - vT; float trail = d > 0. ? exp(-d*7.) : 0.; float base = .14;
        gl_FragColor = vec4(uColor*(1. + trail*1.5), (base + trail)*uFade); }`,
  });
  function newArc(o, from) {
    const a = from ?? Math.floor(Math.random() * cityPos.length);
    let b = Math.floor(Math.random() * cityPos.length); if (b === a) b = (b + 7) % cityPos.length;
    const pa = cityPos[a], pb = cityPos[b], h = .18 + pa.distanceTo(pb) * .28, n = 60, pts = [], ts = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push(pa.clone().lerp(pb, t).normalize().multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * h))); ts[i] = t; }
    o.line.geometry.dispose(); o.line.geometry = new THREE.BufferGeometry().setFromPoints(pts); o.line.geometry.setAttribute('t', new THREE.BufferAttribute(ts, 1));
    o.line.material.uniforms.uColor.value.copy(Math.random() < .5 ? C.cyan : Math.random() < .5 ? C.orange : C.violet);
    o.t = -Math.random() * .8; o.speed = .35 + Math.random() * .35;
  }
  for (let i = 0; i < ARCS; i++) { const o = { line: new THREE.Line(new THREE.BufferGeometry(), arcMat()) }; world.add(o.line); newArc(o); arcs.push(o); }

  /* ícones orbitando, como na arte: engrenagens, código, banco de dados, setas */
  const iconDefs = [['gear', '#7FA0FF', 1.22, 20, -60, .30], ['gear', '#B07CFF', 1.18, 48, 70, .22], ['gear', '#7FD6FF', 1.24, -18, -30, .26], ['gear', '#9B8CFF', 1.2, -8, 95, .2],
    ['code', '#7FE9F4', 1.12, 8, 10, .16], ['code', '#9FB4FF', 1.14, -30, -75, .14], ['db', '#7FE9F4', 1.13, 10, 55, .15], ['db', '#9FB4FF', 1.13, -40, 20, .13],
    ['arrow', '#C9B8FF', 1.2, 30, -20, .15], ['play', '#FF8A5C', 1.16, 25, 120, .13]];
  const icons = iconDefs.map(([kind, col, r, lat, lon, size]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(kind, col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(ll(lat, lon, R * r)); sp.scale.setScalar(size); sp.userData = { kind, base: sp.position.clone(), seed: Math.random() * 6.28 };
    world.add(sp); return sp;
  });
  if (small) icons.forEach((s, i) => { if (i % 2) s.visible = false; });

  /* anéis orbitais finos */
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(R * 1.32, .0035, 6, 200), new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
  ringA.rotation.set(1.25, .2, 0); scene.add(ringA);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(R * 1.42, .0025, 6, 200, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
  ringB.rotation.set(1.4, -.35, .4); scene.add(ringB);

  /* ---------- interação ---------- */
  let dragging = false, lastX = 0, lastY = 0, velY = .0, velX = 0, hover = { x: 0, y: 0 }, tilt = { x: 0, y: 0 }, burst = 0;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
  el.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; el.style.cursor = 'grabbing'; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(); hover.x = ((e.clientX - r.left) / r.width - .5) * 2; hover.y = ((e.clientY - r.top) / r.height - .5) * 2;
    if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    velY = dx * .005; velX = dy * .003; world.rotation.y += velY; world.rotation.x = THREE.MathUtils.clamp(world.rotation.x + velX, -.9, .9);
  });
  const end = e => { if (!dragging) return; dragging = false; el.style.cursor = 'grab'; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', () => { hover.x = hover.y = 0; });
  el.addEventListener('click', () => { burst = 1; arcs.forEach(o => { newArc(o, 0); o.t = -Math.random() * .25; }); }); // clique: Santos dispara dados para o mundo

  function resize() { const w = host.clientWidth, h = host.clientHeight || w; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();
  let visible = true; new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);

  const clock = new THREE.Clock();
  const mats = [land.material, coast.material, nodeCloud.material, cityMat];
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    if (!reduce) {
      if (!dragging) { velY += (.0016 - velY) * .03; world.rotation.y += velY * (dt * 60); velX *= .92; }
      tilt.x += (hover.y * .12 - tilt.x) * .05; tilt.y += (hover.x * .18 - tilt.y) * .05;
      scene.rotation.x = tilt.x; scene.rotation.y = tilt.y;
      ringA.rotation.z += dt * .12; ringB.rotation.z -= dt * .2;
      arcs.forEach(o => { o.t += dt * o.speed * (1 + burst * 1.5); const u = o.line.material.uniforms; u.uHead.value = o.t; u.uFade.value = o.t < 0 ? 0 : o.t > 1.3 ? Math.max(0, 1 - (o.t - 1.3) * 3) : 1; if (o.t > 1.65) newArc(o); });
      icons.forEach(s => { const d = s.userData; s.position.copy(d.base).multiplyScalar(1 + Math.sin(t * .8 + d.seed) * .015); if (d.kind === 'gear') s.material.rotation += dt * .6; });
      burst = Math.max(0, burst - dt * .6);
    }
    mats.forEach(m => { m.uniforms.uTime.value = t; });
    renderer.render(scene, camera);
  }
  frame();
  return { burst() { el.click(); } };
}
