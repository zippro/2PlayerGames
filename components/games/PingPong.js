'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { COLORS, drawHUD, drawText, Particles } from '@/lib/gameRenderer';

const WINNING_SCORE = 7;
const BALL_SPEED = 5;
const PADDLE_SPEED = 8;
const BOT_SPEEDS = { easy: 2.5, normal: 4.5, hard: 7 };

// Multi-ball schedule: [seconds, ballCount]
const BALL_SCHEDULE = [
  [30, 2],
  [100, 3],
  [150, 4],
];

export default function PingPong({ mode, difficulty, onGameEnd }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef({});
  const touchRef = useRef({ p1: null, p2: null });
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const startTimeRef = useRef(Date.now());

  function makeBall(w, h, speed, spawning) {
    return {
      x: w / 2, y: h / 2,
      vx: speed * (Math.random() > 0.5 ? 1 : -1),
      vy: speed * (Math.random() * 1.6 - 0.8),
      r: Math.max(8, w * 0.014),
      trail: [],
      spawnTimer: spawning ? 1.0 : 0, // 1.0 -> 0 = growing in
      active: !spawning,
    };
  }

  function generateBricks(w, h) {
    const bricks = [];
    const brickW = Math.max(30, w * 0.06);
    const brickH = Math.max(14, h * 0.045);
    const count = 4 + Math.floor(Math.random() * 5); // 4-8
    const ironCount = 2;
    const centerX = w / 2;
    const zoneLeft = centerX - w * 0.2;
    const zoneRight = centerX + w * 0.2;
    const margin = 30;

    for (let i = 0; i < count; i++) {
      let x, y, attempts = 0;
      do {
        x = zoneLeft + Math.random() * (zoneRight - zoneLeft - brickW);
        y = margin + Math.random() * (h - margin * 2 - brickH);
        attempts++;
      } while (attempts < 50 && bricks.some(b =>
        Math.abs(b.x - x) < brickW + 8 && Math.abs(b.y - y) < brickH + 8
      ));

      bricks.push({
        x, y, w: brickW, h: brickH,
        iron: i < ironCount,
        hp: i < ironCount ? Infinity : 2,
        alive: true,
        crackAnim: 0, // 0-1, visual crack overlay
      });
    }
    return bricks;
  }

  const initGame = useCallback((canvas) => {
    const w = canvas.width;
    const h = canvas.height;
    const paddleW = Math.max(10, w * 0.022);
    const paddleH = Math.max(70, h * 0.16);

    return {
      balls: [makeBall(w, h, BALL_SPEED, false)],
      p1: { x: 24, y: h / 2 - paddleH / 2, w: paddleW, h: paddleH },
      p2: { x: w - 24 - paddleW, y: h / 2 - paddleH / 2, w: paddleW, h: paddleH },
      w, h, paddleH, paddleW,
      scores: { p1: 0, p2: 0 },
      particles: new Particles(),
      bricks: generateBricks(w, h),
      ballsSpawned: 1,
      spawnFlash: 0, // visual flash when new ball spawns
    };
  }, []);

  const resetBall = useCallback((ball, game) => {
    ball.x = game.w / 2;
    ball.y = game.h / 2;
    ball.trail = [];
    const speed = BALL_SPEED + Math.min(game.scores.p1 + game.scores.p2, 6) * 0.3;
    ball.vx = speed * (Math.random() > 0.5 ? 1 : -1);
    ball.vy = speed * (Math.random() * 1.6 - 0.8);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      if (gameRef.current) {
        const g = gameRef.current;
        g.w = canvas.width;
        g.h = canvas.height;
        g.p2.x = canvas.width - 24 - g.paddleW;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    gameRef.current = initGame(canvas);
    const game = gameRef.current;
    let animId;

    const botDiffKey = difficulty?.id || 'normal';
    const botSpeed = BOT_SPEEDS[botDiffKey] || BOT_SPEEDS.normal;

    function ballBrickCollision(ball, brick) {
      if (!brick.alive || !ball.active) return;
      const bx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
      const by = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
      const dist = Math.hypot(ball.x - bx, ball.y - by);
      if (dist >= ball.r) return;

      // Determine collision side
      const overlapLeft = (ball.x + ball.r) - brick.x;
      const overlapRight = (brick.x + brick.w) - (ball.x - ball.r);
      const overlapTop = (ball.y + ball.r) - brick.y;
      const overlapBottom = (brick.y + brick.h) - (ball.y - ball.r);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft || minOverlap === overlapRight) {
        ball.vx *= -1;
        ball.x += (minOverlap === overlapLeft ? -1 : 1) * (ball.r - dist + 1);
      } else {
        ball.vy *= -1;
        ball.y += (minOverlap === overlapTop ? -1 : 1) * (ball.r - dist + 1);
      }

      sounds.hit(); vibrate(8);

      if (!brick.iron) {
        brick.hp--;
        brick.crackAnim = Math.min(1, brick.crackAnim + 0.5);
        if (brick.hp <= 0) {
          brick.alive = false;
          game.particles.emit(brick.x + brick.w / 2, brick.y + brick.h / 2, '#c4956a', 10);
          sounds.bounce();
        } else {
          game.particles.emit(ball.x, ball.y, '#ddc090', 4);
        }
      } else {
        // Iron spark
        game.particles.emit(ball.x, ball.y, '#aaccff', 5);
        // Slightly speed up ball on iron hit
        ball.vx *= 1.03;
        ball.vy *= 1.03;
      }
    }

    function update() {
      const { p1, p2, w, h } = game;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      // === Multi-ball spawning ===
      for (const [sec, count] of BALL_SCHEDULE) {
        if (elapsed >= sec && game.ballsSpawned < count) {
          const speed = BALL_SPEED + Math.min(game.scores.p1 + game.scores.p2, 6) * 0.3;
          game.balls.push(makeBall(w, h, speed, true));
          game.ballsSpawned = count;
          game.spawnFlash = 1.0;
        }
      }

      // Decay spawn flash
      if (game.spawnFlash > 0) game.spawnFlash -= 0.02;

      // === Spawn animation for new balls ===
      for (const ball of game.balls) {
        if (ball.spawnTimer > 0) {
          ball.spawnTimer -= 0.012;
          if (ball.spawnTimer <= 0) {
            ball.spawnTimer = 0;
            ball.active = true;
          }
          continue; // Don't move spawning balls
        }
      }

      // Nearest active ball for bot
      let nearestBall = game.balls.find(b => b.active) || game.balls[0];
      let nearestDist = Infinity;
      for (const b of game.balls) {
        if (!b.active) continue;
        const d = Math.abs(b.x - p2.x);
        if (d < nearestDist) { nearestDist = d; nearestBall = b; }
      }

      // P1 input
      if (touchRef.current.p1 !== null) {
        p1.y += (touchRef.current.p1 - p1.h / 2 - p1.y) * 0.15;
      }
      if (keysRef.current['w'] || keysRef.current['W']) p1.y -= PADDLE_SPEED;
      if (keysRef.current['s'] || keysRef.current['S']) p1.y += PADDLE_SPEED;

      // P2 input or bot
      if (mode === '1p') {
        const targetY = nearestBall.y - p2.h / 2;
        const diff = targetY - p2.y;
        const jitter = botDiffKey === 'easy' ? (Math.random() - 0.5) * 3 : 0;
        if (Math.abs(diff) > 5) {
          p2.y += Math.sign(diff) * Math.min(Math.abs(diff), botSpeed) + jitter;
        }
      } else {
        if (touchRef.current.p2 !== null) {
          p2.y += (touchRef.current.p2 - p2.h / 2 - p2.y) * 0.15;
        }
        if (keysRef.current['ArrowUp']) p2.y -= PADDLE_SPEED;
        if (keysRef.current['ArrowDown']) p2.y += PADDLE_SPEED;
      }

      p1.y = Math.max(0, Math.min(h - p1.h, p1.y));
      p2.y = Math.max(0, Math.min(h - p2.h, p2.y));

      // === Update each ball ===
      for (const ball of game.balls) {
        if (!ball.active) continue;

        // Trail
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 6) ball.trail.shift();

        ball.x += ball.vx;
        ball.y += ball.vy;

        // Walls
        if (ball.y - ball.r <= 0 || ball.y + ball.r >= h) {
          ball.vy *= -1;
          ball.y = Math.max(ball.r, Math.min(h - ball.r, ball.y));
          sounds.hit();
        }

        // P1 paddle hit
        if (ball.x - ball.r <= p1.x + p1.w && ball.y >= p1.y && ball.y <= p1.y + p1.h && ball.vx < 0) {
          ball.vx = Math.abs(ball.vx) * 1.05;
          ball.vy = ((ball.y - (p1.y + p1.h / 2)) / (p1.h / 2)) * 5;
          ball.x = p1.x + p1.w + ball.r;
          sounds.bounce(); vibrate(10);
          game.particles.emit(p1.x + p1.w, ball.y, COLORS.p1, 6);
        }

        // P2 paddle hit
        if (ball.x + ball.r >= p2.x && ball.y >= p2.y && ball.y <= p2.y + p2.h && ball.vx > 0) {
          ball.vx = -Math.abs(ball.vx) * 1.05;
          ball.vy = ((ball.y - (p2.y + p2.h / 2)) / (p2.h / 2)) * 5;
          ball.x = p2.x - ball.r;
          sounds.bounce(); vibrate(10);
          game.particles.emit(p2.x, ball.y, COLORS.p2, 6);
        }

        // Brick collisions
        for (const brick of game.bricks) {
          ballBrickCollision(ball, brick);
        }

        // Scoring
        if (ball.x < 0) {
          game.scores.p2++;
          setScores({ ...game.scores });
          sounds.score(); vibrate(20);
          game.particles.emit(0, ball.y, COLORS.p2, 12);
          if (game.scores.p2 >= WINNING_SCORE) {
            setGameOver(true);
            onGameEnd(mode === '1p' ? 'bot' : 2, Math.round((Date.now() - startTimeRef.current) / 1000));
            return;
          }
          resetBall(ball, game);
        }
        if (ball.x > w) {
          game.scores.p1++;
          setScores({ ...game.scores });
          sounds.score(); vibrate(20);
          game.particles.emit(w, ball.y, COLORS.p1, 12);
          if (game.scores.p1 >= WINNING_SCORE) {
            setGameOver(true);
            onGameEnd(1, Math.round((Date.now() - startTimeRef.current) / 1000));
            return;
          }
          resetBall(ball, game);
        }
      }

      game.particles.update();
    }

    // === Drawing Helpers ===
    function draw3DBrick(brick) {
      if (!brick.alive) return;
      const { x, y, w: bw, h: bh, iron, crackAnim } = brick;
      const depth = 4;
      const radius = 3;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(x + 4, y + 6, bw, bh, radius); ctx.fill();

      if (iron) {
        // === IRON BRICK (indestructible) ===
        // Side depth
        ctx.fillStyle = '#3a3a4a';
        ctx.beginPath(); ctx.roundRect(x, y + depth, bw, bh, radius); ctx.fill();

        // Top surface (metallic gradient)
        const metalGrad = ctx.createLinearGradient(x, y, x, y + bh);
        metalGrad.addColorStop(0, '#8899aa');
        metalGrad.addColorStop(0.3, '#aabbcc');
        metalGrad.addColorStop(0.5, '#ccdde8');
        metalGrad.addColorStop(0.7, '#aabbcc');
        metalGrad.addColorStop(1, '#667788');
        ctx.fillStyle = metalGrad;
        ctx.beginPath(); ctx.roundRect(x, y, bw, bh, radius); ctx.fill();

        // Metal border
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x, y, bw, bh, radius); ctx.stroke();

        // Bolts (4 corners)
        const boltOff = 4;
        ctx.fillStyle = '#667';
        for (const [bx, by] of [[x + boltOff, y + boltOff], [x + bw - boltOff, y + boltOff], [x + boltOff, y + bh - boltOff], [x + bw - boltOff, y + bh - boltOff]]) {
          ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI * 2); ctx.stroke();
        }

        // Center X pattern (riveted look)
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + bh / 2); ctx.lineTo(x + bw - 6, y + bh / 2);
        ctx.stroke();
      } else {
        // === BREAKABLE BRICK (wooden/clay) ===
        // Side depth
        ctx.fillStyle = '#6b4226';
        ctx.beginPath(); ctx.roundRect(x, y + depth, bw, bh, radius); ctx.fill();

        // Top surface (warm wood tone)
        const woodGrad = ctx.createLinearGradient(x, y, x + bw, y + bh);
        woodGrad.addColorStop(0, '#d4956b');
        woodGrad.addColorStop(0.5, '#c48050');
        woodGrad.addColorStop(1, '#b87040');
        ctx.fillStyle = woodGrad;
        ctx.beginPath(); ctx.roundRect(x, y, bw, bh, radius); ctx.fill();

        // Wood grain lines
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 3; i++) {
          const ly = y + 3 + (bh - 6) * (i / 2);
          ctx.beginPath(); ctx.moveTo(x + 2, ly); ctx.lineTo(x + bw - 2, ly); ctx.stroke();
        }

        // Border
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x, y, bw, bh, radius); ctx.stroke();

        // Crack overlay when damaged
        if (crackAnim > 0) {
          ctx.strokeStyle = `rgba(40,20,0,${0.3 + crackAnim * 0.5})`;
          ctx.lineWidth = 1.5;
          const cx = x + bw / 2, cy = y + bh / 2;
          // Lightning-bolt style crack
          ctx.beginPath();
          ctx.moveTo(cx - bw * 0.3, cy - bh * 0.3);
          ctx.lineTo(cx - 2, cy - 1);
          ctx.lineTo(cx + 3, cy + 2);
          ctx.lineTo(cx + bw * 0.3, cy + bh * 0.3);
          ctx.stroke();
          // Secondary crack
          ctx.beginPath();
          ctx.moveTo(cx + bw * 0.2, cy - bh * 0.4);
          ctx.lineTo(cx + 1, cy);
          ctx.lineTo(cx - bw * 0.15, cy + bh * 0.35);
          ctx.stroke();
        }
      }
    }

    function drawBall3D(ball) {
      const scale = ball.spawnTimer > 0 ? (1 - ball.spawnTimer) : 1;
      const r = ball.r * scale;
      if (r < 1) return;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(ball.x + 8 * scale, ball.y + 12 * scale, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trail
      if (ball.active) {
        for (let i = 0; i < ball.trail.length; i++) {
          const t = ball.trail[i];
          const progress = i / ball.trail.length;
          ctx.fillStyle = `rgba(255, 255, 255, ${progress * 0.25})`;
          ctx.shadowColor = '#fff';
          ctx.shadowBlur = 6 * progress;
          ctx.beginPath();
          ctx.arc(t.x, t.y, r * (0.3 + progress * 0.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Spawn glow ring
      if (ball.spawnTimer > 0) {
        ctx.strokeStyle = `rgba(255, 220, 100, ${ball.spawnTimer * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, r + 10 * ball.spawnTimer, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3D Metallic Sphere
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 8 * scale;
      const grad = ctx.createRadialGradient(
        ball.x - r * 0.3, ball.y - r * 0.3, 0,
        ball.x, ball.y, r
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#e0e0e0');
      grad.addColorStop(1, '#888888');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function draw() {
      const { p1, p2, w, h } = game;
      const time = Date.now() * 0.002;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      // 1. Dark table background
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, w, h);

      // 2. Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      ctx.beginPath();
      for (let i = 0; i < w; i += gridSize) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
      for (let i = 0; i < h; i += gridSize) { ctx.moveTo(0, i); ctx.lineTo(w, i); }
      ctx.stroke();

      // 3. Center line (Neon Energy Barrier)
      ctx.save();
      ctx.shadowColor = COLORS.line;
      ctx.shadowBlur = 15;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([15, 10]);
      ctx.lineDashOffset = -time * 15;
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 45, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // 4. Bricks
      for (const brick of game.bricks) {
        draw3DBrick(brick);
      }

      // 5. Paddles (3D Blocks)
      const draw3DPaddle = (p, color, isP1) => {
        const radius = 6;

        // Subtle shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.roundRect(p.x + 3, p.y + 4, p.w, p.h, radius); ctx.fill();

        // Main paddle surface
        const topGrad = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
        topGrad.addColorStop(0, isP1 ? '#ff4d4d' : '#4dffff');
        topGrad.addColorStop(1, isP1 ? '#cc0000' : '#00cccc');
        ctx.fillStyle = topGrad;
        ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, radius); ctx.fill();

        // Neon energy strip on the hitting side
        ctx.fillStyle = '#fff';
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillRect(isP1 ? p.x + p.w - 3 : p.x + 1, p.y + 10, 2, p.h - 20);
        ctx.shadowBlur = 0;
      };

      draw3DPaddle(p1, COLORS.p1, true);
      draw3DPaddle(p2, COLORS.p2, false);

      // 6. Balls (all)
      for (const ball of game.balls) {
        drawBall3D(ball);
      }

      // 7. Spawn flash
      if (game.spawnFlash > 0) {
        ctx.fillStyle = `rgba(255, 220, 100, ${game.spawnFlash * 0.08})`;
        ctx.fillRect(0, 0, w, h);
      }

      // 8. Particles
      game.particles.draw(ctx);

      // 9. Score HUD
      drawHUD(ctx, w, {
        p1Score: game.scores.p1,
        p2Score: game.scores.p2,
        label: `FIRST TO ${WINNING_SCORE}`,
      });

      // 10. Ball count indicator + timer
      const ballCount = game.balls.filter(b => b.active).length;
      if (ballCount > 1) {
        const ballLabel = `${ballCount} BALLS`;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.roundRect(w / 2 - 30, h - 22, 60, 16, 4); ctx.fill();
        drawText(ctx, ballLabel, w / 2, h - 13, { color: COLORS.gold, size: 9 });
      }
    }

    function gameLoop() {
      if (gameOver) return;
      update();
      draw();
      animId = requestAnimationFrame(gameLoop);
    }

    const onKeyDown = (e) => { keysRef.current[e.key] = true; };
    const onKeyUp = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onTouchMove = (e) => {
      e.preventDefault();
      for (const touch of e.touches) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        if (x < canvas.width / 2) touchRef.current.p1 = y;
        else touchRef.current.p2 = y;
      }
    };
    const onTouchEnd = (e) => {
      if (e.touches.length === 0) { touchRef.current.p1 = null; touchRef.current.p2 = null; }
    };
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const x = e.clientX - rect.left;
      if (x < canvas.width / 2) touchRef.current.p1 = y;
      else if (mode === '2p') touchRef.current.p2 = y;
    };

    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('mousemove', onMouseMove);
    gameLoop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [mode, difficulty, initGame, resetBall, onGameEnd, gameOver]);

  return (
    <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />
  );
}
