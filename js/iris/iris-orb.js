/* Iris em orbe: esfera de luz em wireframe com HUD, no lugar do rosto holográfico.
   Canvas 2D puro (sem three.js), pausa fora da tela e respeita "reduzir movimento".
   Mesma interface do iris-holo.js, então o resto do site não muda:
   const iris = createIrisOrb(container); iris.setState('think'); iris.say('Oi!'); iris.speakBuffer(mp3)
   Estados: idle (repouso), listen (ouvindo), think (processando), talk (respondendo) */

const ORANGE = 18; // laranja da marca (#e65516); o resto é branco quente, que contrasta com o fundo verde-azulado da seção

export function createIrisOrb(host, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  host.appendChild(cv);
  const x = cv.getContext('2d');
  let W = 0, H = 0, D = 1;
  function resize() {
    D = Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.5 : 2);
    W = host.clientWidth * D; H = host.clientHeight * D;
    cv.width = W; cv.height = H;
  }
  new ResizeObserver(resize).observe(host); resize();
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);

  const MODES = {
    idle: { sp: .3, a: 0, mix: 0 },
    listen: { sp: .6, a: .08, mix: 0 },
    think: { sp: 2.2, a: .03, mix: 1 },
    talk: { sp: .9, a: .14, mix: .15 },
  };
  let state = 'idle', sp = .3, amp = 0, mix = 0, t = 0, env = 0, glitch = 0, last = performance.now();
  const P = Array.from({ length: 60 }, () => ({ a: Math.random() * 7, r: 1.3 + Math.random() * .9, s: .2 + Math.random() * .8, z: Math.random() }));

  /* ---------- áudio (mesma lógica do rosto: o orbe pulsa com a voz real) ---------- */
  let talkUntil = 0, analyser = null, buf = null, audioEl = null, synthOn = false, actx = null, bufSrc = null, bufPlaying = false;
  function audioCtx() {
    if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); analyser = actx.createAnalyser(); analyser.fftSize = 1024; buf = new Uint8Array(analyser.fftSize); analyser.connect(actx.destination); }
    return actx;
  }
  function voiceLevel() {
    if (analyser && (bufPlaying || (audioEl && !audioEl.paused))) {
      analyser.getByteTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
      return Math.min(1, Math.sqrt(s / buf.length) * 5.5);
    }
    if (synthOn || performance.now() < talkUntil) return .3 + .7 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.3 + 1));
    return -1; // sem voz
  }

  const L = (a, b, k) => a + (b - a) * k;
  const C = (a, l) => `hsla(32,45%,${Math.min(96, l + 22)}%,${Math.min(1, a * 1.35)})`;
  const A = a => `hsla(${ORANGE},90%,58%,${a})`;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !W) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    const g = MODES[state];
    sp = L(sp, g.sp, .05); amp = L(amp, g.a, .08); mix = L(mix, g.mix, .05);
    t += dt * (reduce ? .25 : 1);
    const v = voiceLevel();
    const target = v >= 0 ? v : state === 'listen' ? .4 + .3 * Math.sin(t * 4) : .15;
    env = L(env, target, v > env ? .5 : .2);
    const speaking = v > 0.04 || state === 'talk';

    const cx = W / 2, cy = H * .48, R = Math.min(W, H) * .2;
    x.clearRect(0, 0, W, H);
    x.globalCompositeOperation = 'lighter';

    /* esfera em wireframe girando em 3D */
    const rot = t * sp, tilt = .45;
    const pr = (th, ph) => {
      const X = Math.cos(ph) * Math.cos(th), Y = Math.sin(ph), Z = Math.cos(ph) * Math.sin(th);
      const X2 = X * Math.cos(rot) - Z * Math.sin(rot), Z2 = X * Math.sin(rot) + Z * Math.cos(rot);
      const Y2 = Y * Math.cos(tilt) - Z2 * Math.sin(tilt), Z3 = Y * Math.sin(tilt) + Z2 * Math.cos(tilt);
      const d = 1 + amp * env * Math.sin(th * 6 + t * 5) * Math.cos(ph * 4 - t * 3) * 3;
      return [cx + X2 * R * d, cy + Y2 * R * d, Z3];
    };
    x.lineWidth = D;
    for (let m = 0; m < 12; m++) {
      const th = m / 12 * Math.PI * 2; x.beginPath();
      for (let k = 0; k <= 30; k++) { const p = pr(th, -Math.PI / 2 + k / 30 * Math.PI); k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }
      x.strokeStyle = C(.22, 60); x.stroke();
    }
    for (let n = 1; n < 8; n++) {
      const ph = -Math.PI / 2 + n / 8 * Math.PI; x.beginPath();
      for (let k = 0; k <= 40; k++) { const p = pr(k / 40 * Math.PI * 2, ph); k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }
      x.strokeStyle = C(.18, 60); x.stroke();
    }
    for (let m = 0; m < 12; m++) for (let n = 1; n < 8; n++) {
      const p = pr(m / 12 * Math.PI * 2, -Math.PI / 2 + n / 8 * Math.PI);
      if (p[2] > 0) { x.fillStyle = C(.5 + p[2] * .5, 80); x.fillRect(p[0] - D, p[1] - D, 2 * D, 2 * D); }
    }
    /* núcleo de luz */
    const core = x.createRadialGradient(cx, cy, 0, cx, cy, R * .9);
    core.addColorStop(0, `rgba(255,246,236,${.7 + env * .3})`); core.addColorStop(.22, A(.45 + env * .25)); core.addColorStop(.6, A(.08)); core.addColorStop(1, A(0));
    x.fillStyle = core; x.beginPath(); x.arc(cx, cy, R * .9, 0, 7); x.fill();
    if (mix > .02) {
      const hot = x.createRadialGradient(cx, cy, 0, cx, cy, R * .55);
      hot.addColorStop(0, A(.5 * mix)); hot.addColorStop(1, A(0));
      x.fillStyle = hot; x.beginPath(); x.arc(cx, cy, R * .55, 0, 7); x.fill();
    }

    /* anéis do HUD */
    const seg = (r, n, gap, off, w, col) => {
      x.lineWidth = w; x.strokeStyle = col;
      for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; x.beginPath(); x.arc(cx, cy, r, a, a + Math.PI * 2 / n * (1 - gap)); x.stroke(); }
    };
    seg(R * 1.3, 3, .35, t * sp * .8, D * 2, A(.85));
    seg(R * 1.42, 24, .5, -t * sp * .5, D, C(.4, 70));
    seg(R * 1.62, 2, .6, t * sp * 1.3 + 1, D * 3, A(.55));
    x.strokeStyle = C(.3, 70); x.lineWidth = D;
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2, l = i % 6 ? R * .04 : R * .09;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 1.78, cy + Math.sin(a) * R * 1.78);
      x.lineTo(cx + Math.cos(a) * (R * 1.78 - l), cy + Math.sin(a) * (R * 1.78 - l)); x.stroke();
    }

    /* barras de voz em volta da esfera */
    if (speaking || state === 'listen') {
      const n = 64;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, b = env * (.4 + .6 * Math.abs(Math.sin(i * 1.7 + t * 12))) * (state === 'listen' ? .5 : 1);
        x.strokeStyle = state === 'listen' ? C(.6, 70) : A(.85); x.lineWidth = D * 2;
        x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 1.15, cy + Math.sin(a) * R * 1.15);
        x.lineTo(cx + Math.cos(a) * R * (1.15 + b * .35), cy + Math.sin(a) * R * (1.15 + b * .35)); x.stroke();
      }
    }
    /* ondas saindo quando está ouvindo */
    if (state === 'listen') for (let k = 0; k < 3; k++) {
      const p = (t * .5 + k / 3) % 1; x.strokeStyle = C((1 - p) * .35, 70); x.lineWidth = D * 1.5;
      x.beginPath(); x.arc(cx, cy, R * (1.85 + p * .5), 0, 7); x.stroke();
    }
    /* partículas em órbita */
    for (const p of P) {
      p.a += .004 * p.s * sp * 2;
      const px = cx + Math.cos(p.a) * R * p.r, py = cy + Math.sin(p.a) * R * p.r * .55 * (1 + p.z * .8);
      x.fillStyle = mix > .5 ? A(.6 * p.z + .2) : C(.5 * p.z + .2, 80); x.fillRect(px, py, D * 1.5, D * 1.5);
    }
    if (glitch > 0) { glitch--; x.fillStyle = A(.12); x.fillRect(0, Math.random() * H, W, H * .02); }
  }
  requestAnimationFrame(frame);
  if (opts.onReady) requestAnimationFrame(() => opts.onReady());

  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    return vs.find(v => /pt[-_]BR/i.test(v.lang) && /female|francisca|luciana|maria|vitoria|thalita/i.test(v.name)) || vs.find(v => /pt[-_]BR/i.test(v.lang));
  }

  return {
    setState(s) { if (MODES[s] && s !== state) { state = s; glitch = 6; } },
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
    lookAt() {},
  };
}
