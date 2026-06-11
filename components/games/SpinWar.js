'use client';

import { useRef, useEffect, useState } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { COLORS, drawBg, drawCircle, drawBox, drawText, drawHUD, drawCountdown, drawFlashBanner } from '@/lib/gameRenderer';

const SPIN_DURATION = 5000;
const ROUNDS_TO_WIN = 3;

export default function SpinWar({ mode, difficulty, onGameEnd }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [phase, setPhase] = useState('ready');
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
      phase: 'ready',
      p1Rpm: 0, p2Rpm: 0,
      p1Angle: 0, p2Angle: 0,
      p1Taps: 0, p2Taps: 0,
      timer: 0, startTime: 0,
      countdown: 3, countdownTimer: 0,
      resultTimer: 0,
      p1Score: 0, p2Score: 0, round: 1,
    };
    gameRef.current = game;

    let animId, botTapInterval;

    function startRound() {
      game.phase = 'countdown';
      game.countdown = 3;
      game.countdownTimer = Date.now();
      game.p1Taps = 0; game.p2Taps = 0;
      game.p1Rpm = 0; game.p2Rpm = 0;
      setPhase('ready');
    }

    function update() {
      if (game.phase === 'countdown') {
        const elapsed = Date.now() - game.countdownTimer;
        const prev = game.countdown;
        game.countdown = 3 - Math.floor(elapsed / 1000);
        if (game.countdown !== prev && game.countdown > 0) sounds.countdown();
        if (game.countdown <= 0) {
          game.phase = 'spinning';
          game.startTime = Date.now();
          game.p1Taps = 0; game.p2Taps = 0;
          setPhase('spinning');
          sounds.go();
          if (mode === '1p') {
            const diffId = difficulty?.id || 'normal';
            const rate = diffId === 'easy' ? 150 : diffId === 'normal' ? 80 : 40;
            botTapInterval = setInterval(() => { if (game.phase === 'spinning') game.p2Taps++; }, rate + Math.random() * 50);
          }
        }
      }

      if (game.phase === 'spinning') {
        const elapsed = Date.now() - game.startTime;
        game.p1Rpm = game.p1Taps * 3;
        game.p2Rpm = game.p2Taps * 3;
        game.p1Angle += game.p1Rpm * 0.001;
        game.p2Angle += game.p2Rpm * 0.001;

        if (elapsed >= SPIN_DURATION) {
          game.phase = 'result';
          game.resultTimer = Date.now();
          setPhase('result');
          if (botTapInterval) clearInterval(botTapInterval);
          if (game.p1Rpm > game.p2Rpm) { game.p1Score++; sounds.score(); }
          else if (game.p2Rpm > game.p1Rpm) { game.p2Score++; sounds.score(); }
          vibrate(20);

          if (game.p1Score >= ROUNDS_TO_WIN || game.p2Score >= ROUNDS_TO_WIN) {
            setTimeout(() => {
              onGameEnd(game.p1Score >= ROUNDS_TO_WIN ? 1 : (mode === '1p' ? 'bot' : 2),
                Math.round((Date.now() - startTimeRef.current) / 1000));
            }, 2000);
          } else {
            setTimeout(() => { game.round++; startRound(); }, 2500);
          }
        }
      }

      if (game.phase === 'result') {
        game.p1Rpm *= 0.97; game.p2Rpm *= 0.97;
        game.p1Angle += game.p1Rpm * 0.0005;
        game.p2Angle += game.p2Rpm * 0.0005;
      }
    }

    function drawSpinner(cx, cy, radius, angle, color, rpm) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        ctx.arc(Math.cos(a) * radius * 0.5 + 2, Math.sin(a) * radius * 0.5 + 3, radius * 0.28, 0, Math.PI * 2);
      }
      ctx.fill();

      // Arms
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const ax = Math.cos(a) * radius * 0.5;
        const ay = Math.sin(a) * radius * 0.5;

        // Arm connector
        ctx.strokeStyle = color;
        ctx.lineWidth = radius * 0.15;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ax, ay); ctx.stroke();

        // Arm circle
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(ax, ay, radius * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Bearing dot
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(ax, ay, radius * 0.08, 0, Math.PI * 2); ctx.fill();
      }

      // Center hub
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath(); ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(0, 0, radius * 0.05, 0, Math.PI * 2); ctx.fill();

      ctx.restore();

      // RPM text
      drawText(ctx, `${Math.round(rpm)} RPM`, cx, cy + radius + 26, { color, size: 15, shadow: true });
    }

    function draw() {
      const w = canvas.width, h = canvas.height;
      const spinnerR = Math.min(w * 0.25, h * 0.12);

      drawBg(ctx, w, h);

      // Subtle divider
      ctx.fillStyle = COLORS.line;
      ctx.fillRect(0, h / 2 - 0.5, w, 1);

      // P1 area tint
      ctx.fillStyle = 'rgba(255,107,107,0.04)';
      ctx.fillRect(0, h / 2, w, h / 2);

      // Labels
      drawText(ctx, mode === '1p' ? 'YOU' : 'PLAYER 1', w / 2, h * 0.3 - spinnerR - 18, { color: COLORS.p1, size: 13 });
      drawText(ctx, mode === '1p' ? 'BOT' : 'PLAYER 2', w / 2, h * 0.7 - spinnerR - 18, { color: COLORS.p2, size: 13 });

      // Spinners
      drawSpinner(w / 2, h * 0.3, spinnerR, game.p1Angle, COLORS.p1, game.p1Rpm);
      drawSpinner(w / 2, h * 0.7, spinnerR, game.p2Angle, COLORS.p2, game.p2Rpm);

      // HUD
      drawHUD(ctx, w, { p1Score: game.p1Score, p2Score: game.p2Score, label: `Round ${game.round}` });

      // Timer bar during spinning
      if (game.phase === 'spinning') {
        const elapsed = Date.now() - game.startTime;
        const pct = Math.min(elapsed / SPIN_DURATION, 1);
        drawBox(ctx, 24, h / 2 - 6, w - 48, 12, 6, 'rgba(255,255,255,0.06)');
        const barW = (w - 48) * (1 - pct);
        if (barW > 0) drawBox(ctx, 24, h / 2 - 6, barW, 12, 6, pct > 0.7 ? COLORS.red : COLORS.green);
        drawText(ctx, `${Math.ceil((SPIN_DURATION - elapsed) / 1000)}s`, w / 2, h / 2, { color: COLORS.white, size: 10, font: "'Inter', sans-serif" });
      }

      // Countdown overlay
      if (game.phase === 'countdown' && game.countdown > 0) {
        drawCountdown(ctx, w, h, game.countdown);
      }

      // Ready overlay
      if (game.phase === 'ready') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, w, h);
        drawText(ctx, 'TAP TO START', w / 2, h / 2 - 8, { color: COLORS.gold, size: 26, shadow: true });
        drawText(ctx, 'Tap as fast as you can!', w / 2, h / 2 + 24, { color: COLORS.textDim, size: 13, font: "'Inter', sans-serif" });
      }

      // Result
      if (game.phase === 'result') {
        const winner = game.p1Rpm > game.p2Rpm ? (mode === '1p' ? 'You Win!' : 'P1 Wins!') :
                       game.p2Rpm > game.p1Rpm ? (mode === '1p' ? 'Bot Wins!' : 'P2 Wins!') : 'Draw!';
        drawFlashBanner(ctx, w, h, winner, COLORS.gold);
      }
    }

    function gameLoop() {
      update(); draw();
      animId = requestAnimationFrame(gameLoop);
    }

    const onTap = (y) => {
      if (game.phase === 'ready') { startRound(); return; }
      if (game.phase !== 'spinning') return;
      const h = canvas.height;
      if (y > h / 2) { game.p1Taps++; vibrate(3); }
      else if (mode === '2p') { game.p2Taps++; vibrate(3); }
    };

    const onClick = (e) => { const rect = canvas.getBoundingClientRect(); onTap(e.clientY - rect.top); };
    const onTouch = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const rect = canvas.getBoundingClientRect();
        onTap(touch.clientY - rect.top);
      }
    };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    gameLoop();

    return () => {
      cancelAnimationFrame(animId);
      if (botTapInterval) clearInterval(botTapInterval);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouch);
      window.removeEventListener('resize', resize);
    };
  }, [mode, difficulty, onGameEnd]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />;
}
