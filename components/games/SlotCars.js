'use client';

import { useRef, useEffect } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { COLORS, drawBox, drawText, drawHint, drawCountdown } from '@/lib/gameRenderer';

const LAPS = 3;
const CRASH_DURATION = 70;
const MAX_SPEED = 1.0;
const ACCEL_RATE = 0.022;
const DECEL = 0.988;       // friction ONLY when player releases
const LANE_GAP = 7;

/* ═══════ Catmull-Rom Spline ═══════ */
function crPt(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: .5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: .5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
  };
}
function buildSpline(wps, segs = 28) {
  const pts = [], n = wps.length;
  for (let i = 0; i < n; i++) {
    const p0 = wps[(i-1+n)%n], p1 = wps[i], p2 = wps[(i+1)%n], p3 = wps[(i+2)%n];
    for (let j = 0; j < segs; j++) pts.push(crPt(p0, p1, p2, p3, j / segs));
  }
  return pts;
}

/* ═══════ Track Definitions ═══════ */
function getWaypoints(w, h, type) {
  const m = 55, W = w - 2*m, H = h - 2*m;
  const p = (fx, fy) => ({ x: m + W*fx, y: m + H*fy });
  switch (type) {
    case 0: return [ // Wide Oval — clean racing oval
      p(.08,.35), p(.08,.15), p(.22,.06), p(.5,.06), p(.78,.06), p(.92,.15),
      p(.92,.35), p(.92,.65), p(.92,.85), p(.78,.94), p(.5,.94), p(.22,.94),
      p(.08,.85), p(.08,.65),
    ];
    case 1: return [ // S-Circuit — serpentine with long straights (ref image 1)
      p(.8,.9), p(.8,.55), p(.8,.2),           // long right straight up
      p(.68,.06), p(.52,.1),                     // top curve going left
      p(.4,.25), p(.28,.1),                      // S-bend
      p(.12,.18), p(.08,.4), p(.08,.7),          // left straight down
      p(.18,.9), p(.42,.85), p(.6,.92),          // bottom curve back
    ];
    case 2: return [ // Hairpin Circuit — zigzag with U-turns (ref inspired)
      p(.88,.85), p(.88,.18),                    // right straight up
      p(.75,.06), p(.62,.06),                    // top-right hairpin
      p(.62,.85),                                // middle straight down
      p(.48,.94), p(.35,.94),                    // bottom hairpin
      p(.35,.18),                                // left-mid straight up
      p(.2,.06), p(.08,.2),                      // top-left hairpin
      p(.08,.75), p(.2,.92),                     // left straight down + curve
      p(.5,.92), p(.72,.88),                     // bottom return
    ];
    case 3: return [ // Figure-8 with bridge — two loops crossing
      p(.82,.15), p(.93,.5), p(.82,.85), p(.68,.85),
      p(.56,.57), p(.44,.57),
      p(.3,.85), p(.08,.85), p(.05,.5), p(.08,.15), p(.3,.15),
      p(.44,.43), p(.56,.43),
      p(.68,.15),
    ];
    case 4: return [ // Kidney — asymmetric loop with tight inner curve
      p(.5,.06), p(.78,.06), p(.92,.2), p(.92,.5),
      p(.92,.8), p(.78,.94), p(.5,.94), p(.25,.94),
      p(.08,.8), p(.08,.5), p(.08,.25),
      p(.2,.12), p(.35,.2), p(.42,.35), p(.35,.48),
      p(.22,.35), p(.25,.15),
    ];
    case 5: return [ // Stadium with chicane — long straights + mid chicane
      p(.08,.25), p(.08,.12), p(.2,.06), p(.4,.06),
      p(.48,.15), p(.52,.06),                    // chicane top
      p(.6,.06), p(.8,.06), p(.92,.12), p(.92,.25),
      p(.92,.75), p(.92,.88), p(.8,.94), p(.6,.94),
      p(.52,.85), p(.48,.94),                    // chicane bottom
      p(.4,.94), p(.2,.94), p(.08,.88), p(.08,.75),
    ];
    default: return getWaypoints(w, h, 0);
  }
}

/* ═══════ Build Track (called once, not every frame) ═══════ */
function buildTrack(w, h, type) {
  const SEGS = 28;
  const wp = getWaypoints(w, h, type);
  let pts = buildSpline(wp, SEGS);

  // 3-pass position smoothing with 5-point window (light — preserves curve shape)
  for (let pass = 0; pass < 3; pass++) {
    const next = [], len = pts.length;
    for (let i = 0; i < len; i++) {
      let sx = 0, sy = 0;
      for (let j = -2; j <= 2; j++) {
        const k = (i + j + len) % len;
        sx += pts[k].x; sy += pts[k].y;
      }
      next.push({ x: sx / 5, y: sy / 5 });
    }
    pts = next;
  }

  // Compute raw curvature (abs + signed for crash direction)
  for (let i = 0; i < pts.length; i++) {
    const prv = pts[(i-1+pts.length)%pts.length], cur = pts[i], nxt = pts[(i+1)%pts.length];
    const a1 = Math.atan2(cur.y-prv.y, cur.x-prv.x);
    const a2 = Math.atan2(nxt.y-cur.y, nxt.x-cur.x);
    let d = a2 - a1;
    while (d > Math.PI) d -= Math.PI*2;
    while (d < -Math.PI) d += Math.PI*2;
    pts[i].curve = Math.abs(d);
    pts[i].curveSigned = d; // negative = turning right, positive = turning left
  }

  // 2-pass curvature smoothing — removes spikes but keeps real turn curvature
  for (let pass = 0; pass < 2; pass++) {
    const sc = pts.map((_, i) => {
      let sum = 0;
      for (let j = -3; j <= 3; j++) sum += pts[(i+j+pts.length)%pts.length].curve;
      return sum / 7;
    });
    pts.forEach((p, i) => p.curve = sc[i]);
  }

  // Safe speed — RELATIVE to max curvature (auto-adapts to any smoothing level)
  let maxCurve = 0;
  for (let i = 0; i < pts.length; i++) maxCurve = Math.max(maxCurve, pts[i].curve);
  for (let i = 0; i < pts.length; i++) {
    const ratio = maxCurve > 0 ? pts[i].curve / maxCurve : 0;
    // 97% of the track = full speed — almost NO slowdown needed
    // Only the top 3% sharpest corners can cause crash, and only barely
    if (ratio < 0.97) {
      pts[i].safeSpeed = MAX_SPEED;
    } else {
      const t = (ratio - 0.97) / 0.03;
      pts[i].safeSpeed = MAX_SPEED - t * 0.08; // 1.0 → 0.92 at most
    }
  }

  // Collect turn sections for curb drawing
  pts.turnSections = [];
  let inT = false, tS = -1;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].curve > 0.012 && !inT) { inT = true; tS = i; }
    if ((pts[i].curve <= 0.012 || i === pts.length-1) && inT) {
      pts.turnSections.push({ start: tS, end: i });
      inT = false;
    }
  }

  // Bridge zone for figure-8
  pts.bridgeZone = null;
  if (type === 3) {
    pts.bridgeZone = {
      under: { start: 4*SEGS - 12, end: 6*SEGS + 12 },
      over:  { start: 11*SEGS - 12, end: 13*SEGS + 12 },
    };
  }
  return pts;
}

