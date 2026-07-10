/* ScrappyLabs — the compute core.
   A self-contained pseudo-3D reactor: a rotating wireframe icosahedron
   with a hot glowing center and particles on inclined orbits.
   No external deps, no WebGL — plain 2-D canvas so it ships anywhere. */

export function initCore(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('no 2d context');

  const AMBER = '#ff6b35';
  const HOT = '#ffb27a';
  const GREEN = '#5aff9a';

  let reduced = !!opts.reducedMotion;
  let W = 0, H = 0, DPR = 1, CX = 0, CY = 0, R = 1;
  let progress = 0;          // 0 at top of page … 1 at bottom (scroll dolly)
  let px = 0, py = 0;        // pointer parallax, -1..1
  let tx = 0, ty = 0;        // eased pointer
  let raf = 0, t = 0, running = false;

  // ---- icosahedron geometry ---------------------------------------------
  const PHI = (1 + Math.sqrt(5)) / 2;
  const rawV = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  const norm = Math.hypot(1, PHI);
  const V = rawV.map(([x, y, z]) => [x / norm, y / norm, z / norm]);
  // edges = the 30 vertex pairs at minimum distance
  const E = [];
  const edgeLen2 = (() => {
    let m = Infinity;
    for (let i = 0; i < V.length; i++)
      for (let j = i + 1; j < V.length; j++) {
        const d = dist2(V[i], V[j]);
        if (d < m) m = d;
      }
    return m;
  })();
  for (let i = 0; i < V.length; i++)
    for (let j = i + 1; j < V.length; j++)
      if (dist2(V[i], V[j]) < edgeLen2 * 1.1) E.push([i, j]);

  function dist2(a, b) {
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
  }

  // ---- orbiting particles -----------------------------------------------
  const N = reduced ? 34 : 78;
  const parts = [];
  for (let i = 0; i < N; i++) {
    parts.push({
      rad: 1.35 + Math.random() * 1.5,        // orbital radius (in core radii)
      inc: Math.random() * Math.PI,           // inclination of orbital plane
      node: Math.random() * Math.PI * 2,       // longitude of ascending node
      phase: Math.random() * Math.PI * 2,      // position on orbit
      spd: (0.15 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1),
      sz: 0.6 + Math.random() * 1.6,
      hot: Math.random() < 0.18,              // a few burn green (live sparks)
    });
  }

  // ---- rotation ----------------------------------------------------------
  function rot(p, ax, ay) {
    let [x, y, z] = p;
    // around Y
    let c = Math.cos(ay), s = Math.sin(ay);
    let x1 = x * c + z * s, z1 = -x * s + z * c;
    // around X
    c = Math.cos(ax); s = Math.sin(ax);
    let y1 = y * c - z1 * s, z2 = y * s + z1 * c;
    return [x1, y1, z2];
  }

  function project(p) {
    const focal = 3.2;
    const persp = focal / (focal - p[2]);      // weak perspective
    return [CX + p[0] * R * persp, CY + p[1] * R * persp, persp];
  }

  // ---- resize ------------------------------------------------------------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W * 0.5;
    // sit the core a touch right of centre on wide screens, centred on narrow
    if (W > 900) CX = W * 0.66;
    CY = H * 0.52;
    R = Math.min(W, H) * (W > 900 ? 0.22 : 0.28);
  }

  // ---- draw one frame ----------------------------------------------------
  function frame(now) {
    const dolly = 1 - progress * 0.85;         // recede + fade as you scroll
    if (dolly <= 0.02) { ctx.clearRect(0, 0, W, H); if (running) raf = requestAnimationFrame(frame); return; }

    t = now * 0.001;
    tx += (px - tx) * 0.05; ty += (py - ty) * 0.05;
    const ax = t * 0.14 + ty * 0.5;
    const ay = t * 0.19 + tx * 0.6;

    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = dolly;

    // --- hot core glow ---
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    const coreR = R * (0.42 + pulse * 0.06);
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR * 2.6);
    g.addColorStop(0, 'rgba(255,190,140,' + (0.95 * dolly) + ')');
    g.addColorStop(0.18, 'rgba(255,107,53,' + (0.7 * dolly) + ')');
    g.addColorStop(0.5, 'rgba(255,80,30,' + (0.16 * dolly) + ')');
    g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CX, CY, coreR * 2.6, 0, 7); ctx.fill();

    // solid inner core
    const g2 = ctx.createRadialGradient(CX - coreR * 0.2, CY - coreR * 0.2, 0, CX, CY, coreR);
    g2.addColorStop(0, '#fff3ea');
    g2.addColorStop(0.4, HOT);
    g2.addColorStop(1, '#c73a12');
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = dolly;
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(CX, CY, coreR, 0, 7); ctx.fill();

    // --- wireframe cage ---
    const proj = V.map((v) => project(rot(v, ax, ay)));
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    for (const [i, j] of E) {
      const a = proj[i], b = proj[j];
      const depth = (a[2] + b[2]) * 0.5;        // ~0.7..1.5
      const al = clamp((depth - 0.65) * 0.9, 0.05, 0.85) * dolly;
      ctx.strokeStyle = 'rgba(255,140,90,' + al + ')';
      ctx.shadowColor = AMBER; ctx.shadowBlur = 6 * depth;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // vertices
    for (const p of proj) {
      const al = clamp((p[2] - 0.7) * 0.9, 0.1, 0.9) * dolly;
      ctx.fillStyle = 'rgba(255,210,180,' + al + ')';
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * p[2], 0, 7); ctx.fill();
    }

    // --- orbiting particles ---
    for (const o of parts) {
      o.phase += o.spd * 0.016 * (reduced ? 0 : 1);
      // position on a circle in its own orbital plane, then rotate into view
      const ox = Math.cos(o.phase) * o.rad;
      const oz = Math.sin(o.phase) * o.rad;
      // incline: rotate around X by inc, then around Y by node
      let y = -oz * Math.sin(o.inc);
      let z = oz * Math.cos(o.inc);
      let x = ox;
      const cn = Math.cos(o.node), sn = Math.sin(o.node);
      const wx = x * cn + z * sn, wz = -x * sn + z * cn;
      const pr = project(rot([wx, y, wz], ax, ay));
      const al = clamp((pr[2] - 0.55) * 0.8, 0.08, 1) * dolly;
      ctx.fillStyle = o.hot
        ? 'rgba(90,255,154,' + al + ')'
        : 'rgba(255,150,90,' + al + ')';
      ctx.shadowColor = o.hot ? GREEN : AMBER;
      ctx.shadowBlur = 8 * pr[2];
      ctx.beginPath(); ctx.arc(pr[0], pr[1], o.sz * pr[2], 0, 7); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    if (running) raf = requestAnimationFrame(frame);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function start() {
    if (running) return;
    running = true;
    if (reduced) { frame(0); running = false; return; } // one static frame
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // ---- wiring ------------------------------------------------------------
  resize();
  window.addEventListener('resize', () => { resize(); if (reduced) frame(0); });
  window.addEventListener('pointermove', (e) => {
    px = (e.clientX / window.innerWidth - 0.5) * 2;
    py = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (!reduced) start();
  });
  start();

  return {
    setProgress(p) { progress = clamp(p, 0, 1); if (reduced) frame(0); },
    setReducedMotion(r) {
      reduced = r;
      if (r) { stop(); frame(0); } else start();
    },
  };
}
