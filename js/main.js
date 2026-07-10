/* ScrappyLabs — page logic: core wiring, telemetry HUD, reveals, hum. */
import { initCore } from './core.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rm = window.matchMedia('(prefers-reduced-motion: reduce)');

// ------------------------------------------------------------------ core
let core = null;
try {
  core = initCore($('#core'), { reducedMotion: rm.matches });
} catch {
  $('#core').style.background =
    'radial-gradient(60% 60% at 66% 52%, rgba(255,107,53,.28), rgba(255,80,30,.05) 45%, transparent 70%)';
}
rm.addEventListener('change', () => core && core.setReducedMotion(rm.matches));

// scroll → dolly + progress-driven fades
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    if (core) core.setProgress(p);
    document.documentElement.classList.toggle('scrolled', window.scrollY > 40);
    ticking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ------------------------------------------------------------------ HUD telemetry
// Numbers that read as a live rack: uptime ticks, load jitters, all nominal.
const BUILD_EPOCH = Date.UTC(1993, 0, 1); // "building since '93"
const hUp = $('#t-up'), hLoad = $('#t-load'), hLat = $('#t-lat'), hGpu = $('#t-gpu');
const nf = new Intl.NumberFormat('en-US');
function two(n) { return String(n).padStart(2, '0'); }

function tickHud() {
  if (hUp) {
    const yrs = (Date.now() - BUILD_EPOCH) / (365.25 * 864e5);
    hUp.textContent = yrs.toFixed(7).replace(/(\d)(?=(\d{3})+\.)/g, '$1') + ' yr';
  }
  if (hLoad) {
    const base = 0.28 + 0.10 * Math.sin(Date.now() / 4200);
    hLoad.textContent = base.toFixed(2);
  }
  if (hLat) {
    const ms = 210 + Math.round(60 * Math.abs(Math.sin(Date.now() / 3100)));
    hLat.textContent = ms + ' ms';
  }
  if (hGpu) hGpu.textContent = 'online';
}
tickHud();
let hudTimer = setInterval(tickHud, rm.matches ? 1000 : 250);
document.addEventListener('visibilitychange', () => {
  clearInterval(hudTimer);
  if (!document.hidden) { tickHud(); hudTimer = setInterval(tickHud, rm.matches ? 1000 : 250); }
});

// ------------------------------------------------------------------ reveals
// opacity:0 is scoped to html.reveal-armed, so no-JS / reduced-motion users
// always see content. We only arm when motion is allowed.
if (!rm.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('reveal-armed');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => io.observe(el));
}

// ------------------------------------------------------------------ nav: active section
const secs = $$('main section[id]');
const navLinks = new Map($$('.topnav a[href^="#"]').map((a) => [a.getAttribute('href').slice(1), a]));
if ('IntersectionObserver' in window && secs.length) {
  const sio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        navLinks.forEach((a) => a.removeAttribute('aria-current'));
        const a = navLinks.get(e.target.id);
        if (a) a.setAttribute('aria-current', 'true');
      }
    }
  }, { threshold: 0.4 });
  secs.forEach((s) => sio.observe(s));
}

// ------------------------------------------------------------------ reactor hum
const humBtn = $('#hum-toggle');
const humLabel = $('.hum-label', humBtn);
let audio = null, actx = null, lp = null, fade = null;

function wire() {
  if (actx || !('AudioContext' in window)) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(audio);
    lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.6;
    src.connect(lp); lp.connect(actx.destination);
  } catch { actx = null; lp = null; }
}
function fadeTo(v, then) {
  clearInterval(fade);
  fade = setInterval(() => {
    const d = v - audio.volume;
    if (Math.abs(d) < 0.03) { audio.volume = v; clearInterval(fade); then && then(); }
    else audio.volume = Math.min(1, Math.max(0, audio.volume + Math.sign(d) * 0.03));
  }, 60);
}
humBtn.addEventListener('click', () => {
  const on = humBtn.getAttribute('aria-pressed') !== 'true';
  if (!audio) { audio = new Audio('assets/audio/hum.mp3'); audio.loop = true; audio.preload = 'none'; audio.volume = 0; }
  humBtn.setAttribute('aria-pressed', String(on));
  humLabel.textContent = on ? 'Reactor hum on' : 'Reactor hum';
  if (on) {
    wire();
    if (actx && actx.state === 'suspended') actx.resume();
    audio.play().then(() => fadeTo(0.4)).catch(() => {
      humBtn.setAttribute('aria-pressed', 'false');
      humLabel.textContent = 'Reactor hum';
    });
  } else {
    fadeTo(0, () => audio.pause());
  }
});

// ------------------------------------------------------------------ year
const y = $('#year'); if (y) y.textContent = new Date().getUTCFullYear();
