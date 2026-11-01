// Análise de partidas: avalia cada lance com o Stockfish e classifica (Brilhante ... Capivarada).
import { Chess, sqName } from '/chess.js';
import { Engine, glyph, pskin } from '/bot.js';

const $ = s => document.querySelector(s);
const F = 'abcdefgh';
export const CLS = {
  bril: ['Brilhante', '!!', '#1bbacb'], great: ['Ótimo', '!', '#5b8bb2'], best: ['Melhor', '★', '#6fa83b'],
  exc: ['Excelente', '👍', '#8fb84a'], good: ['Bom', '✓', '#98ab7e'], book: ['Livro', '📖', '#a88865'],
  inac: ['Imprecisão', '?!', '#d9a521'], mist: ['Erro', '?', '#e8913a'], blun: ['Capivarada', '??', '#d63b3b'],
};
const ORDER = ['bril', 'great', 'best', 'exc', 'good', 'book', 'inac', 'mist', 'blun'];

// Livro de aberturas simples (lances em notação SAN). Vale por posição, então transposições também contam.
const BOOK = `Ruy Lopez|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O
Italiana|e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O
Dois Cavalos|e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5
Escocesa|e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7
Gambito Evans|e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O
Quatro Cavalos|e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6
Petrov|e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6
Filidor|e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7
Vienense|e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7
Gambito do Rei|e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6
Siciliana Najdorf|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6
Siciliana Dragão|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6
Siciliana Clássica|e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Bg5 e6 Qd2 a6
Siciliana Sveshnikov|e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5
Siciliana Fechada|e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6
Siciliana Alapin|e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6
Francesa Clássica|e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O
Francesa Avanço|e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 Nh6
Francesa Tarrasch|e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2 cxd4 cxd4 f6
Caro-Kann|e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7
Caro-Kann Avanço|e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Qb6
Pirc|e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O Bg4
Alekhine|e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7
Escandinava|e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5
Moderna|e4 g6 d4 Bg7 Nc3 d6 Nf3 Nf6 Be2 O-O
Gambito da Dama Recusado|d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6
Gambito da Dama Aceito|d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6
Eslava|d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4
Semi-Eslava|d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5
Nimzo-Índia|d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4 Qc7
Índia do Rei|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7
Grünfeld|d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5
Índia da Dama|d4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O Nc3 Ne4
Catalã|d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6
Londres|d4 d5 Nf3 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O
Benoni|d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7
Holandesa|d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6
Inglesa|c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6
Inglesa Simétrica|c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 e6 O-O Nge7
Réti|Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O b3 c5
Bird|f4 d5 Nf3 Nf6 e3 g6 Be2 Bg7 O-O O-O d3 c5
Larsen|b3 e5 Bb2 Nc6 e3 d5 Bb5 Bd6 f4 Qh4+`;

