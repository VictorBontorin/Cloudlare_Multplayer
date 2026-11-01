// Robôs (Stockfish), níveis, progressão e skins.
export const LEVELS = Array.from({ length: 29 }, (_, i) => 200 + i * 100); // 200 ... 3000
const TIERS = [['🐣', 'Novato'], ['🐢', 'Aprendiz'], ['🐿️', 'Curioso'], ['🦊', 'Clubista'], ['🦉', 'Tático'],
  ['🐺', 'Estrategista'], ['🦅', 'Mestre'], ['🐉', 'Grande Mestre'], ['🤖', 'Máquina']];
export const tier = i => TIERS[Math.min(8, Math.floor(i / 3.3))];

// Do Stockfish: UCI_Elo vai de 1320 a 3190 (escala CCRL). Abaixo de 1320 não há calibração oficial:
// o robô usa o mínimo do Stockfish e erra de propósito com lances aleatórios (valores aproximados).
export function params(elo) {
  if (elo < 1320) return { elo: 1320, ms: 80, blunder: 0.08 + 0.82 * (1320 - elo) / 1120 };
  return { elo: Math.min(elo, 3190), ms: Math.round(400 + (elo - 1320) / 1870 * 1100), blunder: 0 };
}

export class Engine {
  constructor() {
    this.w = new Worker('/stockfish/stockfish-19-lite-single.js');
    this.on = null;
    this.w.onmessage = e => { if (this.on && typeof e.data === 'string') this.on(e.data); };
    this.ready = new Promise((res, rej) => {
      this.w.onerror = () => rej(new Error('stockfish'));
      this.cmd('uci', 'uciok').then(() => this.cmd('isready', 'readyok')).then(res, rej);
    });
  }
  cmd(c, wait) {
    return new Promise(res => {
      if (wait) this.on = l => { if (l.startsWith(wait)) { this.on = null; res(l); } };
      this.w.postMessage(c);
      if (!wait) res();
    });
  }
  async analyse(moves, depth = 12) {
    await this.ready;
    await this.cmd('setoption name UCI_LimitStrength value false');
    await this.cmd('setoption name MultiPV value 2');
    await this.cmd('position startpos' + (moves.length ? ' moves ' + moves.join(' ') : ''));
    const lines = {};
    const best = await new Promise(res => {
      this.on = l => {
        if (l.startsWith('info') && l.includes(' pv ')) {
          const mp = +(l.match(/multipv (\d+)/) || [0, 1])[1], c = l.match(/score cp (-?\d+)/), m = l.match(/score mate (-?\d+)/), pv = l.match(/ pv (\S+)/);
          lines[mp] = { cp: c ? +c[1] : null, mate: m ? +m[1] : null, mv: pv[1] };
        } else if (l.startsWith('bestmove')) { this.on = null; res(l.split(' ')[1]); }
      };
      this.w.postMessage('go depth ' + depth);
    });
    return { best, lines: [lines[1], lines[2]].filter(Boolean) };
  }
  async best(moves, p) {
    await this.ready;
    await this.cmd('setoption name UCI_LimitStrength value true');
    await this.cmd('setoption name UCI_Elo value ' + p.elo);
    await this.cmd('position startpos' + (moves.length ? ' moves ' + moves.join(' ') : ''));
    const l = await this.cmd('go movetime ' + p.ms, 'bestmove');
    return l.split(' ')[1];
  }
}