/* ═══════ Component ═══════ */
let _lastTrackType = -1; // module-level: remember last track to avoid repeats

export default function SlotCars({ mode, difficulty, onGameEnd }) {
  const canvasRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    try { screen.orientation?.lock?.('landscape').catch(()=>{}); } catch(e){}

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const CAR_W = 30, CAR_H = 16;

    // Size canvas
    const par = canvas.parentElement;
    canvas.width = par.clientWidth;
    canvas.height = par.clientHeight;

    // Build track with a RANDOM type — always different from last game
    let trackType;
    do { trackType = Math.floor(Math.random() * 6); } while (trackType === _lastTrackType);
    _lastTrackType = trackType;
    let track = buildTrack(canvas.width, canvas.height, trackType);

    /* ── Particle System ── */
    const particles = [];
    function emitCrash(x, y, color) {
      // Sparks
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 4;
        particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
          life: 1, decay: .015+Math.random()*.02, r: 1.5+Math.random()*2,
          color: Math.random()>.5 ? '#FFD700' : '#FF6B35', type: 'spark' });
      }
      // Debris
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 2.5;
        particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
          life: 1, decay: .01+Math.random()*.01, r: 2+Math.random()*3,
          color: color, type: 'debris', rot: Math.random()*Math.PI*2, rotV: (Math.random()-.5)*.3 });
      }
      // Smoke puffs
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({ x: x+(Math.random()-.5)*10, y: y+(Math.random()-.5)*10,
          vx: Math.cos(a)*.5, vy: Math.sin(a)*.5,
          life: 1, decay: .008+Math.random()*.005, r: 5+Math.random()*8,
          color: '#888', type: 'smoke' });
      }
    }
    function updateParticles() {
      for (let i = particles.length-1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= .96; p.vy *= .96;
        if (p.type === 'spark') { p.vy += .08; }
        if (p.type === 'debris') { p.vy += .05; p.rot += p.rotV; }
        if (p.type === 'smoke') { p.r += .15; }
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }
    function drawParticles() {
      for (const p of particles) {
        ctx.globalAlpha = p.life * (p.type === 'smoke' ? .25 : .8);
        if (p.type === 'spark') {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2); ctx.fill();
          // Glow
          ctx.fillStyle = 'rgba(255,200,50,.3)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life * 2.5, 0, Math.PI*2); ctx.fill();
        } else if (p.type === 'debris') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.r/2, -p.r/2, p.r*p.life, p.r*p.life*.6);
          ctx.restore();
        } else {
          ctx.fillStyle = `rgba(150,150,150,${p.life*.2})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ── Skid Marks ── */
    const skidMarks = [];

    /* ── Screen Shake ── */
    let shakeX = 0, shakeY = 0, shakeTimer = 0;
    function triggerShake() { shakeTimer = 12; }

    /* ── Scenery (generated once, positioned away from track) ── */
    function generateScenery(w, h) {
      const items = [];
      const rng = (min, max) => min + Math.random() * (max - min);
      for (let attempt = 0; attempt < 200 && items.length < 35; attempt++) {
        const x = rng(20, w-20), y = rng(20, h-20);
        // Check distance from track
        let minDist = 999;
        for (let i = 0; i < track.length; i += 4) {
          const dx = x - track[i].x, dy = y - track[i].y;
          minDist = Math.min(minDist, Math.sqrt(dx*dx+dy*dy));
        }
        if (minDist < 52) continue; // too close to road
        const type = Math.random();
        if (type < .40) items.push({ x, y, kind: 'tree', size: rng(8,16), shade: rng(.15,.3) });
        else if (type < .65) items.push({ x, y, kind: 'bush', size: rng(4,9), shade: rng(.1,.2) });
        else if (type < .92) items.push({ x, y, kind: 'rock', size: rng(3,6), shade: rng(.08,.15) });
        else items.push({ x, y, kind: 'lake', size: rng(15,25), shade: rng(.05,.1) });
      }
      // Sort by y for depth ordering
      items.sort((a, b) => a.y - b.y);
      return items;
    }
    let scenery = generateScenery(canvas.width, canvas.height);

    const resize = () => {
      canvas.width = par.clientWidth;
      canvas.height = par.clientHeight;
      track = buildTrack(canvas.width, canvas.height, trackType);
      scenery = generateScenery(canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);

    // Both players start at position 0, side-by-side
    const game = {
      p1: { pos: 0, speed: 0, laps: 0, crashed: 0, offX:0, offY:0, cdx:0, cdy:0, crashSpeed:0 },
      p2: { pos: 0, speed: 0, laps: 0, crashed: 0, offX:0, offY:0, cdx:0, cdy:0, crashSpeed:0 },
      countdown: 3, countdownTimer: Date.now(),
      started: false, finished: false, winner: 0, winTimer: 0,
      leader: 0, crownTimer: 0, crownOn: 0,
      finalLapTimer: 0,
    };

    let animId;
    let p1P = false, p2P = false;   // pressing state
    const diffId = difficulty?.id || 'normal';
    const botAggr = diffId === 'easy' ? 0.6 : diffId === 'normal' ? 0.82 : 0.93;

    /* ── Helpers ── */
    function tPos(pos) {
      const i = Math.floor(pos)%track.length, n = (i+1)%track.length, f = pos - Math.floor(pos);
      return { x: track[i].x+(track[n].x-track[i].x)*f, y: track[i].y+(track[n].y-track[i].y)*f };
    }
    function tAngle(pos) {
      const i = Math.floor(pos)%track.length, n = (i+1)%track.length;
      return Math.atan2(track[n].y-track[i].y, track[n].x-track[i].x);
    }
    function tNormal(pos) {
      const a = tAngle(pos);
      return { x: -Math.sin(a), y: Math.cos(a) };
    }
    function inRange(pos, s, e) {
      const i = Math.floor(pos)%track.length;
      return i >= s && i <= e;
    }

    /* ── Update ── */
    function update() {
      if (!game.started) {
        const el = (Date.now() - game.countdownTimer) / 1000;
        const prev = game.countdown;
        game.countdown = 3 - Math.floor(el);
        if (game.countdown !== prev && game.countdown > 0) sounds.countdown();
        if (game.countdown <= 0 && !game.started) { game.started = true; sounds.go(); }
        return;
      }
      if (game.finished) { game.winTimer++; return; }

      /* Crash check */
      const checkCrash = (pl) => {
        if (pl.crashed > 0) {
          pl.crashed--;
          const el = CRASH_DURATION - pl.crashed;
          const speedRatio = pl.crashSpeed / MAX_SPEED;
          const flyDist = 10 + speedRatio * speedRatio * 60; // 10-70px
          const flyF = Math.round(12 + speedRatio * 12);
          const retF = 18;
          
          if (el <= flyF) {
            // Phase 1: car flies off — starts FAST (maintaining momentum), then slows
            const t = el / flyF;
            const eased = Math.sqrt(t); // fast initial burst, gradual deceleration
            pl.offX = pl.cdx * flyDist * eased;
            pl.offY = pl.cdy * flyDist * eased;
            // Car continues on track for first few frames (no sudden stop)
            if (el < 8) {
              pl.pos = (pl.pos + pl.crashSpeed * (1 - t) * 0.6) % track.length;
            }
            pl.speed = 0;
          } else if (pl.crashed <= retF) {
            // Phase 3: car crawls back to road
            const t = pl.crashed / retF;
            pl.offX = pl.cdx * flyDist * t;
            pl.offY = pl.cdy * flyDist * t;
            pl.speed = 0;
          } else {
            // Phase 2: stopped at max off-road distance
            pl.offX = pl.cdx * flyDist;
            pl.offY = pl.cdy * flyDist;
            pl.speed = 0;
          }
          // Explosion when car reaches final position
          if (el === flyF) {
            const cp = tPos(pl.pos);
            emitCrash(cp.x + pl.offX, cp.y + pl.offY, pl === game.p1 ? COLORS.p1 : COLORS.p2);
            triggerShake();
          }
          return true;
        }
        // Look ahead only 4 segments
        let minSafe = 99;
        for (let l = 0; l < 4; l++) minSafe = Math.min(minSafe, track[Math.floor(pl.pos+l)%track.length].safeSpeed);
        if (pl.speed > minSafe) {
          pl.crashSpeed = pl.speed;
          pl.crashed = CRASH_DURATION;
          const a = tAngle(pl.pos);
          const idx = Math.floor(pl.pos) % track.length;
          const curvSign = track[idx].curveSigned || 0;
          const norm = tNormal(pl.pos);
          const side = curvSign > 0 ? -1 : 1;
          
          // Car flies mostly FORWARD (tangent) + slightly outward — like losing grip
          let dx = Math.cos(a) * 3.5 + norm.x * side * 1.0;
          let dy = Math.sin(a) * 3.5 + norm.y * side * 1.0;
          const len = Math.sqrt(dx*dx + dy*dy);
          
          pl.cdx = dx / len; pl.cdy = dy / len;
          pl.offX = 0; pl.offY = 0;
          const cp = tPos(pl.pos);
          skidMarks.push({ x: cp.x, y: cp.y, angle: a, life: 300 });
          if (skidMarks.length > 20) skidMarks.shift();
          if (pl === game.p1 || mode === '2p') vibrate([30,20,30]);
          return true;
        }
        return false;
      };

      const c1 = checkCrash(game.p1), c2 = checkCrash(game.p2);

      /* Player 1 — NO friction when pressing, only decel on release */
      if (!c1) {
        if (p1P) {
          game.p1.speed = Math.min(MAX_SPEED, game.p1.speed + ACCEL_RATE);
        } else {
          game.p1.speed *= DECEL;
          if (game.p1.speed < 0.005) game.p1.speed = 0;
        }
        game.p1.offX = 0; game.p1.offY = 0;
      }

      /* Player 2 */
      if (!c2) {
        if (mode === '2p') {
          if (p2P) {
            game.p2.speed = Math.min(MAX_SPEED, game.p2.speed + ACCEL_RATE);
          } else {
            game.p2.speed *= DECEL;
            if (game.p2.speed < 0.005) game.p2.speed = 0;
          }
        } else {
          // Bot AI: accelerate toward safe speed, decel if above
          let minSafe = 99;
          for (let l = 0; l < 20; l++) minSafe = Math.min(minSafe, track[Math.floor(game.p2.pos+l)%track.length].safeSpeed);
          const target = minSafe * botAggr;
          if (game.p2.speed < target) game.p2.speed = Math.min(MAX_SPEED, game.p2.speed + 0.018 + Math.random()*.008);
          else game.p2.speed *= DECEL;
        }
        game.p2.offX = 0; game.p2.offY = 0;
      }

      /* Move */
      const prev1 = game.p1.pos, prev2 = game.p2.pos;
      if (!c1) game.p1.pos = (game.p1.pos + game.p1.speed) % track.length;
      if (!c2) game.p2.pos = (game.p2.pos + game.p2.speed) % track.length;

      /* Laps */
      if (prev1 > track.length*.9 && game.p1.pos < track.length*.1) {
        game.p1.laps++; sounds.score();
        if (game.p1.laps === LAPS - 1) game.finalLapTimer = 120;
      }
      if (prev2 > track.length*.9 && game.p2.pos < track.length*.1) {
        game.p2.laps++; if(mode==='1p') sounds.score();
        if (game.p2.laps === LAPS - 1) game.finalLapTimer = 120;
      }
      if (game.finalLapTimer > 0) game.finalLapTimer--;

      /* Overtake crown detection */
      const dist1 = game.p1.laps * track.length + game.p1.pos;
      const dist2 = game.p2.laps * track.length + game.p2.pos;
      const newLeader = dist1 > dist2 + 2 ? 1 : dist2 > dist1 + 2 ? 2 : game.leader;
      if (newLeader !== 0 && newLeader !== game.leader && game.leader !== 0) {
        game.crownTimer = 120; // 2 seconds at 60fps
        game.crownOn = newLeader;
      }
      game.leader = newLeader;
      if (game.crownTimer > 0) game.crownTimer--;

      /* Finish */
      if (!game.finished && (game.p1.laps >= LAPS || game.p2.laps >= LAPS)) {
        game.finished = true;
        game.winner = game.p1.laps >= LAPS ? 1 : 2;
        game.winTimer = 0;
        setTimeout(() => {
          onGameEnd(game.p1.laps >= LAPS ? 1 : (mode==='1p' ? 'bot' : 2),
            Math.round((Date.now()-startTimeRef.current)/1000));
        }, 2500);
      }
    }

    /* ── Draw helpers ── */
    function darken(hex, amt) {
      let c = hex.replace('#','');
      if(c.length===3) c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
      const n=parseInt(c,16);
      return `rgb(${Math.max(0,((n>>16)&0xff)-amt)},${Math.max(0,((n>>8)&0xff)-amt)},${Math.max(0,(n&0xff)-amt)})`;
    }

    function drawCarShape(x, y, angle, color, crashed, offX, offY, isWinner) {
      const dx=x+offX, dy=y+offY;
      const isOff = crashed > 0;
      const crashProg = isOff ? (CRASH_DURATION - crashed) / CRASH_DURATION : 0;

      ctx.save();
      ctx.translate(dx, dy);

      // Winner pulse
      if(isWinner) { const s=1+.12*Math.sin(game.winTimer*.13); ctx.scale(s,s); }

      // Crash: realistic spin ~30-45° while flying off
      if (isOff) {
        const el = CRASH_DURATION - crashed;
        const flyF = 22;
        let spinAngle;
        if (el <= flyF) {
          // During fly-out: gradual spin ~40°
          const t = el / flyF;
          spinAngle = t * Math.PI * 0.22;
        } else if (crashed <= 18) {
          // During return: spin back
          const t = crashed / 18;
          spinAngle = t * Math.PI * 0.22;
        } else {
          // Sitting: slight wobble
          spinAngle = Math.PI * 0.22 + Math.sin(el * 0.4) * 0.04;
        }
        ctx.rotate(angle + spinAngle);
      } else {
        ctx.rotate(angle);
      }

      // Shadow (offset for 3D depth)
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(4, 5, CAR_W/2+3, CAR_H/2+2, 0, 0, Math.PI*2); ctx.fill();

      // Tires
      ctx.fillStyle = '#111';
      const tw = 6, th = 3, ty = CAR_H/2;
      ctx.beginPath(); ctx.roundRect(-CAR_W/2+4, -ty-th+1, tw, th, 1); ctx.fill(); // Back Left
      ctx.beginPath(); ctx.roundRect(CAR_W/2-tw-4, -ty-th+1, tw, th, 1); ctx.fill(); // Front Left
      ctx.beginPath(); ctx.roundRect(-CAR_W/2+4, ty-1, tw, th, 1); ctx.fill(); // Back Right
      ctx.beginPath(); ctx.roundRect(CAR_W/2-tw-4, ty-1, tw, th, 1); ctx.fill(); // Front Right

      // Body
      const bodyColor = isOff ? darken(color, 40 + crashProg*30) : color;
      ctx.fillStyle = bodyColor;
      ctx.beginPath(); ctx.roundRect(-CAR_W/2, -CAR_H/2, CAR_W, CAR_H, 5); ctx.fill();

      // Body highlight (3D shine)
      const shine = ctx.createLinearGradient(-CAR_W/2, -CAR_H/2, -CAR_W/2, CAR_H/2);
      shine.addColorStop(0, 'rgba(255,255,255,.2)');
      shine.addColorStop(.5, 'rgba(255,255,255,0)');
      shine.addColorStop(1, 'rgba(0,0,0,.15)');
      ctx.fillStyle = shine;
      ctx.beginPath(); ctx.roundRect(-CAR_W/2, -CAR_H/2, CAR_W, CAR_H, 5); ctx.fill();

      // Racing stripe
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(-CAR_W/2+4, -1, CAR_W-8, 2);

      // Cockpit (dark window)
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath(); ctx.roundRect(-1, -CAR_H/2+3, 9, CAR_H-6, 3); ctx.fill();
      // Windshield reflection
      ctx.fillStyle = 'rgba(100,160,255,.2)';
      ctx.beginPath(); ctx.roundRect(0, -CAR_H/2+3, 4, CAR_H-6, 2); ctx.fill();

      // Spoiler
      ctx.fillStyle = darken(color, 30);
      ctx.fillRect(-CAR_W/2-1, -CAR_H/2+2, 3, CAR_H-4);

      // Headlights
      if(!isOff) {
        ctx.fillStyle = 'rgba(255,255,200,.8)';
        ctx.beginPath(); ctx.arc(CAR_W/2-1, -3, 1.8, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(CAR_W/2-1, 3, 1.8, 0, Math.PI*2); ctx.fill();
        // Headlight glow
        ctx.fillStyle = 'rgba(255,255,200,.1)';
        ctx.beginPath(); ctx.arc(CAR_W/2+4, 0, 8, 0, Math.PI*2); ctx.fill();
      }
      // Tail lights
      ctx.fillStyle = isOff ? 'rgba(255,40,40,.3)' : 'rgba(255,40,40,.6)';
      ctx.beginPath(); ctx.arc(-CAR_W/2+1, -3, 1.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-CAR_W/2+1, 3, 1.3, 0, Math.PI*2); ctx.fill();

      ctx.restore();

      // Crash: ongoing smoke trail
      if (isOff && crashed < CRASH_DURATION - 3) {
        for (let i = 0; i < 2; i++) {
          const smokeA = .06 * (1 - crashProg);
          ctx.fillStyle = `rgba(80,80,80,${smokeA})`;
          ctx.beginPath();
          ctx.arc(dx + (Math.random()-.5)*18, dy + (Math.random()-.5)*18,
            4 + Math.random()*6 + crashProg*8, 0, Math.PI*2);
          ctx.fill();
        }
        // Flash at start of crash
        if (crashed > CRASH_DURATION - 8) {
          const flashA = (crashed - (CRASH_DURATION-8)) / 8;
          ctx.fillStyle = `rgba(255,200,50,${flashA*.3})`;
          ctx.beginPath(); ctx.arc(dx, dy, 20, 0, Math.PI*2); ctx.fill();
        }
      }

      // Winner sparkles
      if(isWinner) {
        for(let i=0;i<8;i++){
          const sa=game.winTimer*.06+i*Math.PI/4, sd=22+Math.sin(game.winTimer*.09+i)*8;
          ctx.fillStyle=`rgba(255,215,0,${.4+.5*Math.sin(game.winTimer*.11+i)})`;
          ctx.beginPath(); ctx.arc(dx+Math.cos(sa)*sd,dy+Math.sin(sa)*sd,2.5,0,Math.PI*2); ctx.fill();
        }
      }
    }

    function drawPlayerCar(pl, color, laneMult, isWinner, playerNum) {
      const pos = tPos(pl.pos), norm = tNormal(pl.pos);
      let cx = pos.x+norm.x*LANE_GAP*laneMult, cy = pos.y+norm.y*LANE_GAP*laneMult;
      
      // Idle vibration
      if (!game.started && game.countdown > 0) {
        cx += (Math.random() - 0.5) * 1.5;
        cy += (Math.random() - 0.5) * 1.5;
      }

      // Exhaust trail + soft speed glow — grows with speed
      if (pl.speed > 0.15 && pl.crashed <= 0 && game.started) {
        const a = tAngle(pl.pos);
        const tailX = cx - Math.cos(a) * 14;
        const tailY = cy - Math.sin(a) * 14;
        const intensity = Math.min(1, pl.speed / MAX_SPEED);
        const count = intensity > 0.7 ? 2 : 1;
        
        // Smoke/exhaust particles
        for (let i = 0; i < count; i++) {
          particles.push({
            x: tailX + (Math.random()-.5)*4,
            y: tailY + (Math.random()-.5)*4,
            vx: -Math.cos(a) * (0.5 + intensity * 1.5) + (Math.random()-.5)*0.6,
            vy: -Math.sin(a) * (0.5 + intensity * 1.5) + (Math.random()-.5)*0.6,
            life: 0.4 + intensity * 0.4,
            decay: 0.025 + Math.random()*0.015,
            r: 1.5 + intensity * 2,
            color: intensity > 0.8 ? '#FF6B35' : '#888',
            type: 'smoke'
          });
        }
        
        // Soft glow dots behind car at high speeds (no hard lines)
        if (intensity > 0.5) {
          ctx.save();
          const glowAlpha = (intensity - 0.5) / 0.5 * 0.25;
          for (let g = 0; g < 3; g++) {
            const dist = 4 + g * 6;
            const gx = tailX - Math.cos(a) * dist + (Math.random()-.5)*2;
            const gy = tailY - Math.sin(a) * dist + (Math.random()-.5)*2;
            const r = (3 - g) * 2.5 + intensity * 2;
            const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = glowAlpha * (1 - g * 0.3);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI*2); ctx.fill();
          }
          ctx.restore();
        }
      }
      
      drawCarShape(cx, cy, tAngle(pl.pos), color, pl.crashed, pl.offX, pl.offY, isWinner);

      // Crown on overtake
      if (game.crownTimer > 0 && game.crownOn === playerNum && !game.finished) {
        const alpha = game.crownTimer < 20 ? game.crownTimer / 20 : 1;
        const bounce = Math.sin(game.crownTimer * .15) * 3;
        ctx.globalAlpha = alpha;
        const crownX = cx + pl.offX;
        const crownY = cy + pl.offY - 24 + bounce;

        ctx.save();
        ctx.translate(crownX, crownY);
        
        // Crown shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 12, 10, 3, 0, 0, Math.PI*2); ctx.fill();

        // Crown body
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.beginPath();
        ctx.moveTo(-8, 8); // bottom left
        ctx.lineTo(-10, -4); // left spike
        ctx.lineTo(-4, 2); // left inner valley
        ctx.lineTo(0, -8); // center spike
        ctx.lineTo(4, 2); // right inner valley
        ctx.lineTo(10, -4); // right spike
        ctx.lineTo(8, 8); // bottom right
        ctx.closePath();
        ctx.fill();
        
        // Crown rim (bottom band)
        ctx.fillStyle = '#DAA520'; // Darker gold
        ctx.beginPath(); ctx.roundRect(-8, 6, 16, 3, 1); ctx.fill();

        // Crown jewels
        ctx.fillStyle = '#FF3366'; // Red jewel
        ctx.beginPath(); ctx.arc(0, -2, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#33CCFF'; // Blue jewel
        ctx.beginPath(); ctx.arc(-5, 4, 1.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, 4, 1.2, 0, Math.PI*2); ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    /* ── Track drawing ── */
    const ROAD_W = 48, CURB_W = ROAD_W+12, BORDER_W = CURB_W+4;

    function fullPath() {
      ctx.beginPath();
      ctx.moveTo(track[0].x, track[0].y);
      for(let i=1;i<track.length;i++) ctx.lineTo(track[i].x, track[i].y);
      ctx.closePath();
    }
    function segPath(s,e) {
      ctx.beginPath();
      const si=Math.max(0,s), ei=Math.min(track.length-1,e);
      ctx.moveTo(track[si].x, track[si].y);
      for(let i=si+1;i<=ei;i++) ctx.lineTo(track[i].x, track[i].y);
    }

    function drawCurbs(sections, clipStart, clipEnd) {
      const secs = clipStart !== undefined
        ? sections.filter(s => s.start >= clipStart && s.end <= clipEnd)
            .concat(sections.filter(s => s.start < clipEnd && s.end > clipStart)
              .map(s => ({ start: Math.max(s.start, clipStart), end: Math.min(s.end, clipEnd) })))
            .filter((s,i,a) => a.findIndex(x=>x.start===s.start&&x.end===s.end)===i)
        : sections;

      for (const sec of secs) {
        ctx.beginPath();
        ctx.moveTo(track[sec.start].x, track[sec.start].y);
        for(let i=sec.start+1; i<=sec.end && i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
        ctx.lineWidth = CURB_W;
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#e63946'; ctx.setLineDash([]); ctx.stroke();
        ctx.strokeStyle = '#f1faee'; ctx.setLineDash([14,14]); ctx.stroke();
        ctx.setLineDash([]); ctx.lineCap = 'round';
      }
    }

    function drawTrackBase(pathFn, turnSections) {
      ctx.lineJoin='round'; ctx.lineCap='round';
      // Drop shadow for 3D depth
      pathFn(); ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=BORDER_W+8;
      ctx.save(); ctx.translate(3,4); pathFn(); ctx.stroke(); ctx.restore();
      // Outer border
      pathFn(); ctx.strokeStyle='#1a1a2a'; ctx.lineWidth=BORDER_W; ctx.stroke();
      drawCurbs(turnSections);
      // Road surface with gradient feel
      pathFn(); ctx.strokeStyle='#4d5566'; ctx.lineWidth=ROAD_W; ctx.stroke();
      pathFn(); ctx.strokeStyle='#5a6478'; ctx.lineWidth=ROAD_W-4; ctx.stroke();
      pathFn(); ctx.strokeStyle='#636d80'; ctx.lineWidth=ROAD_W-10; ctx.stroke();
      // Center dashed line
      pathFn(); ctx.strokeStyle='rgba(255,255,255,.13)'; ctx.lineWidth=1.5;
      ctx.setLineDash([10,14]); ctx.stroke(); ctx.setLineDash([]);
    }

    function drawBridgeOverlay() {
      const bz = track.bridgeZone;
      if(!bz) return;
      const bs=bz.over.start, be=bz.over.end;
      const sp = () => segPath(bs, be);
      ctx.lineJoin='round'; ctx.lineCap='round';
      sp(); ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=BORDER_W+10; ctx.stroke();
      sp(); ctx.strokeStyle='#1a1a2a'; ctx.lineWidth=BORDER_W; ctx.stroke();

      // Bridge curbs
      const bridgeTurns = track.turnSections
        .map(s => ({ start: Math.max(s.start,bs), end: Math.min(s.end,be) }))
        .filter(s => s.end > s.start);
      drawCurbs(bridgeTurns);

      sp(); ctx.strokeStyle='#555d6e'; ctx.lineWidth=ROAD_W; ctx.stroke();
      sp(); ctx.strokeStyle='#636d80'; ctx.lineWidth=ROAD_W-8; ctx.stroke();
      sp(); ctx.strokeStyle='rgba(255,255,255,.13)'; ctx.lineWidth=1.5;
      ctx.setLineDash([10,14]); ctx.stroke(); ctx.setLineDash([]);

      // Barrier rails
      for(const side of [1,-1]) {
        ctx.beginPath();
        for(let i=bs;i<=be;i++){
          const idx=i%track.length, nxt=(idx+1)%track.length;
          const ang=Math.atan2(track[nxt].y-track[idx].y,track[nxt].x-track[idx].x);
          const bx=track[idx].x+(-Math.sin(ang))*(ROAD_W/2+3)*side;
          const by=track[idx].y+Math.cos(ang)*(ROAD_W/2+3)*side;
          if(i===bs) ctx.moveTo(bx,by); else ctx.lineTo(bx,by);
        }
        ctx.strokeStyle='#8a9bb0'; ctx.lineWidth=3; ctx.stroke();
        ctx.strokeStyle='#4a5568'; ctx.lineWidth=1.5; ctx.stroke();
      }
    }

    function drawCheckeredFinish() {
      const sf=track[0], sfA=tAngle(0);
      const nx = -Math.sin(sfA), ny = Math.cos(sfA);
      
      ctx.save();
      ctx.translate(sf.x, sf.y);
      ctx.rotate(sfA + Math.PI/2);
      
      const halfW = ROAD_W/2 + 6;
      
      // Support poles on each side
      ctx.fillStyle = '#888';
      ctx.fillRect(-halfW - 3, -12, 4, 24);
      ctx.fillRect(halfW - 1, -12, 4, 24);
      // Pole caps
      ctx.fillStyle = '#bbb';
      ctx.beginPath(); ctx.arc(-halfW - 1, -12, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(halfW + 1, -12, 3, 0, Math.PI*2); ctx.fill();
      
      // Checkered banner — wide and prominent
      const sq = 5, cols = Math.ceil((halfW*2)/sq), rows = 4;
      const bannerY = -rows*sq/2 - 4;
      
      // Banner shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-halfW, bannerY + 3, halfW*2, rows*sq + 2);
      
      // Checkered squares
      for(let r=0; r<rows; r++) for(let c=0; c<cols; c++) {
        ctx.fillStyle = (r+c)%2===0 ? '#ffffff' : '#111111';
        ctx.fillRect(c*sq - halfW, bannerY + r*sq, sq, sq);
      }
      
      // Banner border
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-halfW, bannerY, halfW*2, rows*sq);
      
      ctx.restore();
    }

    /* ── Scenery Drawing ── */
    function drawScenery() {
      for (const s of scenery) {
        if (s.kind === 'tree') {
          // Shadow
          ctx.fillStyle = `rgba(0,0,0,${s.shade})`;
          ctx.beginPath(); ctx.ellipse(s.x+3, s.y+s.size*.7+3, s.size*.7, s.size*.3, 0, 0, Math.PI*2); ctx.fill();
          // Trunk
          ctx.fillStyle = '#5D4E37';
          ctx.fillRect(s.x-1.5, s.y+s.size*.2, 3, s.size*.5);
          // Canopy — layered circles for depth
          const g = ctx.createRadialGradient(s.x-2, s.y-2, 0, s.x, s.y, s.size);
          g.addColorStop(0, '#4A7C59'); g.addColorStop(.6, '#3A6B48'); g.addColorStop(1, '#2D5438');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.size*.65, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(s.x-s.size*.25, s.y+s.size*.15, s.size*.45, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(s.x+s.size*.3, s.y+s.size*.1, s.size*.5, 0, Math.PI*2); ctx.fill();
          // Highlight
          ctx.fillStyle = 'rgba(100,180,100,.15)';
          ctx.beginPath(); ctx.arc(s.x-s.size*.15, s.y-s.size*.15, s.size*.3, 0, Math.PI*2); ctx.fill();
        } else if (s.kind === 'bush') {
          ctx.fillStyle = `rgba(0,0,0,${s.shade})`;
          ctx.beginPath(); ctx.ellipse(s.x+2, s.y+s.size*.3+2, s.size*.8, s.size*.3, 0, 0, Math.PI*2); ctx.fill();
          const bg = ctx.createRadialGradient(s.x-1, s.y-1, 0, s.x, s.y, s.size);
          bg.addColorStop(0, '#5A8A5A'); bg.addColorStop(1, '#3D6B3D');
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.size*.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(s.x+s.size*.3, s.y+s.size*.1, s.size*.4, 0, Math.PI*2); ctx.fill();
        } else if (s.kind === 'rock') {
          ctx.fillStyle = `rgba(0,0,0,${s.shade})`;
          ctx.beginPath(); ctx.ellipse(s.x+1, s.y+s.size*.2+1, s.size*.7, s.size*.25, 0, 0, Math.PI*2); ctx.fill();
          const rg = ctx.createLinearGradient(s.x-s.size, s.y-s.size, s.x+s.size, s.y+s.size);
          rg.addColorStop(0, '#6B6B6B'); rg.addColorStop(1, '#4A4A4A');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(s.x-s.size, s.y+s.size*.3);
          ctx.lineTo(s.x-s.size*.3, s.y-s.size*.4);
          ctx.lineTo(s.x+s.size*.5, s.y-s.size*.2);
          ctx.lineTo(s.x+s.size, s.y+s.size*.2);
          ctx.closePath(); ctx.fill();
        } else if (s.kind === 'lake') {
          // Lake shadow / edge
          ctx.fillStyle = `rgba(0,0,0,${s.shade})`;
          ctx.beginPath(); ctx.ellipse(s.x+2, s.y+2, s.size, s.size*.6, 0, 0, Math.PI*2); ctx.fill();
          // Water gradient
          const wg = ctx.createLinearGradient(s.x-s.size, s.y-s.size*.6, s.x+s.size, s.y+s.size*.6);
          wg.addColorStop(0, '#3A7CA5'); wg.addColorStop(1, '#2B5D7A');
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, s.size, s.size*.6, 0, 0, Math.PI*2); ctx.fill();
          // Water ripple/highlight
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); 
          ctx.moveTo(s.x - s.size*.4, s.y - s.size*.2);
          ctx.lineTo(s.x + s.size*.2, s.y - s.size*.2);
          ctx.stroke();
        }
      }
    }

    /* ── Skid Mark Drawing ── */
    function drawSkidMarks() {
      for (let i = skidMarks.length-1; i >= 0; i--) {
        const m = skidMarks[i];
        m.life--;
        if (m.life <= 0) { skidMarks.splice(i, 1); continue; }
        const alpha = Math.min(.15, m.life / 300 * .15);
        ctx.save();
        ctx.translate(m.x, m.y); ctx.rotate(m.angle);
        ctx.fillStyle = `rgba(30,30,30,${alpha})`;
        ctx.fillRect(-12, -3, 24, 2);
        ctx.fillRect(-12, 1, 24, 2);
        ctx.restore();
      }
    }

    /* ── Main Draw ── */
    function draw() {
      const w=canvas.width, h=canvas.height;
      const hasBridge = track.bridgeZone !== null;

      // Screen shake
      if (shakeTimer > 0) {
        shakeX = (Math.random()-.5) * shakeTimer * .8;
        shakeY = (Math.random()-.5) * shakeTimer * .8;
        shakeTimer--;
      } else { shakeX = 0; shakeY = 0; }
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Background with subtle ground texture
      const bgGrd = ctx.createLinearGradient(0, 0, 0, h);
      bgGrd.addColorStop(0, '#222836'); bgGrd.addColorStop(.5, '#1d222e'); bgGrd.addColorStop(1, '#171b26');
      ctx.fillStyle = bgGrd; ctx.fillRect(0, 0, w, h);
      
      // Subtle play-mat grid
      ctx.strokeStyle = 'rgba(255,255,255,0.015)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let x = 0; x < w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for(let y = 0; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      // Subtle noise texture
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,255,255,${.005+Math.random()*.008})`;
        ctx.beginPath();
        ctx.arc(Math.random()*w, Math.random()*h, .5+Math.random()*1.5, 0, Math.PI*2);
        ctx.fill();
      }
      // Vignette
      const vig = ctx.createRadialGradient(w/2, h/2, w*.15, w/2, h/2, w*.65);
      vig.addColorStop(0, 'rgba(30,35,60,0)'); vig.addColorStop(1, 'rgba(6,8,16,.6)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);

      // Scenery behind track
      drawScenery();

      // Track
      drawTrackBase(fullPath, track.turnSections);
      drawSkidMarks();

      const w1=game.finished&&game.winner===1, w2=game.finished&&game.winner===2;

      if(hasBridge) {
        const bz=track.bridgeZone;
        const p1Under=inRange(game.p1.pos,bz.under.start,bz.under.end);
        const p2Under=inRange(game.p2.pos,bz.under.start,bz.under.end);
        if(p1Under) drawPlayerCar(game.p1,COLORS.p1,-1,w1,1);
        if(p2Under) drawPlayerCar(game.p2,COLORS.p2,1,w2,2);
        drawBridgeOverlay();
        if(!p1Under) drawPlayerCar(game.p1,COLORS.p1,-1,w1,1);
        if(!p2Under) drawPlayerCar(game.p2,COLORS.p2,1,w2,2);
      } else {
        drawPlayerCar(game.p1,COLORS.p1,-1,w1,1);
        drawPlayerCar(game.p2,COLORS.p2,1,w2,2);
      }

      drawCheckeredFinish();

      // Particles on top of everything
      updateParticles();
      drawParticles();

      ctx.restore(); // end screen shake

      // HUD (outside shake so it stays stable)
      drawText(ctx,`Lap ${Math.min(game.p1.laps+1,LAPS)}/${LAPS}`,16,26,{color:COLORS.p1,size:15,align:'left',shadow:true});
      drawText(ctx,`Lap ${Math.min(game.p2.laps+1,LAPS)}/${LAPS}`,w-16,26,{color:COLORS.p2,size:15,align:'right',shadow:true});

      const barW=55,barH=7;
      const drawSpd=(bx,by,spd,safe,col)=>{
        drawBox(ctx,bx,by,barW,barH,4,'rgba(255,255,255,.06)');
        const sw=Math.min(barW,barW*(safe/MAX_SPEED));
        if(sw<barW) drawBox(ctx,bx+sw,by,barW-sw,barH,4,'rgba(255,60,60,.2)');
        if(spd>0) drawBox(ctx,bx,by,Math.min(barW,barW*(spd/MAX_SPEED)),barH,4,spd>safe*.92?'#ff4d4d':col);
      };
      const pi1=Math.floor(game.p1.pos)%track.length;
      drawSpd(16,36,game.p1.speed,track[pi1].safeSpeed,COLORS.p1);
      if(mode==='2p'){
        const pi2=Math.floor(game.p2.pos)%track.length;
        drawSpd(w-16-barW,36,game.p2.speed,track[pi2].safeSpeed,COLORS.p2);
      }

      if(game.p1.crashed>0) drawText(ctx,'CRASH!',16,54,{color:'#ff4d4d',size:11,align:'left',shadow:true});
      if(game.p2.crashed>0&&mode==='2p') drawText(ctx,'CRASH!',w-16,54,{color:'#ff4d4d',size:11,align:'right',shadow:true});

      // Winner banner
      if(game.finished&&game.winTimer>15){
        const wc=game.winner===1?COLORS.p1:COLORS.p2;
        const wl=game.winner===1?'P1':(mode==='1p'?'BOT':'P2');
        ctx.globalAlpha=Math.min(1,(game.winTimer-15)/25);
        ctx.fillStyle='rgba(0,0,0,.6)';
        ctx.beginPath(); ctx.roundRect(w/2-95,h/2-32,190,64,14); ctx.fill();
        // Draw trophy icon
        ctx.save(); ctx.translate(w/2-50, h/2+3);
        ctx.fillStyle='#FFD700';
        ctx.beginPath();
        ctx.moveTo(-6,0); ctx.lineTo(-8,-10); ctx.quadraticCurveTo(-9,-14,-5,-14);
        ctx.lineTo(5,-14); ctx.quadraticCurveTo(9,-14,8,-10); ctx.lineTo(6,0); ctx.closePath(); ctx.fill();
        ctx.fillRect(-3,0,6,4); ctx.fillRect(-5,4,10,2);
        ctx.restore();
        drawText(ctx,`${wl} WINS!`,w/2+6,h/2,{color:wc,size:24,shadow:true});
        ctx.globalAlpha=1;
      }

      // FINAL LAP banner
      if(game.finalLapTimer > 0 && !game.finished){
        const fAlpha = game.finalLapTimer < 20 ? game.finalLapTimer/20 : Math.min(1,(120-game.finalLapTimer)/15);
        const pulse = 1 + Math.sin(game.finalLapTimer*.2)*.08;
        ctx.globalAlpha = fAlpha;
        ctx.save(); ctx.translate(w/2, h/2 - 60); ctx.scale(pulse,pulse);
        ctx.fillStyle='rgba(0,0,0,.55)';
        ctx.beginPath(); ctx.roundRect(-80,-18,160,36,10); ctx.fill();
        drawText(ctx,'FINAL LAP!',0,0,{color:'#FFD700',size:22,shadow:true});
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      if(game.started&&!game.finished) drawHint(ctx,w,h,mode==='2p'?'P1: TAP LEFT  |  P2: TAP RIGHT':'TAP TO ACCELERATE');
      if(!game.started&&game.countdown>0) drawCountdown(ctx,w,h,game.countdown);
      if(!game.started&&game.countdown<=0){
        ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillRect(0,0,w,h);
        drawText(ctx,'GO!',w/2,h/2,{color:COLORS.green,size:48,shadow:true});
      }
    }

    /* ── Game Loop (track is NOT rebuilt here) ── */
    function gameLoop() {
      update();
      draw();
      animId = requestAnimationFrame(gameLoop);
    }

    /* ── Input ── */
    const onDown = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touches = e.touches || [e];
      for(const t of touches){
        const x=(t.clientX||t.pageX)-rect.left;
        if(mode==='2p') { if(x<canvas.width/2) p1P=true; else p2P=true; }
        else p1P=true;
      }
    };
    const onUp = (e) => {
      if(e.touches&&e.touches.length===0){p1P=false;p2P=false;}
      else if(!e.touches){p1P=false;p2P=false;}
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, {passive:false});
    canvas.addEventListener('touchend', onUp);
    gameLoop();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchend', onUp);
      window.removeEventListener('resize', resize);
      try { screen.orientation?.unlock?.(); } catch(e){}
    };
  }, [mode, difficulty, onGameEnd]); // NO gameOver — component stays stable until unmount

  return <canvas ref={canvasRef} style={{display:'block',width:'100%',height:'100%',touchAction:'none'}} />;
}
