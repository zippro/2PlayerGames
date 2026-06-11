'use client';

import { useRef, useEffect, useState } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { COLORS, drawBg, drawBox, drawCircle, drawText, drawHUD, drawHint, drawFlashBanner, Particles } from '@/lib/gameRenderer';

const WINNING_SCORE = 5;
const BALL_R = 8;

export default function Tennis({ mode, difficulty, onGameEnd }) {
  const canvasRef = useRef(null);
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
      ball: { x: 0, y: 0, vx: 0, vy: 0, active: false, served: false },
      p1: { x: 0, y: 0, w: 50, h: 14, score: 0 },
      p2: { x: 0, y: 0, w: 50, h: 14, score: 0 },
      serving: 1, lastHit: 0, bounced: false,
      point: false, pointTimer: 0, pointWinner: 0,
      particles: new Particles(),
      trail: [],
    };

    const diffId = difficulty?.id || 'normal';
    const botReaction = diffId === 'easy' ? 0.04 : diffId === 'normal' ? 0.08 : 0.14;
    const keysRef = {};
    const touchRef = { p1: null, p2: null };

    function resetPositions() {
      const w = canvas.width, h = canvas.height;
      game.p1.x = w / 2 - game.p1.w / 2;
      game.p1.y = h - 60;
      game.p2.x = w / 2 - game.p2.w / 2;
      game.p2.y = 46;
      game.ball.active = false;
      game.ball.served = false;
      game.bounced = false;
      game.trail = [];
    }
    resetPositions();

    function serve() {
      const w = canvas.width;
      game.ball.active = true;
      game.ball.served = true;
      game.bounced = false;
      game.lastHit = game.serving;
      if (game.serving === 1) {
        game.ball.x = game.p1.x + game.p1.w / 2;
        game.ball.y = game.p1.y - 20;
        game.ball.vx = (Math.random() - 0.5) * 4;
        game.ball.vy = -6;
      } else {
        game.ball.x = game.p2.x + game.p2.w / 2;
        game.ball.y = game.p2.y + game.p2.h + 20;
        game.ball.vx = (Math.random() - 0.5) * 4;
        game.ball.vy = 6;
      }
      sounds.tap();
    }

    function scorePoint(winner) {
      game.point = true;
      game.pointWinner = winner;
      game.pointTimer = 60;
      if (winner === 1) game.p1.score++;
      else game.p2.score++;
      sounds.score(); vibrate(20);
      game.particles.emit(canvas.width / 2, canvas.height / 2, winner === 1 ? COLORS.p1 : COLORS.p2, 14);

      if (game.p1.score >= WINNING_SCORE || game.p2.score >= WINNING_SCORE) {
        setGameOver(true);
        const w = game.p1.score >= WINNING_SCORE ? 1 : (mode === '1p' ? 'bot' : 2);
        setTimeout(() => onGameEnd(w, Math.round((Date.now() - startTimeRef.current) / 1000)), 800);
      }
    }

    let animId;

    function update() {
      const w = canvas.width, h = canvas.height;
      const netY = h / 2;

      if (game.point) {
        game.pointTimer--;
        if (game.pointTimer <= 0) {
          game.point = false;
          game.serving = game.pointWinner === 1 ? 1 : 2;
          resetPositions();
        }
        game.particles.update();
        return;
      }

      if (!game.ball.served) {
        if (mode === '1p' && game.serving === 2) serve();
      }

      // P1 input
      if (touchRef.p1 !== null) {
        game.p1.x += (touchRef.p1 - game.p1.w / 2 - game.p1.x) * 0.2;
      }
      if (keysRef['ArrowLeft'] || keysRef['a']) game.p1.x -= 6;
      if (keysRef['ArrowRight'] || keysRef['d']) game.p1.x += 6;
      game.p1.x = Math.max(10, Math.min(w - 10 - game.p1.w, game.p1.x));

      // P2 input or bot
      if (mode === '1p') {
        if (game.ball.active) {
          const targetX = game.ball.x - game.p2.w / 2;
          game.p2.x += (targetX - game.p2.x) * botReaction;
          if (diffId === 'easy') game.p2.x += (Math.random() - 0.5) * 3;
        }
      } else {
        if (touchRef.p2 !== null) {
          game.p2.x += (touchRef.p2 - game.p2.w / 2 - game.p2.x) * 0.2;
        }
      }
      game.p2.x = Math.max(10, Math.min(w - 10 - game.p2.w, game.p2.x));

      if (!game.ball.active) { game.particles.update(); return; }

      // Trail
      game.trail.push({ x: game.ball.x, y: game.ball.y });
      if (game.trail.length > 5) game.trail.shift();

      game.ball.x += game.ball.vx;
      game.ball.y += game.ball.vy;

      // Side walls
      if (game.ball.x - BALL_R < 10 || game.ball.x + BALL_R > w - 10) {
        game.ball.vx *= -1;
        game.ball.x = Math.max(BALL_R + 10, Math.min(w - BALL_R - 10, game.ball.x));
        sounds.hit();
      }

      // Net collision
      if (game.ball.y > netY - 5 && game.ball.y < netY + 5 && Math.abs(game.ball.vy) < 3) {
        scorePoint(game.lastHit === 1 ? 2 : 1);
        return;
      }

      // P1 paddle
      if (game.ball.vy > 0 && game.ball.y + BALL_R >= game.p1.y && game.ball.y - BALL_R <= game.p1.y + game.p1.h &&
          game.ball.x >= game.p1.x && game.ball.x <= game.p1.x + game.p1.w) {
        const hitPos = (game.ball.x - (game.p1.x + game.p1.w / 2)) / (game.p1.w / 2);
        game.ball.vy = -Math.abs(game.ball.vy) * 1.02;
        game.ball.vx = hitPos * 5;
        game.ball.y = game.p1.y - BALL_R;
        game.lastHit = 1;
        game.bounced = false;
        sounds.bounce(); vibrate(8);
        game.particles.emit(game.ball.x, game.p1.y, COLORS.p1, 4);
      }

      // P2 paddle
      if (game.ball.vy < 0 && game.ball.y - BALL_R <= game.p2.y + game.p2.h && game.ball.y + BALL_R >= game.p2.y &&
          game.ball.x >= game.p2.x && game.ball.x <= game.p2.x + game.p2.w) {
        const hitPos = (game.ball.x - (game.p2.x + game.p2.w / 2)) / (game.p2.w / 2);
        game.ball.vy = Math.abs(game.ball.vy) * 1.02;
        game.ball.vx = hitPos * 5;
        game.ball.y = game.p2.y + game.p2.h + BALL_R;
        game.lastHit = 2;
        game.bounced = false;
        sounds.bounce(); vibrate(8);
        game.particles.emit(game.ball.x, game.p2.y + game.p2.h, COLORS.p2, 4);
      }

      // Out of bounds
      if (game.ball.y < -20) scorePoint(1);
      if (game.ball.y > h + 20) scorePoint(2);

      game.particles.update();
    }

    function draw() {
      const w = canvas.width, h = canvas.height;
      const netY = h / 2;

      // Court background (dark green, clean)
      ctx.fillStyle = '#1a3a1a';
      ctx.fillRect(0, 0, w, h);

      // Court boundary
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      // Center line (vertical)
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w / 2, 10); ctx.lineTo(w / 2, h - 10); ctx.stroke();

      // Service lines
      ctx.beginPath();
      ctx.moveTo(10, h * 0.3); ctx.lineTo(w - 10, h * 0.3);
      ctx.moveTo(10, h * 0.7); ctx.lineTo(w - 10, h * 0.7);
      ctx.stroke();

      // Net
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(6, netY - 1.5, w - 12, 3);
      // Net posts
      ctx.fillStyle = '#888';
      ctx.fillRect(2, netY - 8, 5, 16);
      ctx.fillRect(w - 7, netY - 8, 5, 16);
      // Net mesh (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      for (let x = 20; x < w - 20; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, netY - 6); ctx.lineTo(x, netY + 6); ctx.stroke();
      }

      // P1 racket (bottom)
      drawBox(ctx, game.p1.x, game.p1.y, game.p1.w, game.p1.h, 6, COLORS.p1, 'rgba(255,107,107,0.3)');

      // P2 racket (top)
      drawBox(ctx, game.p2.x, game.p2.y, game.p2.w, game.p2.h, 6, COLORS.p2, 'rgba(78,205,196,0.3)');

      // Ball trail
      for (let i = 0; i < game.trail.length; i++) {
        const t = game.trail[i];
        ctx.fillStyle = `rgba(170,255,0,${(i / game.trail.length) * 0.12})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BALL_R * (i / game.trail.length) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ball
      if (game.ball.active) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(game.ball.x + 2, game.ball.y + 3, BALL_R, BALL_R * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ball body
        drawCircle(ctx, game.ball.x, game.ball.y, BALL_R, '#AAFF00', 'rgba(170,255,0,0.25)', 10);
        // Ball seam
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(game.ball.x, game.ball.y, BALL_R * 0.6, -0.5, 0.5);
        ctx.stroke();
      }

      // Particles
      game.particles.draw(ctx);

      // Score displays (semi-transparent on court)
      drawText(ctx, `${game.p1.score}`, w / 2 - 30, h * 0.85, { color: 'rgba(255,107,107,0.4)', size: 28, shadow: true });
      drawText(ctx, `${game.p2.score}`, w / 2 + 30, h * 0.15 + 10, { color: 'rgba(78,205,196,0.4)', size: 28, shadow: true });

      // Serve prompt
      if (!game.ball.served && !game.point) {
        drawFlashBanner(ctx, w, h, 'TAP TO SERVE', COLORS.gold);
      }

      // Point scored banner
      if (game.point) {
        const label = mode === '1p'
          ? (game.pointWinner === 1 ? 'YOUR POINT!' : 'BOT SCORES!')
          : `PLAYER ${game.pointWinner} SCORES!`;
        drawFlashBanner(ctx, w, h, label, game.pointWinner === 1 ? COLORS.p1 : COLORS.p2);
      }
    }

    function gameLoop() {
      if (gameOver) return;
      update(); draw();
      animId = requestAnimationFrame(gameLoop);
    }

    const onKeyDown = (e) => { keysRef[e.key] = true; };
    const onKeyUp = (e) => { keysRef[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onTouchMove = (e) => {
      e.preventDefault();
      for (const touch of e.touches) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        if (y > canvas.height / 2) touchRef.p1 = x;
        else if (mode === '2p') touchRef.p2 = x;
      }
    };
    const onTouchEnd = () => { touchRef.p1 = null; touchRef.p2 = null; };
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      touchRef.p1 = e.clientX - rect.left;
    };

    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('mousemove', onMouseMove);

    const onTap = () => {
      if (!game.ball.served && !game.point) serve();
    };
    canvas.addEventListener('click', onTap);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onTap(); }, { passive: false });

    gameLoop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onTap);
      window.removeEventListener('resize', resize);
    };
  }, [mode, difficulty, onGameEnd, gameOver]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />;
}
