'use client';

import { useRef, useEffect, useState } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { COLORS, drawBg, drawCircle, drawBox, drawText, drawHUD, drawHint, drawFlashBanner, Particles, ScoreFlash } from '@/lib/gameRenderer';

const ROUNDS = 5;
const ARROW_SPEED = 12;

export default function Archery({ mode, difficulty, onGameEnd }) {
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
      turn: 1, round: 1, scores: { p1: 0, p2: 0 },
      power: 0, powerDir: 1, powerLocked: false,
      aim: 0, aimDir: 1, aimLocked: false,
      arrowFlying: false, arrowX: 0, arrowY: 0, arrowVX: 0, arrowVY: 0,
      hitScore: 0, showResult: false, resultTimer: 0,
      targetOffset: 0, targetSwayDir: 1,
      arrows: [],
      particles: new Particles(),
      flashes: new ScoreFlash(),
    };

    let animId;
    const diffId = difficulty?.id || 'normal';

    function getTargetCenter() { return { x: canvas.width * 0.75, y: canvas.height * 0.45 + game.targetOffset }; }
    function getTargetRadius() { return Math.min(canvas.width, canvas.height) * 0.12; }

    function calculateHitScore(x, y) {
      const { x: cx, y: cy } = getTargetCenter();
      const r = getTargetRadius();
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > r) return 0;
      if (dist < r * 0.15) return 10;
      if (dist < r * 0.35) return 8;
      if (dist < r * 0.55) return 6;
      if (dist < r * 0.75) return 4;
      return 2;
    }

    function shootArrow() {
      if (game.arrowFlying || game.showResult || gameOver) return;
      if (!game.powerLocked) { game.powerLocked = true; return; }
      if (!game.aimLocked) {
        game.aimLocked = true;
        game.arrowFlying = true;
        game.arrowX = canvas.width * 0.12;
        game.arrowY = canvas.height * 0.45 + game.aim * 80;
        game.arrowVX = ARROW_SPEED * (game.power / 100);
        game.arrowVY = game.aim * 2;
        sounds.whoosh();
      }
    }

    function nextTurn() {
      game.power = 0; game.powerDir = 1; game.powerLocked = false;
      game.aim = 0; game.aimDir = 1; game.aimLocked = false;
      game.arrowFlying = false; game.showResult = false;
      if (game.turn === 1) { game.turn = 2; }
      else { game.turn = 1; game.round++; game.arrows = []; }
      if (game.round > ROUNDS) {
        setGameOver(true);
        const winner = game.scores.p1 > game.scores.p2 ? 1
          : game.scores.p2 > game.scores.p1 ? (mode === '1p' ? 'bot' : 2) : 'draw';
        onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000));
      }
    }

    function update() {
      game.targetOffset += game.targetSwayDir * 0.4;
      if (Math.abs(game.targetOffset) > 20) game.targetSwayDir *= -1;

      if (game.showResult) {
        game.resultTimer--;
        if (game.resultTimer <= 0) nextTurn();
        game.particles.update();
        game.flashes.update();
        return;
      }

      if (!game.powerLocked) {
        game.power += game.powerDir * 1.5;
        if (game.power >= 100 || game.power <= 0) game.powerDir *= -1;
      }

      if (game.powerLocked && !game.aimLocked) {
        const speed = diffId === 'hard' ? 0.04 : diffId === 'normal' ? 0.03 : 0.02;
        game.aim += game.aimDir * speed;
        if (Math.abs(game.aim) > 1) game.aimDir *= -1;
      }

      if (game.arrowFlying) {
        game.arrowX += game.arrowVX;
        game.arrowY += game.arrowVY;
        game.arrowVY += 0.05;

        const { x: tx } = getTargetCenter();
        if (game.arrowX >= tx - 5) {
          game.arrowFlying = false;
          const score = calculateHitScore(game.arrowX, game.arrowY);
          game.hitScore = score;
          if (score > 0) {
            sounds.score(); vibrate(15);
            game.particles.emit(game.arrowX, game.arrowY, score >= 8 ? COLORS.gold : COLORS.white, score >= 8 ? 12 : 6);
            game.flashes.add(game.arrowX, game.arrowY - 15, `+${score}`, COLORS.gold);
          } else {
            sounds.miss();
            game.flashes.add(canvas.width * 0.75, canvas.height * 0.45, 'MISS', COLORS.red);
          }
          game.arrows.push({ x: game.arrowX, y: game.arrowY, player: game.turn });
          if (game.turn === 1) game.scores.p1 += score;
          else game.scores.p2 += score;
          game.showResult = true;
          game.resultTimer = 50;
        }

        if (game.arrowX > canvas.width || game.arrowY > canvas.height || game.arrowY < 0) {
          game.arrowFlying = false; game.hitScore = 0;
          game.showResult = true; game.resultTimer = 50;
          game.flashes.add(canvas.width / 2, canvas.height * 0.5, 'MISS', COLORS.red);
        }
      }

      game.particles.update();
      game.flashes.update();
    }

    function draw() {
      const w = canvas.width, h = canvas.height;
      const { x: tx, y: ty } = getTargetCenter();
      const tr = getTargetRadius();

      drawBg(ctx, w, h);

      // Subtle ground line
      ctx.fillStyle = '#141e14';
      ctx.fillRect(0, h * 0.72, w, h * 0.28);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h * 0.72); ctx.lineTo(w, h * 0.72); ctx.stroke();

      // Target stand
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(tx - 4, ty + tr, 8, h * 0.72 - ty - tr);

      // Target shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(tx + 3, ty + 3, tr + 3, 0, Math.PI * 2); ctx.fill();

      // Target rings
      const ringColors = ['#f0e8d0', '#1e1e1e', '#3498DB', '#c0392b', COLORS.gold];
      for (let i = 4; i >= 0; i--) {
        ctx.fillStyle = ringColors[i];
        ctx.beginPath(); ctx.arc(tx, ty, tr * ((i + 1) / 5), 0, Math.PI * 2); ctx.fill();
      }
      // Wire lines
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= 5; i++) {
        ctx.beginPath(); ctx.arc(tx, ty, tr * (i / 5), 0, Math.PI * 2); ctx.stroke();
      }

      // Stuck arrows
      for (const a of game.arrows) {
        ctx.fillStyle = a.player === 1 ? COLORS.p1 : COLORS.p2;
        ctx.fillRect(a.x - 14, a.y - 1, 14, 2);
        // Fletching
        ctx.beginPath();
        ctx.moveTo(a.x - 14, a.y);
        ctx.lineTo(a.x - 19, a.y - 4);
        ctx.lineTo(a.x - 11, a.y);
        ctx.lineTo(a.x - 19, a.y + 4);
        ctx.closePath();
        ctx.fillStyle = a.player === 1 ? '#CC4444' : '#2A9A92';
        ctx.fill();
      }

      // Bow
      if (!game.arrowFlying && !game.showResult) {
        const bowY = h * 0.45 + (game.aimLocked ? 0 : game.aim * 80);
        const bowX = w * 0.1;
        const bowColor = game.turn === 1 ? COLORS.p1 : COLORS.p2;

        // Bow arc
        ctx.strokeStyle = '#6B4226';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(bowX, bowY, 28, -Math.PI / 3, Math.PI / 3); ctx.stroke();

        // String
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        const pb = game.powerLocked ? 0 : game.power / 100 * 14;
        ctx.beginPath();
        ctx.moveTo(bowX + Math.cos(-Math.PI / 3) * 28, bowY + Math.sin(-Math.PI / 3) * 28);
        ctx.lineTo(bowX - pb, bowY);
        ctx.lineTo(bowX + Math.cos(Math.PI / 3) * 28, bowY + Math.sin(Math.PI / 3) * 28);
        ctx.stroke();

        // Arrow on bow
        ctx.fillStyle = bowColor;
        ctx.fillRect(bowX - pb, bowY - 1, 22, 2);

        // Aim line
        if (game.powerLocked) {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(bowX + 22, bowY); ctx.lineTo(tx, bowY); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Flying arrow
      if (game.arrowFlying) {
        ctx.fillStyle = game.turn === 1 ? COLORS.p1 : COLORS.p2;
        ctx.fillRect(game.arrowX - 14, game.arrowY - 1, 18, 2);
        ctx.beginPath();
        ctx.moveTo(game.arrowX + 4, game.arrowY);
        ctx.lineTo(game.arrowX - 1, game.arrowY - 3);
        ctx.lineTo(game.arrowX - 1, game.arrowY + 3);
        ctx.closePath();
        ctx.fill();
      }

      // Power bar
      if (!game.powerLocked && !game.showResult) {
        const barX = 14, barW = 18, barTop = h * 0.22, barH = h * 0.36;
        drawBox(ctx, barX, barTop, barW, barH, 4, 'rgba(255,255,255,0.06)');
        const fillH = barH * (game.power / 100);
        const pColor = game.power > 70 ? COLORS.red : game.power > 40 ? COLORS.gold : COLORS.green;
        drawBox(ctx, barX, barTop + barH - fillH, barW, fillH, 4, pColor);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(barX, barTop, barW, barH, 4); ctx.stroke();
      }

      // Particles + flashes
      game.particles.draw(ctx);
      game.flashes.draw(ctx);

      // HUD
      drawHUD(ctx, w, {
        p1Score: game.scores.p1,
        p2Score: game.scores.p2,
        label: `Round ${Math.min(game.round, ROUNDS)}/${ROUNDS}`,
        sublabel: mode === '1p' ? (game.turn === 1 ? 'YOUR SHOT' : 'BOT') : `PLAYER ${game.turn}`,
      });

      // Hint
      if (!game.showResult && !game.arrowFlying) {
        if (!game.powerLocked) drawHint(ctx, w, h, 'TAP to set power');
        else if (!game.aimLocked) drawHint(ctx, w, h, 'TAP to aim & shoot');
      }
    }

    function gameLoop() {
      if (gameOver) return;
      update(); draw();
      animId = requestAnimationFrame(gameLoop);
    }

    const onClick = () => shootArrow();
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onClick(); }, { passive: false });

    const botInterval = setInterval(() => {
      if (mode !== '1p' || game.turn !== 2 || game.showResult || game.arrowFlying || gameOver) return;
      if (!game.powerLocked) {
        const t = diffId === 'easy' ? 30 : diffId === 'normal' ? 15 : 5;
        if (Math.abs(game.power - 80) < t) shootArrow();
      } else if (!game.aimLocked) {
        const t = diffId === 'easy' ? 0.5 : diffId === 'normal' ? 0.25 : 0.08;
        if (Math.abs(game.aim) < t) shootArrow();
      }
    }, 50);

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
