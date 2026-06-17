/*!
 * ignis.js — burn-away effect for any DOM/SVG element. No dependencies.
 * Ignis.burn(element, { dir: 'up'|'down'|'left'|'right'|[dx,dy], duration, char, onDone })
 * Ignis.spark(x, y, dir) — spawn subtle particle + trail at screen position
 */
(function () {
  "use strict";
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var canvas = null, ctx = null, dpr = 1, running = false;
  var particles = [], burns = [], last = 0, TRACE_LIFE = 0.3;
  var sparkTrail = []; // shared trail for spark() calls
  var clipRect = null; // {x, y, w, h} in screen coords — restrict rendering

  function initCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483646;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
  }
  function sizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawnSpark(x, y, dir) {
    var warm = Math.random() < 0.22;
    if (!warm) {
      var back = 24 + Math.random() * 44, smoke = Math.random() < 0.5;
      particles.push({ x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: -dir[0] * back + (Math.random() - 0.5) * 20, vy: -dir[1] * back + (Math.random() - 0.5) * 20 - 8,
        g: 30, life: 0.5 + Math.random() * 0.5, max: 1, size: 0.8 + Math.random() * 1.2,
        col: smoke ? [46, 43, 58] : [28, 26, 40] });
    } else {
      var b2 = 26 + Math.random() * 40;
      particles.push({ x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: -dir[0] * b2 + (Math.random() - 0.5) * 18, vy: -dir[1] * b2 + (Math.random() - 0.5) * 18 - 8,
        g: 34, life: 0.34 + Math.random() * 0.32, max: 1, size: 0.6 + Math.random() * 0.9, col: [232, 158, 92] });
    }
    var p = particles[particles.length - 1]; p.max = p.life;
  }
  function burn(el, opts) {
    if (!el || el.__ignisBurning) return;
    opts = opts || {};
    initCanvas();
    var dir = opts.dir;
    if (typeof dir === "string") dir = DIRS[dir] || [0, -1];
    if (!dir) dir = [0, -1];
    var mag = Math.hypot(dir[0], dir[1]) || 1; dir = [dir[0] / mag, dir[1] / mag];
    el.__ignisBurning = true;
    burns.push({ el: el, dir: dir, t0: performance.now(), dur: opts.duration || 640,
      char: opts.char !== false,
      onDone: opts.onDone || function () { el.style.visibility = "hidden"; },
      origTransform: el.style.transform || "", origFilter: el.style.filter || "",
      trail: [], done: false,
      exit: (Math.abs(dir[0]) > Math.abs(dir[1]) ? window.innerWidth : window.innerHeight) * 1.35 });
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }
  /** spark — spawn 1 particle at screen (x,y) + add trail point. No element control. */
  function spark(x, y, dir) {
    initCanvas();
    if (typeof dir === "string") dir = DIRS[dir] || [0, -1];
    if (!dir) dir = [0, -1];
    // Trail point (dark fading line)
    sparkTrail.push({ x: x, y: y, age: 0 });
    // Spawn particle only every ~3rd call (reduce circle count)
    if (Math.random() < 0.33) {
      spawnSpark(x, y, dir);
    }
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }
  /** clearTrail — reset spark trail (call when extraction ends) */
  function clearTrail() {
    sparkTrail = [];
  }
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (var i = burns.length - 1; i >= 0; i--) {
      var b = burns[i], f = (now - b.t0) / b.dur;
      if (!b.done) {
        if (f >= 1) { b.el.style.opacity = "0"; b.done = true; try { b.onDone(b.el); } catch (e) {} }
        else {
          var eased = f * f, ox = b.dir[0] * b.exit * eased, oy = b.dir[1] * b.exit * eased;
          b.el.style.transform = b.origTransform + " translate(" + ox + "px," + oy + "px)";
          if (b.char) {
            var heat = Math.max(0, Math.min(1, (f - 0.05) / 0.55));
            b.el.style.filter = b.origFilter + " brightness(" + (1 - 0.62 * heat).toFixed(3) +
              ") drop-shadow(0 0 " + (2 + 3 * heat).toFixed(1) + "px rgba(40,36,52," + (0.4 * heat).toFixed(2) + "))";
          }
          b.el.style.opacity = f > 0.62 ? String(1 - (f - 0.62) / 0.38) : "1";
          var r = b.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          b.trail.push({ x: cx, y: cy, age: 0 });
          for (var k = 0; k < 3; k++) spawnSpark(r.left + Math.random() * r.width, r.top + Math.random() * r.height, b.dir);
        }
      }
      for (var tp = b.trail.length - 1; tp >= 0; tp--) { b.trail[tp].age += dt; if (b.trail[tp].age > TRACE_LIFE) b.trail.splice(tp, 1); }
      if (b.done && b.trail.length === 0) { b.el.__ignisBurning = false; burns.splice(i, 1); }
    }
    // Age spark trail points
    for (var sp = sparkTrail.length - 1; sp >= 0; sp--) {
      sparkTrail[sp].age += dt;
      if (sparkTrail[sp].age > TRACE_LIFE) sparkTrail.splice(sp, 1);
    }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // Apply clip rect if set (restrict effects to board area)
    if (clipRect) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
      ctx.clip();
    }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // Draw burn trails
    for (var bi = 0; bi < burns.length; bi++) {
      var tr = burns[bi].trail;
      for (var tk = 1; tk < tr.length; tk++) {
        var p0 = tr[tk - 1], p1 = tr[tk], af = 1 - p1.age / TRACE_LIFE;
        if (af <= 0) continue;
        ctx.strokeStyle = "rgba(44,41,56," + (0.13 * af).toFixed(3) + ")";
        ctx.lineWidth = 1 + 3.2 * af;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    }
    // Draw spark trail (dark fading line)
    for (var sk = 1; sk < sparkTrail.length; sk++) {
      var s0 = sparkTrail[sk - 1], s1 = sparkTrail[sk], sf = 1 - s1.age / TRACE_LIFE;
      if (sf <= 0) continue;
      ctx.strokeStyle = "rgba(36,33,48," + (0.12 * sf).toFixed(3) + ")";
      ctx.lineWidth = 1 + 1.5 * sf;
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
    }
    // Draw particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var s = particles[p]; s.life -= dt;
      if (s.life <= 0) { particles.splice(p, 1); continue; }
      s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      var lt = s.life / s.max, a = Math.min(1, lt * 1.1) * 0.34, rad = s.size * (1.5 + lt * 0.7);
      var grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad), cs = s.col[0] + "," + s.col[1] + "," + s.col[2];
      grd.addColorStop(0, "rgba(" + cs + "," + a.toFixed(3) + ")");
      grd.addColorStop(0.5, "rgba(" + cs + "," + (a * 0.4).toFixed(3) + ")");
      grd.addColorStop(1, "rgba(" + cs + ",0)");
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, 6.283); ctx.fill();
    }
    if (clipRect) ctx.restore();
    if (burns.length === 0 && particles.length === 0 && sparkTrail.length === 0) {
      running = false; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); return;
    }
    requestAnimationFrame(loop);
  }
  /** setClip — restrict rendering to a screen rect {x, y, w, h} */
  function setClip(rect) { clipRect = rect || null; }
  window.Ignis = { burn: burn, spark: spark, clearTrail: clearTrail, setClip: setClip };
})();
