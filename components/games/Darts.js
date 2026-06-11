'use client';

import { useRef, useEffect, useState } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { COLORS, drawBg, drawCircle, drawHUD, drawHint, drawFlashBanner, drawText, Particles, ScoreFlash } from '@/lib/gameRenderer';

const ROUNDS = 3;
const DARTS_PER_ROUND = 3;
const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export default function Darts({ mode, difficulty, onGameEnd }) {
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
    };
    resize();
    window.addEventListener('resize', resize);

    const game = {
      turn: 1, round: 1, dartsThrown: 0,
      scores: { p1: 0, p2: 0 },
      crosshairX: 0, crosshairY: 0,
      crosshairVX: 2.5, crosshairVY: 1.8,
      thrown: false, dartX: 0, dartY: 0, dartScore: 0,
      showScore: false, showTimer: 0,
      darts: [],
      particles: new Particles(),
      flashes: new ScoreFlash(),
    };
    gameRef.current = game;

    let animId;
    const diffId = difficulty?.id || 'normal';

    function getCenter() { return { x: canvas.width / 2, y: canvas.height * 0.38 }; }
    function getRadius() { return Math.min(canvas.width, canvas.height) * 0.28; }

    function calculateScore(x, y) {
      const { x: cx, y: cy } = getCenter();
      const r = getRadius();
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) return 0;
      if (dist < r * 0.04) return 50;
      if (dist < r * 0.1) return 25;
      let angle = Math.atan2(dy, dx) + Math.PI / 20;
      if (angle < 0) angle += Math.PI * 2;
      const segIndex = Math.floor((angle / (Math.PI * 2)) * 20) % 20;
      let score = SEGMENTS[segIndex];
      if (dist > r * 0.55 && dist < r * 0.65) score *= 3;
      else if (dist > r * 0.88 && dist < r * 1.0) score *= 2;
      return score;
    }

    function throwDart() {
      if (game.thrown || game.showScore || gameOver) return;
      game.thrown = true;
      sounds.whoosh();
      game.dartX = game.crosshairX;
      game.dartY = game.crosshairY;
      game.dartScore = calculateScore(game.dartX, game.dartY);
      sounds.hit(); vibrate(15);

      if (game.turn === 1) game.scores.p1 += game.dartScore;
      else game.scores.p2 += game.dartScore;

      game.darts.push({ x: game.dartX, y: game.dartY, player: game.turn });
      game.particles.emit(game.dartX, game.dartY, game.dartScore >= 25 ? COLORS.gold : COLORS.white, game.dartScore >= 25 ? 12 : 6);
      game.flashes.add(game.dartX, game.dartY - 20, game.dartScore > 0 ? `+${game.dartScore}` : 'MISS', game.dartScore > 0 ? COLORS.gold : COLORS.red);
      game.showScore = true;
      game.showTimer = 50;
    }

    function update() {
      const { x: cx, y: cy } = getCenter();
      const r = getRadius();
      const wobble = diffId === 'easy' ? 1.5 : diffId === 'normal' ? 2.5 : 4;

      if (!game.thrown && !game.showScore) {
        game.crosshairX += game.crosshairVX;
        game.crosshairY += game.crosshairVY;
        const margin = r * 1.2;
        if (game.crosshairX < cx - margin || game.crosshairX > cx + margin) {
          game.crosshairVX *= -1;
          game.crosshairVX += (Math.random() - 0.5) * wobble;
        }
        if (game.crosshairY < cy - margin || game.crosshairY > cy + margin) {
          game.crosshairVY *= -1;
          game.crosshairVY += (Math.random() - 0.5) * wobble;
        }
        const maxSpd = 3 + game.round * 0.5;
        game.crosshairVX = Math.max(-maxSpd, Math.min(maxSpd, game.crosshairVX));
        game.crosshairVY = Math.max(-maxSpd, Math.min(maxSpd, game.crosshairVY));
      }

      if (game.showScore) {
        game.showTimer--;
        if (game.showTimer <= 0) {
          game.showScore = false;
          game.thrown = false;
          game.dartsThrown++;
          if (game.dartsThrown >= DARTS_PER_ROUND) {
            game.dartsThrown = 0;
            if (game.turn === 1) { game.turn = 2; }
            else { game.turn = 1; game.round++; }
            game.darts = [];
            if (game.round > ROUNDS) {
              setGameOver(true);
              const winner = game.scores.p1 > game.scores.p2 ? 1
                : game.scores.p2 > game.scores.p1 ? (mode === '1p' ? 'bot' : 2) : 'draw';
              onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000));
              return;
            }
          }
          game.crosshairX = cx;
          game.crosshairY = cy;
        }
      }

      game.particles.update();
      game.flashes.update();
    }

    function drawBoard(cx, cy, r) {
      // Board shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(cx + 3, cy + 4, r + 8, 0, Math.PI * 2);
      ctx.fill();

      // Wire frame
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;

      // Outer rim
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.fill();

      // Segments
      for (let i = 0; i < 20; i++) {
        const sa = (i / 20) * Math.PI * 2 - Math.PI / 20;
        const ea = ((i + 1) / 20) * Math.PI * 2 - Math.PI / 20;

        // Main segment
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r * 0.88, sa, ea);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#f0e8d0';
        ctx.fill();

        // Double ring
        ctx.beginPath();
        ctx.arc(cx, cy, r, sa, ea);
        ctx.arc(cx, cy, r * 0.88, ea, sa, true);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? '#c0392b' : '#1e8449';
        ctx.fill();

        // Triple ring
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.65, sa, ea);
        ctx.arc(cx, cy, r * 0.55, ea, sa, true);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? '#c0392b' : '#1e8449';
        ctx.fill();

        // Wire lines
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sa) * r, cy + Math.sin(sa) * r);
        ctx.stroke();

        // Segment number
        const numAngle = (i / 20) * Math.PI * 2;
        const numX = cx + Math.cos(numAngle) * (r + 18);
        const numY = cy + Math.sin(numAngle) * (r + 18);
        drawText(ctx, `${SEGMENTS[i]}`, numX, numY, { color: COLORS.textDim, size: 11, font: "'Inter', sans-serif" });
      }

      // Wire circles
      for (const mult of [1, 0.88, 0.65, 0.55, 0.1, 0.04]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * mult, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bull
      ctx.fillStyle = '#1e8449';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Bullseye
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw() {
      const w = canvas.width, h = canvas.height;
      const { x: cx, y: cy } = getCenter();
      const r = getRadius();

      drawBg(ctx, w, h);
      drawBoard(cx, cy, r);

      // Stuck darts
      for (const d of game.darts) {
        // Dart shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(d.x + 2, d.y + 2, 5, 0, Math.PI * 2);
        ctx.fill();
        // Dart point
        drawCircle(ctx, d.x, d.y, 4, d.player === 1 ? COLORS.p1 : COLORS.p2);
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshair
      if (!game.thrown || game.showScore) {
        const chX = game.showScore ? game.dartX : game.crosshairX;
        const chY = game.showScore ? game.dartY : game.crosshairY;
        const chColor = game.turn === 1 ? COLORS.p1 : COLORS.p2;

        ctx.strokeStyle = chColor;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(chX - 14, chY); ctx.lineTo(chX + 14, chY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(chX, chY - 14); ctx.lineTo(chX, chY + 14); ctx.stroke();
        ctx.beginPath(); ctx.arc(chX, chY, 9, 0, Math.PI * 2); ctx.stroke();
      }

      // Particles + score flashes
      game.particles.draw(ctx);
      game.flashes.draw(ctx);

      // HUD
      drawHUD(ctx, w, {
        p1Score: game.scores.p1,
        p2Score: game.scores.p2,
        label: `Round ${Math.min(game.round, ROUNDS)}/${ROUNDS}`,
        sublabel: mode === '1p' ? (game.turn === 1 ? 'YOUR TURN' : 'BOT') : `PLAYER ${game.turn}`,
      });

      // Darts remaining indicator (dots)
      const remaining = DARTS_PER_ROUND - game.dartsThrown;
      for (let i = 0; i < DARTS_PER_ROUND; i++) {
        ctx.fillStyle = i < remaining ? (game.turn === 1 ? COLORS.p1 : COLORS.p2) : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(w / 2 - 12 + i * 12, h - 18, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tap hint
      if (!game.thrown && !game.showScore) {
        drawHint(ctx, w, h - 36, 'TAP TO THROW');
      }
    }

    function gameLoop() {
      if (gameOver) return;
      update(); draw();
      animId = requestAnimationFrame(gameLoop);
    }

    const onClick = () => throwDart();
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onClick(); }, { passive: false });

    // Bot
    const botInterval = setInterval(() => {
      if (mode === '1p' && game.turn === 2 && !game.thrown && !game.showScore && !gameOver) {
        const { x: cx, y: cy } = getCenter();
        const dist = Math.hypot(game.crosshairX - cx, game.crosshairY - cy);
        const threshold = diffId === 'easy' ? 999 : diffId === 'normal' ? 80 : 30;
        if (dist < threshold) setTimeout(throwDart, 50);
      }
    }, 100);

    const { x: cx, y: cy } = getCenter();
    game.crosshairX = cx;
    game.crosshairY = cy;
    gameLoop();

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(botInterval);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
    };
  }, [mode, difficulty, onGameEnd, gameOver]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />;
}