const mv = m => ({ from: sqName(m.from), to: sqName(m.to), promotion: m.pr });
function fromSan(g, tok) {
  const legal = g.moves(), t = tok.replace(/[+#]/g, '');
  return legal.find(m => g.san(m, legal).replace(/[+#]/g, '') === t);
}
const pkey = g => g.fen().split(' ').slice(0, 3).join(' ');
let book;
function buildBook() {
  if (book) return book;
  book = new Map();
  for (const ln of BOOK.split('\n')) {
    const [name, line] = ln.split('|'), g = new Chess();
    for (const t of line.split(' ')) {
      const m = fromSan(g, t);
      if (!m) break;
      g.move(mv(m));
      const k = pkey(g);
      if (!book.has(k)) book.set(k, name);
    }
  }
  return book;
}

const wp = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const val = l => (l.mate != null ? (l.mate > 0 ? 1 : -1) * (10000 - Math.abs(l.mate) * 10) : l.cp);
const acc = l => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * l) - 3.1669));
const PV = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
const sanOf = (g, legal, uci) => {
  const m = legal.find(x => sqName(x.from) + sqName(x.to) + (x.pr || '') === uci);
  return m ? g.san(m, legal) : '';
};

export async function analyze(moves, onProg) {
  const e = new Engine();
  try {
    const n = moves.length, g = new Chess(), ev = [];
    const uci = moves.map(m => m.from + m.to + (m.promotion || ''));
    for (let i = 0; i <= n; i++) {
      const res = g.result(), s = i % 2 ? -1 : 1;
      if (res.over) ev.push({ cp: res.winner ? (res.winner === 'w' ? 1 : -1) * 20000 : 0, best: null, lines: [] });
      else {
        const r = await e.analyse(uci.slice(0, i), 12);
        ev.push({ cp: s * val(r.lines[0] || { cp: 0 }), best: r.best, lines: r.lines.map(l => ({ cp: s * val(l), mv: l.mv })) });
      }
      if (onProg) onProg(i, n);
      if (i < n) g.move(moves[i]);
    }
    const h = new Chess(), bk = buildBook(), out = { c: [], b: [], o: [], w: ev.map(x => Math.round(wp(x.cp))), a: {} };
    const sum = { w: [], b: [] };
    for (let i = 0; i < n; i++) {
      const m = moves[i], side = i % 2 ? 'b' : 'w', s = i % 2 ? -1 : 1, legal = h.moves();
      const lm = legal.find(x => sqName(x.from) === m.from && sqName(x.to) === m.to && (!x.pr || x.pr === (m.promotion || 'q')));
      const Wb = wp(s * ev[i].cp), Wa = wp(s * ev[i + 1].cp), loss = Math.max(0, Wb - Wa);
      const played = m.from + m.to + (m.promotion || ''), isBest = played === ev[i].best;
      const bestSan = ev[i].best && ev[i].best !== '(none)' ? sanOf(h, legal, ev[i].best) : '';
      h.move(m);
      const name = bk.get(pkey(h));
      let c;
      if (i < 24 && name) c = 'book';
      else if (isBest || loss <= 2) {
        let sac = false;
        if (lm && !lm.pr && PV[lm.piece.toUpperCase()]) {
          const gain = PV[(lm.cap || '').toUpperCase()] || 0;
          sac = PV[lm.piece.toUpperCase()] - gain >= 2 && h.moves().some(x => x.to === lm.to && x.cap);
        }
        const second = ev[i].lines[1];
        if (sac && loss <= 3 && Wb <= 85 && Wa >= 40) c = 'bril';
        else if (isBest && second && Wb < 90 && Wb - wp(s * second.cp) >= 12) c = 'great';
        else c = isBest ? 'best' : 'exc';
      } else c = loss <= 5 ? 'good' : loss <= 10 ? 'inac' : loss <= 20 ? 'mist' : 'blun';
      out.c.push(c); out.b.push(bestSan); out.o.push(c === 'book' ? name : '');
      sum[side].push(c === 'book' ? 100 : acc(loss));
    }
    for (const k of ['w', 'b']) out.a[k] = sum[k].length ? Math.round(sum[k].reduce((a, b) => a + b, 0) / sum[k].length * 10) / 10 : 0;
    return out;
  } finally { e.w.terminate(); }
}

function draw(el, g, last, bot, badge) {
  el.innerHTML = '';
  for (let i = 0; i < 64; i++) {
    const r = bot === 'w' ? i >> 3 : 7 - (i >> 3), f = bot === 'w' ? i & 7 : 7 - (i & 7);
    const n = F[f] + (8 - r), p = g.b[r * 8 + f], d = document.createElement('div');
    d.className = 'sq ' + ((r + f) % 2 ? 'd' : 'l') + (p ? ' p' + (p < 'a' ? 'w' : 'b') : '') + (last && (n === last.from || n === last.to) ? ' lm' : '');
    d.innerHTML = (p ? `<b data-ps="${pskin(p)}">${glyph(p)}</b>` : '') +
      (badge && last && n === last.to ? `<i class="bgd" style="background:${badge[2]}">${badge[1]}</i>` : '');
    el.append(d);
  }
}

export async function openAnalysis(game, opt = {}) {
  const V = $('#aview'), moves = game.moves, n = moves.length, bot = game.color || 'w';
  $('#alist').hidden = true; V.hidden = false;
  V.innerHTML = `<div class="an"><div class="anl"><div class="abd"><div class="brd" id="abrd"></div></div>
    <div class="row anav"><button id="a0">⏮</button><button id="a1">◀</button><button id="a2">▶</button><button id="a3">⏭</button></div></div>
    <div class="anr"><div id="aprog" class="mt"></div><div id="asum"></div><svg id="agr" viewBox="0 0 300 60" preserveAspectRatio="none"></svg>
    <div id="anote"></div><div id="amv"></div><button id="aback">Voltar</button></div></div>`;
  const q = id => V.querySelector(id), run = { on: true };
  let ply = 0, an = game.an || null;

  const at = p => { const g = new Chess(); for (let i = 0; i < p; i++) g.move(moves[i]); return g; };
  function show(p) {
    ply = Math.max(0, Math.min(n, p));
    const g = at(ply), last = ply ? moves[ply - 1] : null, c = an && ply ? an.c[ply - 1] : null;
    draw(q('#abrd'), g, last, bot, c ? CLS[c] : null);
    let t = ply ? `<b>${Math.ceil(ply / 2)}${ply % 2 ? '.' : '...'} ${moves[ply - 1].san}</b>` : 'Posição inicial';
    if (c) {
      t += ` — <span class="bg" style="background:${CLS[c][2]}">${CLS[c][1]}</span>${CLS[c][0]}`;
      if (c === 'book' && an.o[ply - 1]) t += ` (${an.o[ply - 1]})`;
      if (['inac', 'mist', 'blun'].includes(c) && an.b[ply - 1]) t += `. Melhor era <b>${an.b[ply - 1]}</b>`;
    }
    q('#anote').innerHTML = t;
    V.querySelectorAll('#amv button').forEach(b => b.classList.toggle('on', +b.dataset.p === ply));
    const mk = q('#agm');
    if (mk) { const x = n ? ply / n * 300 : 0; mk.setAttribute('x1', x); mk.setAttribute('x2', x); }
  }
  function list() {
    const L = q('#amv'); L.innerHTML = '';
    moves.forEach((m, i) => {
      if (i % 2 === 0) { const s = document.createElement('span'); s.className = 'mt'; s.textContent = i / 2 + 1 + '.'; L.append(s); }
      const b = document.createElement('button'), c = an && an.c[i];
      b.dataset.p = i + 1;
      if (c) { const k = document.createElement('span'); k.className = 'bg'; k.style.background = CLS[c][2]; k.textContent = CLS[c][1]; b.append(k); }
      b.append(document.createTextNode(m.san));
      b.onclick = () => show(i + 1);
      L.append(b);
    });
  }
  function summary() {
    const cnt = { w: {}, b: {} };
    an.c.forEach((c, i) => { const s = i % 2 ? 'b' : 'w'; cnt[s][c] = (cnt[s][c] || 0) + 1; });
    q('#asum').innerHTML = '<table class="asm"><tr><th></th><th>Brancas</th><th>Pretas</th></tr>' +
      `<tr><td>Precisão</td><td><b>${an.a.w}</b></td><td><b>${an.a.b}</b></td></tr>` +
      ORDER.map(k => `<tr><td><span class="bg" style="background:${CLS[k][2]}">${CLS[k][1]}</span>${CLS[k][0]}</td><td>${cnt.w[k] || 0}</td><td>${cnt.b[k] || 0}</td></tr>`).join('') + '</table>';
  }
  function graph() {
    const pts = an.w.map((v, i) => `${(n ? i / n * 300 : 0).toFixed(1)},${(60 - v * 0.6).toFixed(1)}`);
    q('#agr').innerHTML = `<polygon points="0,60 ${pts.join(' ')} 300,60" fill="#e9eef0" fill-opacity=".85"/>` +
      '<line x1="0" x2="300" y1="30" y2="30" stroke="#888" stroke-dasharray="2 3"/><line id="agm" y1="0" y2="60" stroke="#f2c14e" stroke-width="2"/>';
  }

  q('#a0').onclick = () => show(0); q('#a1').onclick = () => show(ply - 1);
  q('#a2').onclick = () => show(ply + 1); q('#a3').onclick = () => show(n);
  q('#aback').onclick = () => {
    run.on = false; document.onkeydown = null;
    V.hidden = true; $('#alist').hidden = false;
    if (opt.back) opt.back();
  };
  document.onkeydown = e => {
    if (V.hidden) return;
    if (e.key === 'ArrowLeft') show(ply - 1); else if (e.key === 'ArrowRight') show(ply + 1);
  };

  list(); show(0);
  if (!an) {
    q('#aprog').textContent = 'Analisando… 0%';
    try {
      an = await analyze(moves, i => {
        if (!run.on) throw new Error('stop');
        q('#aprog').textContent = `Analisando… ${Math.round(i / (n + 1) * 100)}%`;
      });
      game.an = an;
      if (opt.save) opt.save(game);
    } catch {
      if (run.on) q('#aprog').textContent = 'Não foi possível analisar (motor indisponível).';
      return;
    }
  }
  if (!run.on) return;
  q('#aprog').textContent = '';
  summary(); graph(); list(); show(ply);
}
