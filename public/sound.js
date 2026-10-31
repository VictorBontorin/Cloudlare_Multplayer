// Sons sintetizados com WebAudio (sem arquivos de áudio).
let C, M = localStorage.mudo === '1';
const ac = () => C || (C = new (window.AudioContext || window.webkitAudioContext)());
export const muted = () => M;
export const setMute = v => { M = v; localStorage.mudo = v ? '1' : '0'; };

function env(g, t, a, d, v) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(f, t, d, { type = 'sine', v = 0.3, f2 } = {}) {
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  env(g, t, 0.005, d, v);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + d + 0.05);
}
function noise(t, d, { v = 0.4, fc = 1800, q = 1, type = 'bandpass' } = {}) {
  const c = ac(), n = (c.sampleRate * d) | 0, buf = c.createBuffer(1, n, c.sampleRate), a = buf.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; f.type = type; f.frequency.value = fc; f.Q.value = q;
  env(g, t, 0.003, d, v);
  s.connect(f).connect(g).connect(c.destination);
  s.start(t);
}
const S = {
  move: t => { noise(t, 0.07, { fc: 900, v: 0.5 }); tone(180, t, 0.08, { f2: 90, v: 0.35 }); },
  capture: t => {
    noise(t, 0.16, { fc: 1400, v: 0.7 }); tone(140, t, 0.18, { f2: 50, v: 0.5 });
    noise(t + 0.03, 0.1, { fc: 3500, v: 0.3, type: 'highpass' });
  },
  castle: t => { S.move(t); S.move(t + 0.14); },
  check: t => { tone(880, t, 0.12, { type: 'square', v: 0.1 }); tone(1175, t + 0.1, 0.18, { type: 'square', v: 0.1 }); },
  mate: t => {
    noise(t, 0.6, { fc: 300, v: 0.8, type: 'lowpass' });
    tone(110, t, 1.2, { f2: 30, v: 0.6, type: 'sawtooth' });
    [660, 440, 330].forEach((f, i) => tone(f, t + i * 0.2, i === 2 ? 0.6 : 0.2, { type: 'square', v: 0.1 }));
  },
  promote: t => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.07, 0.25, { type: 'triangle', v: 0.2 }));
    noise(t, 0.3, { fc: 6000, v: 0.15, type: 'highpass' });
  },
  win: t => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.35, { type: 'triangle', v: 0.22 })),
  lose: t => [392, 330, 262].forEach((f, i) => tone(f, t + i * 0.2, 0.4, { v: 0.25 })),
  end: t => { tone(330, t, 0.3, { v: 0.2 }); tone(262, t + 0.15, 0.4, { v: 0.2 }); },
};
export function play(k, delay = 0) {
  if (M) return;
  try {
    const c = ac();
    if (c.state === 'suspended') c.resume();
    S[k](c.currentTime + delay / 1000);
  } catch {}
}
addEventListener('pointerdown', () => { try { const c = ac(); if (c.state === 'suspended') c.resume(); } catch {} }, { once: true });
