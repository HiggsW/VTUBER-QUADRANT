/* Quiet, deterministic star chart. Also paints a still frame for PNG exports. */
(() => {
  'use strict';

  const root = document.documentElement;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = media.matches;
  const storageKey = 'cluckworks-sky-paused-v1';
  let paused = false;
  try { paused = localStorage.getItem(storageKey) === 'true'; } catch {}

  function palette(element = document.getElementById('board') || root) {
    const css = getComputedStyle(element);
    return Object.fromEntries(['base', 'haze', 'dust', 'clear', 'ring', 'star', 'trail'].map(name =>
      [name, css.getPropertyValue('--sky-' + name).trim()]));
  }

  // Stable coordinates avoid a jump whenever the window or export size changes.
  let seed = 4729;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stars = Array.from({ length: 116 }, () => ({
    x: random(), y: random(), radius: .35 + random() * .8,
    phase: random() * Math.PI * 2, depth: .3 + random() * .7
  }));

  function paint(ctx, width, height, seconds = 0, colors = palette()) {
    ctx.save();
    ctx.fillStyle = colors.base;
    ctx.fillRect(0, 0, width, height);

    const size = Math.max(width, height);
    const haze = ctx.createRadialGradient(width * .58, height * .4, 0, width * .5, height * .5, size * .78);
    haze.addColorStop(0, colors.haze);
    haze.addColorStop(.5, colors.dust);
    haze.addColorStop(1, colors.clear);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    // Light orbit tracks stay quiet; moving arc segments make the flow perceptible.
    ctx.save();
    ctx.translate(width * .5, height * .5);
    ctx.rotate(-.38 + seconds * .003);
    ctx.strokeStyle = colors.ring;
    ctx.lineWidth = .65;
    const radius = Math.min(width, height) * .36;
    const scales = [.58, 1, 1.5, 2.15, 2.9];
    for (let i = 0; i < scales.length; i++) {
      const scale = scales[i];
      const rx = radius * scale * 1.65;
      const ry = radius * scale * .71;
      ctx.strokeStyle = colors.ring;
      ctx.lineWidth = .65;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      const angle = i * 1.3 + seconds * (.045 - i * .004);
      ctx.strokeStyle = colors.trail;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, angle - .36, angle);
      ctx.stroke();
      ctx.fillStyle = colors.star;
      ctx.globalAlpha = .55;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * rx, Math.sin(angle) * ry, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    const count = width < 500 ? 72 : stars.length;
    ctx.fillStyle = colors.star;
    for (let i = 0; i < count; i++) {
      const star = stars[i];
      const drift = seconds * .025 * star.depth;
      const x = (star.x * width + seconds * (.35 + star.depth * .4)) % width;
      const y = star.y * height + Math.cos(star.phase + drift) * 6;
      ctx.globalAlpha = .12 + star.depth * .16;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  window.QuadrantSky = { paint, palette };

  const canvas = document.getElementById('skyCanvas');
  const button = document.getElementById('skyMotion');
  if (!canvas || !button) return;
  button.hidden = false;
  const context = canvas.getContext('2d');
  if (!context) { button.hidden = true; return; }
  const board = canvas.parentElement;
  const themeButton = document.getElementById('skyTheme');
  const themeKey = 'cluckworks-sky-theme-v1';
  let theme = 'light';
  try { if (localStorage.getItem(themeKey) === 'dark') theme = 'dark'; } catch {}
  board.dataset.skyTheme = theme;
  let colors = palette(board);
  let width = 0, height = 0, elapsed = 0, previous = null, request = 0;
  let inView = true;

  function draw() { paint(context, width, height, elapsed, colors); }
  function applyTheme() {
    board.dataset.skyTheme = theme;
    colors = palette(board);
    if (themeButton) {
      themeButton.hidden = false;
      themeButton.textContent = theme === 'dark' ? '白底星流' : '黑底星流';
      themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
      themeButton.title = '切换象限背景，不影响主播位置和评分';
    }
    draw();
  }
  function enabled() { return !paused && !reducedMotion && !document.hidden && inView; }
  function frame(now) {
    request = 0;
    if (!enabled()) { previous = null; return; }
    if (previous === null) previous = now;
    if (now - previous >= 40) {
      elapsed += Math.min(now - previous, 100) / 1000;
      previous = now;
      draw();
    }
    request = requestAnimationFrame(frame);
  }

  function sync() {
    cancelAnimationFrame(request);
    previous = null;
    button.disabled = reducedMotion;
    button.setAttribute('aria-pressed', String(!paused && !reducedMotion));
    button.textContent = reducedMotion ? '静态星空' : paused ? '播放星流' : '暂停星流';
    button.title = reducedMotion ? '已遵循系统的减少动态效果设置' : '控制背景动态，不影响画布编辑';
    board.dataset.skyMotion = paused || reducedMotion ? 'paused' : 'playing';
    if (enabled()) request = requestAnimationFrame(frame);
    draw();
  }

  const resize = new ResizeObserver(() => {
    width = board.clientWidth;
    height = board.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  });
  resize.observe(board);
  const visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); });
  visibility.observe(board);
  button.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem(storageKey, String(paused)); } catch {}
    sync();
  });
  themeButton?.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(themeKey, theme); } catch {}
    applyTheme();
  });
  media.addEventListener('change', event => { reducedMotion = event.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  applyTheme();
  sync();
})();