const W = (a, b, c, d) => [a, b, c, d];
export const SKINS = [
  { id: 'classico', nome: 'Clássico', at: 0, bd: ['#e6e0cf', '#4f6b6a'], w: W('#fbf8f0', '#d9d1bf', '#2b2118', '#6b5a45'), b: W('#5b5b66', '#1a1a20', '#000000', '#c8c8d0') },
  { id: 'madeira', nome: 'Madeira', at: 600, bd: ['#f0d9b5', '#b58863'], w: W('#f7e4bf', '#d9ab70', '#5a3a1a', '#8a5a2b'), b: W('#8a5a34', '#3a2210', '#150b04', '#d4a373'), ov: 'grain' },
  { id: 'oceano', nome: 'Oceano', at: 1000, bd: ['#cfe6f2', '#3b7ea1'], w: W('#ffffff', '#9fd9f2', '#0b4a6b', '#2a8ab8'), b: W('#2f8fc4', '#08324d', '#021824', '#9fe0ff'), gl: [2, '#8fd3f4', '#3b9ccf'] },
  { id: 'neon', nome: 'Neon', at: 1400, bd: ['#1a1f3a', '#0e1228'], w: W('#0f2a33', '#07161b', '#00e5ff', '#7ffcff'), b: W('#2a0f2a', '#14051a', '#ff2bd6', '#ff9bf0'), gl: [7, '#00e5ff', '#ff2bd6'] },
  { id: 'marmore', nome: 'Mármore', at: 1800, bd: ['#ececec', '#8d9aa5'], w: W('#ffffff', '#d3d9de', '#6b747b', '#9aa4ab'), b: W('#59636b', '#1f262b', '#0b0e10', '#b9c3ca') },
  { id: 'ouro', nome: 'Ouro Real', at: 2200, bd: ['#f3e5ab', '#a67c00'], w: W('#fff6b8', '#e2a900', '#6b4a00', '#b8860b'), b: W('#c9951a', '#4d3500', '#e8b923', '#ffe08a'), gl: [3, '#ffd54a', '#ffd54a'] },
  { id: 'obsidiana', nome: 'Obsidiana', at: 2600, bd: ['#4a4458', '#241f2e'], w: W('#f0eaff', '#a99be0', '#3a2f5c', '#6a58b8'), b: W('#403456', '#07050b', '#9b7bff', '#cbb8ff'), gl: [4, '#9b7bff', '#9b7bff'] },
  { id: 'dragao', nome: 'Dragão', at: 3000, bd: ['#f2b880', '#7a1f12'], w: W('#ffe9c4', '#f2a24a', '#7a1f12', '#b5381f'), b: W('#6a1a10', '#140403', '#ff6a2b', '#ffb36b'), ov: 'scales', gl: [5, '#ff9a4a', '#ff6a2b'] },
  { id: 'abobora', nome: 'Abóbora', ev: 'halloween', evn: 'Halloween', bd: ['#f2a65a', '#3b2054'], w: W('#ffc46b', '#ff7a1a', '#5a2a00', '#8a3b00'), b: W('#6b3fa0', '#1a0b2e', '#78ff6a', '#d8ffd0'), gl: [4, '#ff9a3a', '#78ff6a'] },
  { id: 'natal', nome: 'Natal', ev: 'natal', evn: 'Natal', bd: ['#f4f9f6', '#2e7d4f'], w: W('#ffffff', '#ffd6d6', '#b01c2e', '#d1495b'), b: W('#2f9e5b', '#0b3a20', '#ffd54a', '#fff2b0'), gl: [3, '#ffb3b3', '#ffd54a'] },
  { id: 'pascoa', nome: 'Páscoa', ev: 'pascoa', evn: 'Páscoa', bd: ['#fde7f3', '#c9a7e8'], w: W('#ffffff', '#ffd1ea', '#b05fa0', '#e08bc4'), b: W('#b79bff', '#5a3a9a', '#3a1f6e', '#e6dcff') },
  { id: 'carnaval', nome: 'Carnaval', ev: 'carnaval', evn: 'Carnaval', bd: ['#ffd54a', '#e91e8c'], w: W('#fff3a0', '#ffb300', '#7a1250', '#e91e8c'), b: W('#2fd0a5', '#0b5a49', '#ff4fa8', '#ffd54a'), gl: [4, '#ffd54a', '#ff4fa8'] },
  { id: 'junina', nome: 'Arraiá', ev: 'junina', evn: 'Festa Junina', bd: ['#f5deb3', '#c1642a'], w: W('#fff4d6', '#f0b66a', '#7a3b12', '#c1642a'), b: W('#d9534f', '#6b1414', '#ffd54a', '#ffe08a') },
];
const find = id => SKINS.find(s => s.id === id) || SKINS[0];
const KEY = 'xadrez_prog', TYPES = ['K', 'Q', 'R', 'B', 'N', 'P'];
const DEF = () => ({
  best: -1, board: 'classico', pieces: { K: 'classico', Q: 'classico', R: 'classico', B: 'classico', N: 'classico', P: 'classico' },
  avatar: '', title: 'novato', badges: [], titles: ['novato'], xs: [], ev: {},
});
export const prog = (() => {
  try {
    const o = JSON.parse(localStorage[KEY] || '{}'), d = DEF();
    return { ...d, ...o, pieces: { ...d.pieces, ...(o.pieces || {}) } };
  } catch { return DEF(); }
})();
export const hooks = { push: null };
const paint = () => { document.documentElement.dataset.board = find(prog.board).id; };
export const save = () => { localStorage[KEY] = JSON.stringify(prog); if (hooks.push) hooks.push(); };
export const replaceProg = o => {
  const d = DEF();
  for (const k of Object.keys(prog)) delete prog[k];
  Object.assign(prog, d, o, { pieces: { ...d.pieces, ...(o.pieces || {}) } });
  localStorage[KEY] = JSON.stringify(prog); paint();
};
export const bestElo = () => (prog.best < 0 ? 0 : LEVELS[prog.best]);
export const skinOpen = s => (s.ev ? prog.xs.includes(s.id) : s.at === 0 || bestElo() >= s.at);
export const setBoard = id => { prog.board = id; paint(); save(); };
export const setPiece = (t, id) => { prog.pieces[t] = id; save(); };
export const setAllPieces = id => { for (const t of TYPES) prog.pieces[t] = id; save(); };
paint();
