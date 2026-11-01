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

const V = x => x + '\uFE0E';
const FILLED = { K: V('♚'), Q: V('♛'), R: V('♜'), B: V('♝'), N: V('♞'), P: V('♟') };
const HOLLOW = { K: V('♔'), Q: V('♕'), R: V('♖'), B: V('♗'), N: V('♘'), P: V('♙') };
const DRAGON = { K: '👑', Q: '🔥', R: '🏯', B: '🧙', N: '🐉', P: '🥚' };
export const SKINS = [
  { id: 'classico', nome: 'Clássico', at: 0, set: FILLED },
  { id: 'madeira', nome: 'Madeira', at: 600, set: FILLED },
  { id: 'oceano', nome: 'Oceano', at: 1000, set: HOLLOW },
  { id: 'neon', nome: 'Neon', at: 1400, set: HOLLOW },
  { id: 'marmore', nome: 'Mármore', at: 1800, set: FILLED },
  { id: 'ouro', nome: 'Ouro Real', at: 2200, set: FILLED },
  { id: 'obsidiana', nome: 'Obsidiana', at: 2600, set: FILLED },
  { id: 'dragao', nome: 'Dragão', at: 3000, set: DRAGON },
];
const find = id => SKINS.find(s => s.id === id) || SKINS[0];
const KEY = 'xadrez_prog', TYPES = ['K', 'Q', 'R', 'B', 'N', 'P'];
const DEF = () => ({ best: -1, board: 'classico', pieces: { K: 'classico', Q: 'classico', R: 'classico', B: 'classico', N: 'classico', P: 'classico' } });
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
  Object.assign(prog, d, o, { pieces: { ...d.pieces, ...(o.pieces || {}) } });
  localStorage[KEY] = JSON.stringify(prog); paint();
};
export const bestElo = () => (prog.best < 0 ? 0 : LEVELS[prog.best]);
export const skinOpen = s => s.at === 0 || bestElo() >= s.at;
export const glyph = p => find(prog.pieces[p.toUpperCase()]).set[p.toUpperCase()];
export const pskin = p => find(prog.pieces[p.toUpperCase()]).id;
export const setBoard = id => { prog.board = id; paint(); save(); };
export const setPiece = (t, id) => { prog.pieces[t] = id; save(); };
export const setAllPieces = id => { for (const t of TYPES) prog.pieces[t] = id; save(); };
paint();
