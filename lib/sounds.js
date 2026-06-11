'use client';

/**
 * SoundManager — Lightweight sound effects using Web Audio API
 * Zero file size: all sounds are synthesized in real-time
 * Reuses a small set of versatile effects across all games
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (mobile autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function isEnabled() {
  if (typeof window === 'undefined') return false;
  const settings = JSON.parse(localStorage.getItem('2pg_settings') || '{}');
  return settings.sound !== false;
}

// --- Sound Primitives ---

function playTone(freq, duration, type = 'sine', volume = 0.15, decay = true) {
  if (!isEnabled()) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    if (decay) {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    }
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) { /* ignore audio errors */ }
}

function playNoise(duration, volume = 0.08) {
  if (!isEnabled()) return;
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    // Bandpass for nicer noise
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch (e) { /* ignore */ }
}

// --- Exported Sound Effects ---

export const sounds = {
  /** Light tap/click — for UI buttons, card flips */
  tap() {
    playTone(800, 0.06, 'sine', 0.12);
  },

  /** Score point — ascending double beep */
  score() {
    playTone(523, 0.1, 'sine', 0.15);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.15), 80);
  },

  /** Win fanfare — triumphant ascending arpeggio */
  win() {
    playTone(523, 0.15, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 120);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 240);
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.15), 360);
  },

  /** Lose — descending tones */
  lose() {
    playTone(440, 0.2, 'sine', 0.12);
    setTimeout(() => playTone(349, 0.2, 'sine', 0.12), 150);
    setTimeout(() => playTone(262, 0.35, 'sine', 0.12), 300);
  },

  /** Hit/impact — short punchy thud */
  hit() {
    playTone(150, 0.12, 'square', 0.1);
    playNoise(0.06, 0.06);
  },

  /** Whoosh — for throws, swipes, movements */
  whoosh() {
    if (!isEnabled()) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) { /* ignore */ }
    playNoise(0.1, 0.04);
  },

  /** Countdown beep — single clean beep */
  countdown() {
    playTone(880, 0.1, 'sine', 0.1);
  },

  /** Go beep — higher pitched start signal */
  go() {
    playTone(1047, 0.2, 'sine', 0.15);
  },

  /** Bounce — for ball bounces, paddle hits */
  bounce() {
    playTone(300, 0.08, 'triangle', 0.1);
  },

  /** Pop — for card matches, selections */
  pop() {
    playTone(600, 0.05, 'sine', 0.12);
    setTimeout(() => playTone(900, 0.05, 'sine', 0.08), 40);
  },

  /** Error/miss — soft buzz */
  miss() {
    playTone(200, 0.15, 'sawtooth', 0.06);
  },

  /** Roll — for dice rolling */
  roll() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => playTone(200 + Math.random() * 300, 0.04, 'triangle', 0.06), i * 40);
    }
  },

  /** Slide — smooth glide for sliders */
  slide() {
    if (!isEnabled()) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) { /* ignore */ }
  },
};

/**
 * Initialize audio context on first user interaction
 * Call this early to avoid mobile audio restrictions
 */
export function initAudio() {
  if (typeof window === 'undefined') return;
  const handler = () => {
    getCtx();
    window.removeEventListener('touchstart', handler);
    window.removeEventListener('click', handler);
  };
  window.addEventListener('touchstart', handler, { once: true });
  window.addEventListener('click', handler, { once: true });
}

/**
 * Vibrate the device (if supported and enabled)
 */
export function vibrate(pattern = 15) {
  if (typeof window === 'undefined') return;
  const settings = JSON.parse(localStorage.getItem('2pg_settings') || '{}');
  if (settings.vibration === false) return;
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
