'use client';

import { useRef, useEffect, useState } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { COLORS, drawText, drawFlashBanner, Particles } from '@/lib/gameRenderer';

const WINNING_SCORE = 5;
const BALL_R = 14;
const FRICTION = 0.985;
const GOAL_WIDTH_PCT = 0.35;
const PAD = 35;

export default function SoccerPool({ mode, difficulty, onGameEnd }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      if (gameRef.current) resetPositions(gameRef.current);
    };

    function resetPositions(game) {
      const w = canvas.width, h = canvas.height;
      game.w = w; game.h = h;
      const px = PAD, py = PAD, pw = w - PAD * 2, ph = h - PAD * 2;
      game.pitch = { x: px, y: py, w: pw, h: ph };

      // 5 players per team (2-1-2 formation)
      game.balls = [
        // P1 (bottom)
        { x: px + pw * 0.25, y: py + ph * 0.85, vx: 0, vy: 0, player: 1, r: BALL_R, style: 0 },
        { x: px + pw * 0.75, y: py + ph * 0.85, vx: 0, vy: 0, player: 1, r: BALL_R, style: 1 },
        { x: px + pw * 0.5,  y: py + ph * 0.72, vx: 0, vy: 0, player: 1, r: BALL_R, style: 2 },
        { x: px + pw * 0.3,  y: py + ph * 0.58, vx: 0, vy: 0, player: 1, r: BALL_R, style: 3 },
        { x: px + pw * 0.7,  y: py + ph * 0.58, vx: 0, vy: 0, player: 1, r: BALL_R, style: 4 },
        // P2 (top)
        { x: px + pw * 0.25, y: py + ph * 0.15, vx: 0, vy: 0, player: 2, r: BALL_R, style: 5 },
        { x: px + pw * 0.75, y: py + ph * 0.15, vx: 0, vy: 0, player: 2, r: BALL_R, style: 6 },
        { x: px + pw * 0.5,  y: py + ph * 0.28, vx: 0, vy: 0, player: 2, r: BALL_R, style: 7 },
        { x: px + pw * 0.3,  y: py + ph * 0.42, vx: 0, vy: 0, player: 2, r: BALL_R, style: 8 },
        { x: px + pw * 0.7,  y: py + ph * 0.42, vx: 0, vy: 0, player: 2, r: BALL_R, style: 9 },
      ];
      game.soccerBall = { x: px + pw / 2, y: py + ph / 2, vx: 0, vy: 0, r: BALL_R * 0.85, rot: 0 };
      game.zoom = 1;
      game.targetZoom = 1;
    }

    resize();
    window.addEventListener('resize', resize);

    const game = {
      w: canvas.width, h: canvas.height,
      pitch: { x: PAD, y: PAD, w: canvas.width - PAD * 2, h: canvas.height - PAD * 2 },
      balls: [], soccerBall: null,
      turn: 1, scores: { p1: 0, p2: 0 },
      dragging: null, dragStart: null, dragCurrent: null,
      animating: false, goalScored: false, goalTimer: 0,
      particles: new Particles(),
      zoom: 1, targetZoom: 1,
      ballTrail: [],
    };
    resetPositions(game);
    gameRef.current = game;

    let animId;

    function allBallsStopped() {
      const t = 0.3;
      for (const b of game.balls) { if (Math.abs(b.vx) > t || Math.abs(b.vy) > t) return false; }
      const sb = game.soccerBall;
      return Math.abs(sb.vx) < t && Math.abs(sb.vy) < t;
    }

    function resolveCollision(b1, b2) {
      const dx = b2.x - b1.x, dy = b2.y - b1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = b1.r + b2.r;
      if (dist < minDist && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = minDist - dist;
        b1.x -= nx * overlap / 2; b1.y -= ny * overlap / 2;
        b2.x += nx * overlap / 2; b2.y += ny * overlap / 2;
        const dvx = b1.vx - b2.vx, dvy = b1.vy - b2.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          b1.vx -= dot * nx * 0.8; b1.vy -= dot * ny * 0.8;
          b2.vx += dot * nx * 0.8; b2.vy += dot * ny * 0.8;
          sounds.hit(); vibrate(5);
          game.particles.emit((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, COLORS.white, 5);
        }
      }
    }

    function update() {
      const { balls, soccerBall: sb, pitch: p } = game;
      const goalW = p.w * GOAL_WIDTH_PCT;
      const goalLeft = p.x + (p.w - goalW) / 2;
      const goalRight = goalLeft + goalW;

      // Smooth zoom
      game.zoom += (game.targetZoom - game.zoom) * 0.08;

      // Zoom back when balls stop and not dragging
      if (!game.dragging && game.animating && allBallsStopped()) {
        game.targetZoom = 1;
      }
      if (!game.dragging && !game.animating) {
        game.targetZoom = 1;
      }

      if (game.goalScored) {
        game.goalTimer++;
        if (game.goalTimer > 90) {
          game.goalScored = false; game.goalTimer = 0;
          resetPositions(game);
          if (game.scores.p1 >= WINNING_SCORE || game.scores.p2 >= WINNING_SCORE) {
            setGameOver(true);
            onGameEnd(game.scores.p1 >= WINNING_SCORE ? 1 : (mode === '1p' ? 'bot' : 2),
              Math.round((Date.now() - startTimeRef.current) / 1000));
          }
        }
        game.particles.update();
        return;
      }

      // Ball trail
      const sbSpeed = Math.hypot(sb.vx, sb.vy);
      if (sbSpeed > 2) {
        game.ballTrail.push({ x: sb.x, y: sb.y, life: 1, r: sb.r * 0.5 });
        if (game.ballTrail.length > 12) game.ballTrail.shift();
      }
      for (let i = game.ballTrail.length - 1; i >= 0; i--) {
        game.ballTrail[i].life -= 0.07;
        if (game.ballTrail[i].life <= 0) game.ballTrail.splice(i, 1);
      }

      const allBalls = [...balls, sb];
      for (const b of allBalls) {
        b.x += b.vx; b.y += b.vy;
        b.vx *= FRICTION; b.vy *= FRICTION;
        if (b.x - b.r < p.x) { b.x = p.x + b.r; b.vx = Math.abs(b.vx) * 0.7; }
        if (b.x + b.r > p.x + p.w) { b.x = p.x + p.w - b.r; b.vx = -Math.abs(b.vx) * 0.7; }
        if (b.y - b.r < p.y) {
          if (b === sb && b.x > goalLeft && b.x < goalRight) {
            game.scores.p1++; game.goalScored = true; sounds.score(); vibrate(30);
            game.particles.emit(b.x, p.y, COLORS.gold, 25);
          } else { b.y = p.y + b.r; b.vy = Math.abs(b.vy) * 0.7; }
        }
        if (b.y + b.r > p.y + p.h) {
          if (b === sb && b.x > goalLeft && b.x < goalRight) {
            game.scores.p2++; game.goalScored = true; sounds.score(); vibrate(30);
            game.particles.emit(b.x, p.y + p.h, COLORS.gold, 25);
          } else { b.y = p.y + p.h - b.r; b.vy = -Math.abs(b.vy) * 0.7; }
        }
      }

      for (let i = 0; i < allBalls.length; i++)
        for (let j = i + 1; j < allBalls.length; j++)
          resolveCollision(allBalls[i], allBalls[j]);

      if (game.animating && allBallsStopped()) {
        game.animating = false;
        game.turn = game.turn === 1 ? 2 : 1;
        if (mode === '1p' && game.turn === 2 && !game.goalScored) setTimeout(botShoot, 500);
      }

      game.particles.update();
    }

    function botShoot() {
      const diffId = difficulty?.id || 'normal';
      const myBalls = game.balls.filter(b => b.player === 2);
      const sb = game.soccerBall;
      let closest = myBalls[0], minDist = Infinity;
      for (const b of myBalls) {
        const d = Math.hypot(b.x - sb.x, b.y - sb.y);
        if (d < minDist) { minDist = d; closest = b; }
      }
      const noise = diffId === 'easy' ? 0.5 : diffId === 'normal' ? 0.25 : 0.08;
      const dx = sb.x - closest.x + (Math.random() - 0.5) * game.pitch.w * noise;
      const dy = sb.y - closest.y + (Math.random() - 0.5) * game.pitch.h * noise;
      const dist = Math.hypot(dx, dy);
      const power = diffId === 'easy' ? 8 : diffId === 'normal' ? 12 : 15;
      closest.vx = (dx / dist) * power;
      closest.vy = (dy / dist) * power;
      game.animating = true;
    }

    /* ── Drawing ── */
    function drawPitch() {
      const { pitch: p } = game;
      const w = game.w, h = game.h;
      const goalW = p.w * GOAL_WIDTH_PCT;
      const goalLeft = p.x + (p.w - goalW) / 2;
      const goalDepth = 18;

      // Background (Stadium Floor)
      ctx.fillStyle = '#0d1611';
      ctx.fillRect(0, 0, w, h);

      // 3D Pitch border shadow & wall depth
      const borderR = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(p.x - 12, p.y - 12, p.w + 24, p.h + 36, borderR); ctx.fill();
      ctx.fillStyle = '#142918'; // Dark wall color
      ctx.beginPath(); ctx.roundRect(p.x - 10, p.y - 10, p.w + 20, p.h + 28, borderR); ctx.fill();
      // Wall top surface (rim)
      ctx.fillStyle = '#1a3a1e';
      ctx.beginPath(); ctx.roundRect(p.x - 10, p.y - 10, p.w + 20, p.h + 20, borderR); ctx.fill();

      // Pitch surface (Grass)
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x, p.y, p.w, p.h);
      ctx.clip();
      
      // Grass stripes
      const stripeCount = 10;
      const stripeH = p.h / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#2d8a3e' : '#34994a';
        ctx.fillRect(p.x, p.y + i * stripeH, p.w, stripeH);
      }

      // Inner drop shadow (from walls onto grass)
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#2d8a3e'; // transparent color to cast shadow
      ctx.lineWidth = 15;
      ctx.strokeRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
      ctx.shadowBlur = 0;
      ctx.restore(); // end clip

      // Pitch outline (chalk)
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);

      // Center line
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y + p.h / 2); ctx.lineTo(p.x + p.w, p.y + p.h / 2); ctx.stroke();

      // Center circle
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) * 0.1, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 4, 0, Math.PI * 2); ctx.fill();

      // Penalty areas
      const penW = p.w * 0.55, penH = p.h * 0.13;
      const penX = p.x + (p.w - penW) / 2;
      ctx.strokeRect(penX, p.y, penW, penH);
      ctx.strokeRect(penX, p.y + p.h - penH, penW, penH);

      // Goal areas
      const gaW = p.w * 0.3, gaH = p.h * 0.055;
      const gaX = p.x + (p.w - gaW) / 2;
      ctx.strokeRect(gaX, p.y, gaW, gaH);
      ctx.strokeRect(gaX, p.y + p.h - gaH, gaW, gaH);

      // Penalty spots
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h * 0.18, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h * 0.82, 3, 0, Math.PI * 2); ctx.fill();

      // Corner arcs
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x + p.w, p.y, 10, Math.PI / 2, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y + p.h, 10, -Math.PI / 2, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x + p.w, p.y + p.h, 10, Math.PI, Math.PI * 1.5); ctx.stroke();

      // Goal nets
      drawGoalNet(goalLeft, p.y - goalDepth, goalW, goalDepth);
      drawGoalNet(goalLeft, p.y + p.h, goalW, goalDepth);

      // 3D Goal posts
      ctx.fillStyle = '#b0b0b0'; // side posts
      ctx.fillRect(goalLeft - 3, p.y - goalDepth, 4, goalDepth + 2);
      ctx.fillRect(goalLeft + goalW - 1, p.y - goalDepth, 4, goalDepth + 2);
      ctx.fillRect(goalLeft - 3, p.y + p.h - 2, 4, goalDepth + 2);
      ctx.fillRect(goalLeft + goalW - 1, p.y + p.h - 2, 4, goalDepth + 2);
      
      ctx.fillStyle = '#ffffff'; // top crossbar
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
      ctx.fillRect(goalLeft - 3, p.y - goalDepth, goalW + 6, 3);
      ctx.fillRect(goalLeft - 3, p.y + p.h + goalDepth - 3, goalW + 6, 3);
      ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0;
    }

    function drawGoalNet(x, y, w, h) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let gx = x; gx <= x + w; gx += 5) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
      for (let gy = y; gy <= y + h; gy += 5) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
      ctx.stroke();
      ctx.restore();
    }

    function drawPlayerDisc(b) {
      const col = b.player === 1 ? COLORS.p1 : COLORS.p2;
      const r = b.r;
      const skinTones = ['#f5c6a0','#e8b090','#d4956b','#c68642','#8d5524'];
      const skin = skinTones[b.style % skinTones.length];

      // Drop Shadow (elongated to show height)
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 6, r * 1.05, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();

      // 3D Puck Base (cylinder wall)
      const baseDepth = 5;
      const baseColor = b.player === 1 ? '#7a0b0b' : '#085750';
      ctx.fillStyle = baseColor;
      ctx.beginPath(); ctx.arc(b.x, b.y + baseDepth, r, 0, Math.PI * 2); ctx.fill();
      // connect top to base
      ctx.fillRect(b.x - r, b.y, r * 2, baseDepth);

      // Body circle (jersey surface on top)
      const bg = ctx.createRadialGradient(b.x - r * 0.2, b.y - r * 0.2, 0, b.x, b.y, r);
      bg.addColorStop(0, b.player === 1 ? '#ff7070' : '#70e3ff');
      bg.addColorStop(1, col);
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();

      // Clip everything inside the disc
      ctx.save();
      ctx.beginPath(); ctx.arc(b.x, b.y, r - 1, 0, Math.PI * 2); ctx.clip();

      // Head (centered in disc)
      const headR = r * 0.5;
      const headY = b.y - r * 0.05;
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(b.x, headY, headR, 0, Math.PI * 2); ctx.fill();

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x - headR * 0.3, headY, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x + headR * 0.3, headY, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(b.x - headR * 0.3, headY, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x + headR * 0.3, headY, 1, 0, Math.PI * 2); ctx.fill();

      // Mouth
      ctx.strokeStyle = '#6b3a2a';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(b.x, headY + headR * 0.25, headR * 0.2, 0.2, Math.PI - 0.2); ctx.stroke();

      // Hairstyles (all clipped inside disc)
      const s = b.style;
      if (s === 0) {
        // Mohawk
        ctx.fillStyle = '#e6c619';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.ellipse(b.x + i * 2.5, headY - headR + Math.abs(i), 2, 4 + (2 - Math.abs(i)), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s === 1) {
        // Afro
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath(); ctx.arc(b.x, headY - headR * 0.3, headR * 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.arc(b.x, headY, headR * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x - headR * 0.3, headY, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x + headR * 0.3, headY, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(b.x - headR * 0.3, headY, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x + headR * 0.3, headY, 1, 0, Math.PI * 2); ctx.fill();
      } else if (s === 2) {
        // Headband
        ctx.fillStyle = '#3a2a1a';
        ctx.beginPath(); ctx.arc(b.x, headY - headR * 0.25, headR * 0.9, Math.PI + 0.4, -0.4); ctx.fill();
        ctx.strokeStyle = b.player === 1 ? '#ff3030' : '#3070ff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, headY, headR, Math.PI + 0.6, -0.6); ctx.stroke();
      } else if (s === 3) {
        // Bald + Beard
        ctx.fillStyle = '#5a3a1a';
        ctx.beginPath(); ctx.arc(b.x, headY + headR * 0.35, headR * 0.6, 0.3, Math.PI - 0.3); ctx.fill();
      } else if (s === 4) {
        // Spiky
        ctx.fillStyle = '#f0e040';
        for (let i = 0; i < 6; i++) {
          const a = Math.PI * 0.2 + (i / 5) * Math.PI * 0.6;
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(Math.PI + a) * headR * 0.5, headY + Math.sin(Math.PI + a) * headR * 0.5);
          ctx.lineTo(b.x + Math.cos(Math.PI + a) * (headR + 3), headY + Math.sin(Math.PI + a) * (headR + 3));
          ctx.lineTo(b.x + Math.cos(Math.PI + a + 0.2) * headR * 0.5, headY + Math.sin(Math.PI + a + 0.2) * headR * 0.5);
          ctx.fill();
        }
      } else if (s === 5) {
        // Cap
        ctx.fillStyle = b.player === 1 ? '#cc2020' : '#2050cc';
        ctx.beginPath(); ctx.arc(b.x, headY - headR * 0.1, headR + 1, Math.PI + 0.3, -0.3); ctx.fill();
        ctx.fillRect(b.x - headR, headY - headR * 0.15, headR * 2, 2);
      } else if (s === 6) {
        // Long hair
        ctx.fillStyle = '#8b5e3c';
        ctx.beginPath(); ctx.arc(b.x, headY - headR * 0.15, headR * 0.9, Math.PI + 0.3, -0.3); ctx.fill();
        ctx.fillRect(b.x - headR - 0.5, headY, 2.5, headR);
        ctx.fillRect(b.x + headR - 2, headY, 2.5, headR);
      } else if (s === 7) {
        // Curly top
        ctx.fillStyle = '#1a0a00';
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * 0.15 + (i / 6) * Math.PI * 0.7;
          ctx.beginPath();
          ctx.arc(b.x + Math.cos(Math.PI + a) * headR * 0.6, headY + Math.sin(Math.PI + a) * headR * 0.6, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s === 8) {
        // Bandana
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(b.x, headY - headR * 0.2, headR * 0.8, Math.PI + 0.5, -0.5); ctx.fill();
        ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, headY, headR, Math.PI + 0.7, -0.7); ctx.stroke();
      } else {
        // Top knot
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath(); ctx.arc(b.x, headY - headR * 0.2, headR * 0.75, Math.PI + 0.4, -0.4); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, headY - headR - 1, 3.5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore(); // end clip

      // Outline on top
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();

      // Speed glow
      const spd = Math.hypot(b.vx, b.vy);
      if (spd > 3) {
        ctx.globalAlpha = Math.min(0.25, spd / 30);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(b.x, b.y, r + 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    function drawFootball(sb) {
      const r = sb.r;
      const rot = sb.rot || 0;

      // Update rotation based on velocity (rolling!)
      const spd = Math.hypot(sb.vx, sb.vy);
      if (spd > 0.1) {
        sb.rot = (sb.rot || 0) + spd * 0.08;
      }

      // Shadow (elongated when fast)
      const shadowStretch = Math.min(1.5, 1 + spd * 0.03);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(sb.x + 1.5, sb.y + r * 0.8, r * shadowStretch, r * 0.35, Math.atan2(sb.vy, sb.vx), 0, Math.PI * 2);
      ctx.fill();

      // Clip to ball shape
      ctx.save();
      ctx.beginPath(); ctx.arc(sb.x, sb.y, r, 0, Math.PI * 2); ctx.clip();

      // White ball body with 3D gradient (fixed, not rotating)
      const g = ctx.createRadialGradient(sb.x - r * 0.35, sb.y - r * 0.35, r * 0.1, sb.x + r * 0.1, sb.y + r * 0.1, r * 1.1);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, '#f0f0f0');
      g.addColorStop(0.8, '#d8d8d8');
      g.addColorStop(1, '#aaaaaa');
      ctx.fillStyle = g;
      ctx.fillRect(sb.x - r, sb.y - r, r * 2, r * 2);

      // Rotate the entire patch pattern as one rigid surface
      ctx.save();
      ctx.translate(sb.x, sb.y);
      ctx.rotate(rot);

      // Draw patches relative to (0,0) — they roll together
      const pFill = 'rgba(30,30,30,0.2)';
      const pStroke = 'rgba(0,0,0,0.08)';

      // Center pentagon
      drawPatch(0, 0, r * 0.28, 0, pFill, pStroke);

      // Ring of 5 surrounding pentagons (fixed positions)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        drawPatch(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.2, a, pFill, pStroke);
      }

      // Outer ring (partially visible, clipped by ball edge)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
        drawPatch(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.17, a, pFill, pStroke);
      }

      // Seam lines connecting patches
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        // Center to inner ring
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18);
        ctx.lineTo(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38);
        ctx.stroke();
        // Inner ring to outer
        const a2 = a + Math.PI / 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
        ctx.lineTo(Math.cos(a2) * r * 0.78, Math.sin(a2) * r * 0.78);
        ctx.stroke();
      }

      ctx.restore(); // end rotation

      ctx.restore(); // end clip

      // Outer rim (crisp edge)
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(sb.x, sb.y, r, 0, Math.PI * 2); ctx.stroke();

      // Specular highlight (top-left, always fixed = looks 3D)
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(sb.x - r * 0.3, sb.y - r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(sb.x - r * 0.15, sb.y - r * 0.15, r * 0.4, 0, Math.PI * 2); ctx.fill();

      // Motion blur / speed glow
      if (spd > 4) {
        const moveAngle = Math.atan2(sb.vy, sb.vx);
        ctx.globalAlpha = Math.min(0.18, spd / 40);
        // Trail circles behind the ball
        for (let i = 1; i <= 3; i++) {
          const tx = sb.x - Math.cos(moveAngle) * i * 4;
          const ty = sb.y - Math.sin(moveAngle) * i * 4;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(tx, ty, r * (1 - i * 0.15), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawPatch(cx, cy, patchR, rotation, fillColor, strokeColor) {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rotation + (i / 5) * Math.PI * 2;
        const px = cx + Math.cos(a) * patchR;
        const py = cy + Math.sin(a) * patchR;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    function drawShotIndicator() {
      if (!game.dragging || !game.dragStart || !game.dragCurrent) return;
      const b = game.dragging;
      const dx = game.dragStart.x - game.dragCurrent.x;
      const dy = game.dragStart.y - game.dragCurrent.y;
      const dragDist = Math.hypot(dx, dy);
      if (dragDist < 5) return;

      const power = Math.min(dragDist * 0.15, 18);
      const powerRatio = power / 18;
      const angle = Math.atan2(dy, dx); // forward direction
      const backAngle = angle + Math.PI; // backward direction
      const coneRGB = powerRatio > 0.7 ? '255,80,80' : powerRatio > 0.4 ? '255,200,80' : '80,255,120';
      const indicatorColor = `rgb(${coneRGB})`;

      // === BACKWARD (Power Pull Slingshot) ===
      const backLen = 15 + powerRatio * 45;
      const backTipX = b.x + Math.cos(backAngle) * backLen;
      const backTipY = b.y + Math.sin(backAngle) * backLen;

      ctx.strokeStyle = `rgba(${coneRGB}, ${0.5 + powerRatio * 0.5})`;
      ctx.lineWidth = 2 + powerRatio * 4;
      ctx.lineCap = 'round';
      ctx.shadowColor = indicatorColor;
      ctx.shadowBlur = 10;
      
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(backTipX, backTipY);
      ctx.stroke();

      // Draw pull anchor
      ctx.fillStyle = indicatorColor;
      ctx.beginPath(); ctx.arc(backTipX, backTipY, 4 + powerRatio * 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; // reset

      // === FORWARD (Trajectory Laser Guide) ===
      const fwdLen = 40 + powerRatio * 100;
      const fwdTipX = b.x + Math.cos(angle) * fwdLen;
      const fwdTipY = b.y + Math.sin(angle) * fwdLen;

      ctx.strokeStyle = `rgba(${coneRGB}, 0.8)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -Date.now() * 0.05; // Laser animation scrolling forward
      
      ctx.beginPath();
      // Start line just outside the player token
      ctx.moveTo(b.x + Math.cos(angle) * b.r, b.y + Math.sin(angle) * b.r);
      ctx.lineTo(fwdTipX, fwdTipY);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // Target reticle at the end
      ctx.strokeStyle = indicatorColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fwdTipX, fwdTipY, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(${coneRGB}, 0.2)`;
      ctx.fill();

      // Inner dot
      ctx.fillStyle = indicatorColor;
      ctx.beginPath(); ctx.arc(fwdTipX, fwdTipY, 2, 0, Math.PI * 2); ctx.fill();

      // Charge ring around the player
      ctx.strokeStyle = `rgba(${coneRGB},${0.4 + powerRatio * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 6, angle - Math.PI * powerRatio, angle + Math.PI * powerRatio);
      ctx.stroke();
    }

    function draw() {
      const { balls, soccerBall: sb, pitch: p } = game;
      const w = game.w, h = game.h;

      // Clear
      ctx.fillStyle = '#1a3a1e';
      ctx.fillRect(0, 0, w, h);

      // Apply zoom from center
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(game.zoom, game.zoom);
      ctx.translate(-w / 2, -h / 2);

      // Pitch
      drawPitch();

      // Ball trail
      for (const t of game.ballTrail) {
        ctx.globalAlpha = t.life * 0.2;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r * t.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Shot indicator (behind everything)
      drawShotIndicator();

      // Player discs
      for (const b of balls) drawPlayerDisc(b);

      // Football
      drawFootball(sb);

      // Particles
      game.particles.draw(ctx);

      ctx.restore(); // end zoom

      // ─── HUD (outside zoom) ───
      // Top center scoreboard
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(w / 2 - 45, 4, 90, 26, 8); ctx.fill();
      drawText(ctx, `${game.scores.p1}`, w / 2 - 16, 18, { color: COLORS.p1, size: 16, shadow: true });
      drawText(ctx, '-', w / 2, 18, { color: 'rgba(255,255,255,0.6)', size: 14 });
      drawText(ctx, `${game.scores.p2}`, w / 2 + 16, 18, { color: COLORS.p2, size: 16, shadow: true });

      // Turn indicator
      if (!game.animating && !game.goalScored) {
        const label = mode === '1p'
          ? (game.turn === 1 ? 'Flick a ball!' : 'Bot thinking...')
          : `Player ${game.turn} — Flick!`;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        const tw = ctx.measureText ? 100 : 100;
        ctx.beginPath(); ctx.roundRect(w / 2 - 55, h - 28, 110, 20, 6); ctx.fill();
        drawText(ctx, label, w / 2, h - 16, {
          color: game.turn === 1 ? COLORS.p1 : COLORS.p2,
          size: 10,
          shadow: true,
        });
      }

      // Goal!
      if (game.goalScored) drawFlashBanner(ctx, w, h, 'GOAL!', COLORS.gold);
    }

    function gameLoop() {
      if (gameOver) return;
      update(); draw();
      animId = requestAnimationFrame(gameLoop);
    }

    const getRawPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const screenToWorld = (pos) => {
      const cx = game.w / 2, cy = game.h / 2;
      return {
        x: cx + (pos.x - cx) / game.zoom,
        y: cy + (pos.y - cy) / game.zoom,
      };
    };

    const onStart = (e) => {
      if (game.animating || game.goalScored) return;
      e.preventDefault();
      const raw = getRawPos(e);
      const pos = screenToWorld(raw);
      const myBalls = game.balls.filter(b => b.player === game.turn);
      for (const b of myBalls) {
        if (Math.hypot(pos.x - b.x, pos.y - b.y) < b.r + 15) {
          if (mode === '1p' && game.turn === 2) return;
          game.dragging = b;
          game.dragStart = pos;
          game.dragCurrent = pos;
          break;
        }
      }
    };

    const onMove = (e) => {
      if (!game.dragging) return;
      e.preventDefault();
      const raw = getRawPos(e);
      game.dragCurrent = screenToWorld(raw);

      // Zoom out simultaneously while dragging — based on drag distance (power)
      const dx = game.dragStart.x - game.dragCurrent.x;
      const dy = game.dragStart.y - game.dragCurrent.y;
      const power = Math.min(Math.hypot(dx, dy) * 0.15, 18);
      const powerRatio = power / 18;
      game.targetZoom = 1 - powerRatio * 0.18; // zoom out up to 18%
    };

    const onEnd = () => {
      if (!game.dragging || !game.dragStart || !game.dragCurrent) { game.dragging = null; return; }
      const dx = game.dragStart.x - game.dragCurrent.x;
      const dy = game.dragStart.y - game.dragCurrent.y;
      const power = Math.min(Math.hypot(dx, dy) * 0.15, 18);
      if (power > 1) {
        const dist = Math.hypot(dx, dy);
        game.dragging.vx = (dx / dist) * power;
        game.dragging.vy = (dy / dist) * power;
        game.animating = true;
        sounds.whoosh();
      }
      game.dragging = null; game.dragStart = null; game.dragCurrent = null;
      // Zoom back to default
      game.targetZoom = 1;
    };

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
    gameLoop();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
      window.removeEventListener('resize', resize);
    };
  }, [mode, difficulty, onGameEnd, gameOver]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />;
}
