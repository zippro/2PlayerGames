'use client';

import { useRef, useEffect, useState } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { COLORS, drawBg, drawCircle, drawBox, drawHUD, drawHint, drawFlashBanner, Particles } from '@/lib/gameRenderer';

const KNIFE_COUNT = 8;

export default function KnifeThrow({ mode, difficulty, onGameEnd }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [gameOver, setGameOver] = useState(false);
  const startTimeRef = useRef(Date.now());

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
      rotation: 0, rotSpeed: 0.025,
      knives: [], throwing: false,
      knifeY: 0, knifeSpeed: 0,
      turn: 1,
      p1Knives: KNIFE_COUNT, p2Knives: KNIFE_COUNT,
      p1Score: 0, p2Score: 0,
      failed: false, failTimer: 0,
      particles: new Particles(),
    };
    gameRef.current = game;
    let animId;

    function throwKnife() {
      if (game.throwing || game.failed || gameOver) return;
      game.throwing = true;
      game.knifeY = canvas.height - 80;
      game.knifeSpeed = -15;
      sounds.whoosh(); vibrate(10);
    }

    function drawKnife(ctx, x, y, color, scale = 1) {
      const s = scale;
      ctx.save();
      ctx.translate(x, y);
      // Blade
      ctx.fillStyle = '#b0b8c0';
      ctx.beginPath();
      ctx.moveTo(-2 * s, 0);
      ctx.lineTo(0, -20 * s);
      ctx.lineTo(2 * s, 0);
      ctx.closePath();
      ctx.fill();
      // Handle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-3 * s, 0, 6 * s, 18 * s, 2);
      ctx.fill();
      // Guard
      ctx.fillStyle = '#888';
      ctx.fillRect(-5 * s, -1 * s, 10 * s, 3 * s);
      ctx.restore();
    }

    function update() {
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h * 0.35;
      const targetR = Math.min(w, h) * 0.15;

      game.rotation += game.rotSpeed;

      if (game.failed) {
        game.failTimer++;
        if (game.failTimer > 60) {
          game.failed = false;
          game.failTimer = 0;
          game.knives = [];
          game.rotation = 0;
          game.turn = game.turn === 1 ? 2 : 1;
        }
        game.particles.update();
        return;
      }

      if (game.throwing) {
        game.knifeY += game.knifeSpeed;
        const targetBottom = cy + targetR;

        if (game.knifeY <= targetBottom) {
          game.throwing = false;
          const angle = game.rotation % (Math.PI * 2);

          let hit = false;
          for (const k of game.knives) {
            const diff = Math.abs(angle - k.angle) % (Math.PI * 2);
            const minDiff = Math.min(diff, Math.PI * 2 - diff);
            if (minDiff < 0.3) { hit = true; break; }
          }

          if (hit) {
            game.failed = true;
            game.failTimer = 0;
            sounds.miss(); vibrate([30, 20, 30]);
            game.particles.emit(cx, targetBottom, COLORS.red, 16);
            if (game.turn === 1) { game.p2Score++; }
            else { game.p1Score++; }
          } else {
            game.knives.push({ angle, player: game.turn });
            sounds.hit(); vibrate(8);
            game.particles.emit(cx + Math.cos(angle) * targetR, cy + Math.sin(angle) * targetR, COLORS.gold, 4);

            if (game.turn === 1) game.p1Knives--;
            else game.p2Knives--;

            const currentKnives = game.turn === 1 ? game.p1Knives : game.p2Knives;
            if (currentKnives <= 0) {
              if (game.turn === 1) game.p1Score++;
              else game.p2Score++;
              game.knives = [];
              game.p1Knives = KNIFE_COUNT;
              game.p2Knives = KNIFE_COUNT;
            }
            game.turn = game.turn === 1 ? 2 : 1;
          }

          if (game.p1Score >= 3 || game.p2Score >= 3) {
            setGameOver(true);
            const winner = game.p1Score >= 3 ? 1 : (mode === '1p' ? 'bot' : 2);
            setTimeout(() => onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000)), 500);
          }
        }
      }

      game.particles.update();
    }

    function draw() {
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h * 0.35;
      const targetR = Math.min(w, h) * 0.15;

      drawBg(ctx, w, h);

      // Target shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(cx + 3, cy + 4, targetR + 4, 0, Math.PI * 2);
      ctx.fill();

      // Target (rotating)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(game.rotation);

      // Target rings
      const ringColors = ['#c0392b', '#f0e8d0', '#c0392b', '#f0e8d0', '#c0392b'];
      for (let i = ringColors.length - 1; i >= 0; i--) {
        ctx.fillStyle = ringColors[i];
        ctx.beginPath();
        ctx.arc(0, 0, targetR * ((i + 1) / ringColors.length), 0, Math.PI * 2);
        ctx.fill();
      }

      // Wire lines on target
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < ringColors.length; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, targetR * ((i + 1) / ringColors.length), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Stuck knives
      for (const k of game.knives) {
        ctx.save();
        ctx.rotate(k.angle - game.rotation);
        const kColor = k.player === 1 ? COLORS.p1 : COLORS.p2;
        // Blade
        ctx.fillStyle = '#b0b8c0';
        ctx.fillRect(-2, targetR - 4, 4, 14);
        // Handle
        ctx.fillStyle = kColor;
        ctx.beginPath();
        ctx.roundRect(-3, targetR + 10, 6, 16, 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Flying knife
      if (game.throwing) {
        const kColor = game.turn === 1 ? COLORS.p1 : COLORS.p2;
        drawKnife(ctx, cx, game.knifeY, kColor, 1.2);
      }

      // Waiting knife
      if (!game.throwing && !game.failed && !gameOver) {
        const kColor = game.turn === 1 ? COLORS.p1 : COLORS.p2;
        drawKnife(ctx, cx, h - 60, kColor, 1.2);
        drawHint(ctx, w, h, 'TAP TO THROW');
      }

      // Fail banner
      if (game.failed) {
        drawFlashBanner(ctx, w, h, 'HIT! POINT LOST!', COLORS.red);
      }

      // Particles
      game.particles.draw(ctx);

      // Knives remaining (dots)
      const cur = game.turn === 1 ? game.p1Knives : game.p2Knives;
      const dotColor = game.turn === 1 ? COLORS.p1 : COLORS.p2;
      for (let i = 0; i < KNIFE_COUNT; i++) {
        ctx.fillStyle = i < cur ? dotColor : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(cx - ((KNIFE_COUNT - 1) * 5) + i * 10, h * 0.7, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // HUD
      drawHUD(ctx, w, {
        p1Score: game.p1Score,
        p2Score: game.p2Score,
        label: 'FIRST TO 3',
        sublabel: mode === '1p' ? (game.turn === 1 ? 'YOUR TURN' : 'BOT') : `PLAYER ${game.turn}`,
      });
    }

    function gameLoop() {
      if (gameOver) return;
      update(); draw();
      animId = requestAnimationFrame(gameLoop);
    }

    const onClick = () => throwKnife();
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onClick(); }, { passive: false });

    const botInterval = setInterval(() => {
      if (mode === '1p' && game.turn === 2 && !game.throwing && !game.failed && !gameOver) {
        const diffId = difficulty?.id || 'normal';
        const delay = diffId === 'easy' ? 1200 : diffId === 'normal' ? 800 : 400;
        setTimeout(throwKnife, delay * Math.random());
      }
    }, 500);

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
