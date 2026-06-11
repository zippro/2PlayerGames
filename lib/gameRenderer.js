/**
 * GameRenderer — Shared premium canvas drawing toolkit
 * Provides consistent high-quality rendering across all games
 */

// ─── Color Palette (shared across all games) ───
export const COLORS = {
  bg: '#0d1117',
  surface: '#161b22',
  line: 'rgba(255,255,255,0.06)',
  lineLight: 'rgba(255,255,255,0.12)',
  p1: '#FF6B6B',
  p1Light: '#FF9E9E',
  p2: '#4ECDC4',
  p2Light: '#7EDDD5',
  white: '#ffffff',
  gold: '#FFB830',
  green: '#4ADE80',
  red: '#EF4444',
  text: 'rgba(255,255,255,0.85)',
  textDim: 'rgba(255,255,255,0.4)',
  textFaint: 'rgba(255,255,255,0.15)',
  shadow: 'rgba(0,0,0,0.5)',
};

// ─── Background ───
export function drawBg(ctx, w, h) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
}

// ─── Rounded Rectangle ───
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ─── Filled Rounded Rectangle with optional shadow ───
export function drawBox(ctx, x, y, w, h, r, fill, shadowColor) {
  if (shadowColor) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// ─── Circle with optional glow ───
export function drawCircle(ctx, x, y, r, fill, glowColor, glowSize) {
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowSize || 16;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

// ─── Line ───
export function drawLine(ctx, x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// ─── Dashed Line ───
export function drawDashed(ctx, x1, y1, x2, y2, color, width, dash) {
  ctx.setLineDash(dash || [6, 6]);
  drawLine(ctx, x1, y1, x2, y2, color, width);
  ctx.setLineDash([]);
}

// ─── Text ───
export function drawText(ctx, text, x, y, { color, size, font, align, baseline, shadow } = {}) {
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = color || COLORS.text;
  ctx.font = `${size || 14}px ${font || "'Lilita One', sans-serif"}`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = baseline || 'middle';
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// ─── Score HUD (consistent across all games) ───
export function drawHUD(ctx, w, { p1Score, p2Score, label, sublabel, mode }) {
  // P1 score (left)
  drawText(ctx, `${p1Score}`, 20, 24, { color: COLORS.p1, size: 24, align: 'left', shadow: true });

  // P2 score (right)
  drawText(ctx, `${p2Score}`, w - 20, 24, { color: COLORS.p2, size: 24, align: 'right', shadow: true });

  // Center label
  if (label) {
    drawText(ctx, label, w / 2, 20, { color: COLORS.text, size: 13, shadow: true });
  }
  if (sublabel) {
    drawText(ctx, sublabel, w / 2, 40, {
      color: sublabel.includes('1') || sublabel.includes('YOU') ? COLORS.p1 : COLORS.p2,
      size: 12,
      shadow: true,
    });
  }
}

// ─── Hint text at bottom ───
export function drawHint(ctx, w, h, text) {
  drawText(ctx, text, w / 2, h - 18, { color: COLORS.textDim, size: 12, font: "'Inter', sans-serif" });
}

// ─── Particle System ───
export class Particles {
  constructor() {
    this.items = [];
  }

  emit(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 3;
      this.items.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        r: 2 + Math.random() * 3,
        color,
      });
    }
  }

  update() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.life -= p.decay;
      if (p.life <= 0) {
        this.items.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Score Flash (floating +N text) ───
export class ScoreFlash {
  constructor() {
    this.items = [];
  }

  add(x, y, text, color) {
    this.items.push({ x, y, text, color, life: 1, startY: y });
  }

  update() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= 0.018;
      f.y = f.startY - (1 - f.life) * 40;
      if (f.life <= 0) this.items.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const f of this.items) {
      ctx.globalAlpha = f.life;
      drawText(ctx, f.text, f.x, f.y, {
        color: f.color,
        size: 22 + (1 - f.life) * 8,
        shadow: true,
      });
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Countdown Overlay ───
export function drawCountdown(ctx, w, h, value) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  drawText(ctx, `${value}`, w / 2, h / 2, { color: COLORS.gold, size: 72, shadow: true });
}

// ─── "GOAL!" / "HIT!" flash overlay ───
export function drawFlashBanner(ctx, w, h, text, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, w * 0.15, h * 0.42, w * 0.7, 56, 14);
  ctx.fill();
  drawText(ctx, text, w / 2, h * 0.42 + 28, { color: color || COLORS.gold, size: 28, shadow: true });
}
