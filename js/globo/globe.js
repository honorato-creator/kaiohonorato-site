/* Globo holográfico da abertura.
   Conta a história do Kaio: de Santos para o Brasil (e para fora). Cada arco de dados sai de Santos,
   viaja até uma cidade e, ao chegar, mostra o que foi entregue (site, automação, agente de IA...).
   Continentes reais em pontos de luz, lado dia e lado noite, ícones de automação orbitando.
   Gira sozinho, inclina com o cursor, pode ser arrastado; clicar dispara uma rodada de entregas.
   Uso: createGlobe(container, { onInteract }) */
import * as THREE from '../iris/three.module.min.js';
import { LAND, COAST, CITIES, BR } from './globe-data.js';

const C = {
  orange: new THREE.Color('#FF6A26'), ember: new THREE.Color('#FFB27A'), cyan: new THREE.Color('#5FE3F0'),
  blue: new THREE.Color('#7C96FF'), violet: new THREE.Color('#9C86FF'), white: new THREE.Color('#EEF2FF'),
};
const SERVICOS = ['site', 'automação', 'agente de IA', 'app', 'landing page', 'atendimento 24h'];
const R = 1;
const SUN = new THREE.Vector3(-.75, .45, .55).normalize(); // luz vinda de cima à esquerda (espaço da câmera)

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
/* ícones com contorno escuro por baixo: legíveis tanto sobre o planeta quanto sobre o fundo claro do site */
function iconTexture(kind, color) {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'), m = s / 2;
  const path = () => {
    g.beginPath();
    if (kind === 'gear') {
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 38 : 50, a2 = (i + 1) / 16 * Math.PI * 2; g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r); g.lineTo(m + Math.cos(a2 - .06) * r, m + Math.sin(a2 - .06) * r); }
      g.closePath(); g.moveTo(m + 17, m); g.arc(m, m, 17, 0, Math.PI * 2);
    } else if (kind === 'db') {
      g.ellipse(m, 36, 32, 11, 0, 0, Math.PI * 2); g.moveTo(m - 32, 36); g.lineTo(m - 32, 92); g.ellipse(m, 92, 32, 11, 0, Math.PI, 0, true); g.lineTo(m + 32, 36);
      g.moveTo(m + 32, 64); g.ellipse(m, 64, 32, 11, 0, 0, Math.PI);
    } else if (kind === 'arrow') {
      g.moveTo(24, 52); g.lineTo(70, 52); g.lineTo(70, 34); g.lineTo(104, 64); g.lineTo(70, 94); g.lineTo(70, 76); g.lineTo(24, 76); g.closePath();
    } else if (kind === 'chat') {
      g.roundRect(22, 28, 84, 58, 14); g.moveTo(44, 86); g.lineTo(38, 104); g.lineTo(60, 86);
    }
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'code') {
    g.font = '800 66px ui-monospace,Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = 'rgba(14,16,40,.85)'; g.strokeText('{ }', m, m + 4);
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 12; g.fillText('{ }', m, m + 4);
  } else {
    path(); g.lineWidth = 14; g.strokeStyle = 'rgba(14,16,40,.85)'; g.stroke();
    path(); g.lineWidth = 6; g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = 12; g.stroke();
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
  const sunU = { value: SUN };

  const world = new THREE.Group(); scene.add(world);
  world.rotation.set(-.32, -.78, 0); // Brasil de frente

  /* corpo do planeta: lado dia azulado, lado noite quase preto, borda com brilho */
  const body = new THREE.Mesh(new THREE.SphereGeometry(R * .985, 72, 54), new THREE.ShaderMaterial({
    uniforms: { uSun: sunU },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1. - max(dot(vN, vV), 0.); float day = smoothstep(-.25, .55, dot(vN, uSun));
        vec3 night = vec3(.018,.02,.05), dayc = vec3(.07,.085,.22);
        vec3 c = mix(night, dayc, day) + vec3(.35,.42,1.)*pow(f, 3.5)*(.35 + .65*day) + vec3(1.,.45,.2)*pow(f, 5.)*(1. - day)*.35;
        gl_FragColor = vec4(c, 1.); }`,
  }));
  world.add(body);

  /* brilho em volta (sprite radial; funciona sobre o fundo claro do site) */
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d');
  const grd = gg.createRadialGradient(128, 128, 62, 128, 128, 128);
  grd.addColorStop(0, 'rgba(110,125,255,.5)'); grd.addColorStop(.35, 'rgba(125,115,255,.22)'); grd.addColorStop(.7, 'rgba(255,110,50,.07)'); grd.addColorStop(1, 'rgba(255,110,50,0)');
  gg.fillStyle = grd; gg.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(gc); glowTex.colorSpace = THREE.SRGBColorSpace;
  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
  atmo.scale.setScalar(R * 3.3); atmo.position.z = -.6; scene.add(atmo);

  /* pontos com dia e noite: no lado dia brilham azul-claro; no lado noite ficam fracos */
  function cloud(pts, dayCol, nightCol, size, alpha) {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(pts.length).map(() => Math.random() * 6.28), 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMap: { value: dot }, uDay: { value: dayCol }, uNight: { value: nightCol }, uSize: { value: size * renderer.getPixelRatio() }, uAlpha: { value: alpha }, uSun: sunU },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uSize; uniform vec3 uSun; varying float vA; varying float vFace; varying float vDay;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize(normalMatrix*position);
          vFace = n.z; vDay = smoothstep(-.2, .45, dot(n, uSun)); vA = .7 + .3*sin(uTime*1.3 + seed*5.);
          gl_PointSize = uSize*(4.6/-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uDay; uniform vec3 uNight; uniform float uAlpha; varying float vA; varying float vFace; varying float vDay;
        void main(){ float side = smoothstep(-.1, .3, vFace); vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(mix(uNight, uDay, vDay), t.a*uAlpha*vA*(.1 + .9*side)*(.35 + .65*vDay)); }`,
    });
    return new THREE.Points(g, m);
  }
  const toPts = (arr, r, step) => { const out = []; for (let i = 0; i < arr.length; i += 2 * step) out.push(ll(arr[i] / 10, arr[i + 1] / 10, r)); return out; };
  const land = cloud(toPts(LAND, R * 1.002, small ? 2 : 1), C.blue.clone().lerp(C.white, .45), C.violet.clone().multiplyScalar(.6), 2.6, .75); world.add(land);
  const coast = cloud(toPts(COAST, R * 1.004, small ? 2 : 1), C.white, C.blue, 2.4, .95); world.add(coast);

  /* malha geodésica bem sutil */
  const lattice = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R * 1.03, 3), 1),
    new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false }));
  world.add(lattice);

  /* cidades: Santos maior; Brasil em laranja; exterior em âmbar; no lado noite as luzes acendem mais */
  const cityPos = CITIES.map(([, lat, lon]) => ll(lat, lon, R * 1.01));
  const cityGeo = new THREE.BufferGeometry().setFromPoints(cityPos);
  const cityCol = new Float32Array(cityPos.length * 3), citySeed = new Float32Array(cityPos.length), citySize = new Float32Array(cityPos.length), cityHit = new Float32Array(cityPos.length);
  cityPos.forEach((_, i) => { (i < BR ? C.orange : C.ember).toArray(cityCol, i * 3); citySeed[i] = Math.random() * 6.28; citySize[i] = i === 0 ? 2.1 : i < BR ? 1 : .8; });
  cityGeo.setAttribute('color', new THREE.BufferAttribute(cityCol, 3)); cityGeo.setAttribute('seed', new THREE.BufferAttribute(citySeed, 1));
  cityGeo.setAttribute('size', new THREE.BufferAttribute(citySize, 1)); cityGeo.setAttribute('hit', new THREE.BufferAttribute(cityHit, 1));
  const cityMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMap: { value: dot }, uPx: { value: renderer.getPixelRatio() }, uSun: sunU },
    vertexShader: `attribute vec3 color; attribute float seed; attribute float size; attribute float hit; uniform float uTime; uniform float uPx; uniform vec3 uSun; varying vec3 vC; varying float vA; varying float vFace;
      void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize(normalMatrix*position);
        vFace = n.z; float night = 1. - smoothstep(-.2, .45, dot(n, uSun)); float p = .5 + .5*sin(uTime*2.2 + seed*4.);
        vA = (.55 + .25*p + .35*night)*(1. + hit*1.5);
        gl_PointSize = (8. + 6.*p + hit*16.)*size*uPx*(4.6/-mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA; varying float vFace;
      void main(){ float side = smoothstep(-.05, .3, vFace); vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC*1.3, t.a*vA*(.06 + .94*side)); }`,
  });
  world.add(new THREE.Points(cityGeo, cityMat));

  /* rede: cidades ligadas às vizinhas, em linhas finas pela superfície */
  const surf = (a, b, n = 20, lift = .015) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push(a.clone().lerp(b, t).normalize().multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * lift))); } return out; };
  const netPts = [];
  cityPos.forEach((a, i) => {
    cityPos.map((b, j) => [a.distanceTo(b), j]).filter(([, j]) => j !== i).sort((x, y) => x[0] - y[0]).slice(0, i < BR ? 3 : 2).forEach(([, j]) => {
      if (j < i) return; const seg = surf(a, cityPos[j]); for (let k = 0; k < seg.length - 1; k++) netPts.push(seg[k], seg[k + 1]);
    });
  });
  world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(netPts), new THREE.LineBasicMaterial({ color: C.violet.clone().lerp(C.white, .25), transparent: true, opacity: .26, blending: THREE.AdditiveBlending, depthWrite: false })));

  /* arcos de entrega: saem de Santos e, ao chegar, a cidade acende e aparece o rótulo do serviço */
  const labels = document.createElement('div'); labels.className = 'globe-labels'; host.appendChild(labels);
  const ARCS = small ? 4 : 7, arcs = [];
  const arcMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uHead: { value: 0 }, uColor: { value: C.orange.clone() }, uFade: { value: 1 } },
    vertexShader: `attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uHead; uniform vec3 uColor; uniform float uFade; varying float vT;
      void main(){ float d = uHead - vT; float trail = d > 0. ? exp(-d*6.) : 0.; float done = step(vT, uHead);
        gl_FragColor = vec4(uColor*(1. + trail*1.6), (.05 + .12*done + trail)*uFade); }`,
  });
  let pickIdx = 0;
  function nextTarget() {
    // 3 em cada 4 entregas vão para o Brasil
    if (Math.random() < .75) return 1 + Math.floor(Math.random() * (BR - 1));
    return BR + Math.floor(Math.random() * (cityPos.length - BR));
  }
  function launch(o, delay = Math.random() * 1.2) {
    const b = nextTarget(), pa = cityPos[0], pb = cityPos[b], d = pa.distanceTo(pb), h = .06 + d * .32, n = 64, pts = [], ts = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push(pa.clone().lerp(pb, t).normalize().multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * h))); ts[i] = t; }
    o.line.geometry.dispose(); o.line.geometry = new THREE.BufferGeometry().setFromPoints(pts); o.line.geometry.setAttribute('t', new THREE.BufferAttribute(ts, 1));
    o.line.material.uniforms.uColor.value.copy(b < BR ? C.orange : C.cyan);
    o.to = b; o.t = -delay; o.speed = .32 + Math.random() * .2 + (d < .3 ? .25 : 0); o.arrived = false;
    o.servico = SERVICOS[(pickIdx++) % SERVICOS.length];
  }
  for (let i = 0; i < ARCS; i++) { const o = { line: new THREE.Line(new THREE.BufferGeometry(), arcMat()) }; world.add(o.line); launch(o, i * .55); arcs.push(o); }

  const live = []; // rótulos ativos
  const v3 = new THREE.Vector3(), nrm = new THREE.Vector3(), toCam = new THREE.Vector3();
  function showLabel(cityIdx, text) {
    if (live.length >= 3) return;
    const el = document.createElement('span'); el.className = 'globe-label';
    el.innerHTML = '<i></i><b></b><small></small>';
    el.querySelector('b').textContent = text; el.querySelector('small').textContent = CITIES[cityIdx][0];
    labels.appendChild(el); live.push({ el, city: cityIdx, age: 0 });
    cityHit[cityIdx] = 1; cityGeo.attributes.hit.needsUpdate = true;
  }
  function placeLabels(dt) {
    const cr = renderer.domElement.getBoundingClientRect(), hr = host.getBoundingClientRect();
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i]; L.age += dt;
      v3.copy(cityPos[L.city]).applyMatrix4(world.matrixWorld);
      nrm.copy(v3).normalize(); toCam.copy(camera.position).sub(v3).normalize();
      const facing = nrm.dot(toCam);
      v3.project(camera);
      const x = (v3.x * .5 + .5) * cr.width + cr.left - hr.left, y = (-v3.y * .5 + .5) * cr.height + cr.top - hr.top;
      const op = Math.min(1, L.age * 4) * Math.max(0, Math.min(1, (2.6 - L.age) * 2)) * (facing > .15 ? 1 : 0);
      L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; L.el.style.opacity = op.toFixed(2);
      L.el.classList.toggle('flip', x > hr.width * .55); // do lado direito, a etiqueta abre para a esquerda
      if (L.age > 2.7) { L.el.remove(); live.splice(i, 1); }
    }
    let dirty = false;
    for (let i = 1; i < cityHit.length; i++) if (cityHit[i] > 0) { cityHit[i] = Math.max(0, cityHit[i] - dt * .8); dirty = true; }
    if (dirty) cityGeo.attributes.hit.needsUpdate = true;
  }

  /* ícones orbitando */
  const iconDefs = [['gear', '#FF8A4C', 1.2, 2, -70, .26], ['gear', '#9C86FF', 1.18, 40, -20, .2], ['gear', '#7FD6FF', 1.22, -45, -5, .22],
    ['code', '#7FE9F4', 1.14, 12, -88, .15], ['db', '#FFB27A', 1.14, -32, -78, .14], ['chat', '#FF8A4C', 1.16, -8, -20, .15], ['arrow', '#B9A8FF', 1.18, 25, -45, .14]];
  const icons = iconDefs.map(([kind, col, r, lat, lon, size]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(kind, col), transparent: true, depthWrite: false }));
    sp.position.copy(ll(lat, lon, R * r)); sp.scale.setScalar(size); sp.userData = { kind, base: sp.position.clone(), seed: Math.random() * 6.28 };
    world.add(sp); return sp;
  });
  if (small) icons.forEach((s, i) => { if (i > 3) s.visible = false; });

  /* anéis orbitais */
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(R * 1.32, .0035, 6, 200), new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false }));
  ringA.rotation.set(1.25, .2, 0); scene.add(ringA);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(R * 1.42, .003, 6, 200, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: .55, depthWrite: false }));
  ringB.rotation.set(1.4, -.35, .4); scene.add(ringB);

  /* ---------- interação ---------- */
  let dragging = false, moved = 0, lastX = 0, lastY = 0, velY = 0, hover = { x: 0, y: 0 }, tilt = { x: 0, y: 0 }, touched = false;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
  const firstTouch = () => { if (!touched) { touched = true; opts.onInteract && opts.onInteract(); } };
  el.addEventListener('pointerdown', e => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; el.style.cursor = 'grabbing'; el.setPointerCapture(e.pointerId); firstTouch(); });
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(); hover.x = ((e.clientX - r.left) / r.width - .5) * 2; hover.y = ((e.clientY - r.top) / r.height - .5) * 2;
    if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    velY = dx * .005; world.rotation.y += velY; world.rotation.x = THREE.MathUtils.clamp(world.rotation.x + dy * .003, -.9, .6);
  });
  const end = () => { if (!dragging) return; dragging = false; el.style.cursor = 'grab'; if (moved < 6) arcs.forEach((o, i) => launch(o, i * .12)); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', () => { hover.x = hover.y = 0; });

  function resize() { const cw = el.clientWidth || host.clientWidth, ch = el.clientHeight || cw; renderer.setSize(cw, ch, false); camera.aspect = cw / ch; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();
  let visible = true; new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);

  const clock = new THREE.Clock();
  const mats = [land.material, coast.material, cityMat];
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    if (!reduce) {
      if (!dragging) { velY += (.0013 - velY) * .03; world.rotation.y += velY * (dt * 60); }
      tilt.x += (hover.y * .12 - tilt.x) * .05; tilt.y += (hover.x * .18 - tilt.y) * .05;
      scene.rotation.x = tilt.x; scene.rotation.y = tilt.y;
      ringA.rotation.z += dt * .12; ringB.rotation.z -= dt * .2;
      arcs.forEach(o => {
        o.t += dt * o.speed; const u = o.line.material.uniforms; u.uHead.value = o.t;
        u.uFade.value = o.t < 0 ? 0 : o.t > 1.2 ? Math.max(0, 1 - (o.t - 1.2) * 2.5) : 1;
        if (!o.arrived && o.t >= 1) { o.arrived = true; showLabel(o.to, o.servico); }
        if (o.t > 1.65) launch(o);
      });
      icons.forEach(s => { const d = s.userData; s.position.copy(d.base).multiplyScalar(1 + Math.sin(t * .8 + d.seed) * .015); if (d.kind === 'gear') s.material.rotation += dt * .6; });
    }
    mats.forEach(m => { m.uniforms.uTime.value = t; });
    renderer.render(scene, camera);
    placeLabels(dt);
  }
  frame();
  return {};
}
