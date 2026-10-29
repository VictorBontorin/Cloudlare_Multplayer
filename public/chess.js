// Motor de xadrez: lances legais, roque, en passant, promoção, SAN,
// xeque-mate, afogamento, material insuficiente, tripla repetição e regra dos 50 lances.
const F = 'abcdefgh';
export const sqName = s => F[s & 7] + (8 - (s >> 3));
export const sqIdx = n => (8 - n[1]) * 8 + F.indexOf(n[0]);
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const col = p => (p < 'a' ? 'w' : 'b');
const IN = (y, x) => y >= 0 && y < 8 && x >= 0 && x < 8;
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const OR = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export class Chess {
  constructor(fen = START) {
    const [pl, t, c, e, h, f] = fen.split(' ');
    this.b = [];
    for (const ch of pl) {
      if (ch === '/') continue;
      if (ch >= '1' && ch <= '8') for (let i = 0; i < +ch; i++) this.b.push('');
      else this.b.push(ch);
    }
    this.turn = t;
    this.cast = c === '-' ? '' : c;
    this.ep = e === '-' ? -1 : sqIdx(e);
    this.half = +h;
    this.full = +f;
    this.seen = {};
    this.rec();
  }

  fen() {
    let s = '';
    for (let r = 0; r < 8; r++) {
      let n = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.b[r * 8 + f];
        if (!p) n++;
        else { if (n) { s += n; n = 0; } s += p; }
      }
      if (n) s += n;
      if (r < 7) s += '/';
    }
    return `${s} ${this.turn} ${this.cast || '-'} ${this.ep < 0 ? '-' : sqName(this.ep)} ${this.half} ${this.full}`;
  }

  key() {
    const p = this.fen().split(' ');
    return p[0] + p[1] + p[2] + (this.moves().some(m => m.fl === 'e') ? p[3] : '-');
  }

  rec() { const k = this.key(); this.seen[k] = (this.seen[k] || 0) + 1; }

  att(s, by) {
    const b = this.b, r = s >> 3, f = s & 7, U = x => (by === 'w' ? x : x.toLowerCase());
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const d of [-1, 1]) if (IN(pr, f + d) && b[pr * 8 + f + d] === U('P')) return true;
    for (const [a, c] of KN) if (IN(r + a, f + c) && b[(r + a) * 8 + f + c] === U('N')) return true;
    for (const [a, c] of KG) if (IN(r + a, f + c) && b[(r + a) * 8 + f + c] === U('K')) return true;
    for (const [ds, ps] of [[DG, 'BQ'], [OR, 'RQ']])
      for (const [a, c] of ds) {
        let y = r + a, x = f + c;
        while (IN(y, x)) {
          const p = b[y * 8 + x];
          if (p) { if (col(p) === by && ps.includes(p.toUpperCase())) return true; break; }
          y += a; x += c;
        }
      }
    return false;
  }

  inCheck() { return this.att(this.b.indexOf(this.turn === 'w' ? 'K' : 'k'), this.turn === 'w' ? 'b' : 'w'); }

  gen() {
    const b = this.b, us = this.turn, o = [];
    const add = (from, to, piece, cap, fl, pr) => o.push({ from, to, piece, cap, fl, pr });
    for (let s = 0; s < 64; s++) {
      const p = b[s];
      if (!p || col(p) !== us) continue;
      const t = p.toUpperCase(), r = s >> 3, f = s & 7;
      if (t === 'P') {
        const d = us === 'w' ? -1 : 1, r1 = r + d, st = us === 'w' ? 6 : 1, last = us === 'w' ? 0 : 7;
        const push = (to, cap, fl) => {
          if (r1 === last) for (const q of 'qrbn') add(s, to, p, cap, fl, q);
          else add(s, to, p, cap, fl);
        };
        if (!b[r1 * 8 + f]) {
          push(r1 * 8 + f, '', '');
          if (r === st && !b[(r + 2 * d) * 8 + f]) add(s, (r + 2 * d) * 8 + f, p, '', 'd');
        }
        for (const dx of [-1, 1]) {
          const x = f + dx;
          if (x < 0 || x > 7) continue;
          const to = r1 * 8 + x;
          if (b[to] && col(b[to]) !== us) push(to, b[to], 'c');
          else if (to === this.ep) add(s, to, p, us === 'w' ? 'p' : 'P', 'e');
        }
      } else if (t === 'N' || t === 'K') {
        for (const [a, c] of t === 'N' ? KN : KG) {
          const y = r + a, x = f + c;
          if (!IN(y, x)) continue;
          const to = y * 8 + x, q = b[to];
          if (!q) add(s, to, p, '', '');
          else if (col(q) !== us) add(s, to, p, q, 'c');
        }
      } else {
        const ds = t === 'B' ? DG : t === 'R' ? OR : DG.concat(OR);
        for (const [a, c] of ds) {
          let y = r + a, x = f + c;
          while (IN(y, x)) {
            const to = y * 8 + x, q = b[to];
            if (!q) add(s, to, p, '', '');
            else { if (col(q) !== us) add(s, to, p, q, 'c'); break; }
            y += a; x += c;
          }
        }
      }
    }
    const e = us === 'w' ? 60 : 4, opp = us === 'w' ? 'b' : 'w', K = us === 'w' ? 'K' : 'k', Q = us === 'w' ? 'Q' : 'q';
    if (b[e] === K && !this.att(e, opp)) {
      if (this.cast.includes(K) && !b[e + 1] && !b[e + 2] && !this.att(e + 1, opp) && !this.att(e + 2, opp)) add(e, e + 2, K, '', 'k');
      if (this.cast.includes(Q) && !b[e - 1] && !b[e - 2] && !b[e - 3] && !this.att(e - 1, opp) && !this.att(e - 2, opp)) add(e, e - 2, K, '', 'q');
    }
    return o;
  }

  mk(m) {
    const b = this.b, w = this.turn === 'w', u = { c: this.cast, e: this.ep, h: this.half, f: this.full };
    b[m.to] = m.pr ? (w ? m.pr.toUpperCase() : m.pr) : m.piece;
    b[m.from] = '';
    if (m.fl === 'e') b[m.to + (w ? 8 : -8)] = '';
    if (m.fl === 'k') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; }
    if (m.fl === 'q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
    let c = this.cast;
    const strip = s => { c = c.split('').filter(x => !s.includes(x)).join(''); };
    if (m.piece === 'K') strip('KQ');
    if (m.piece === 'k') strip('kq');
    for (const x of [m.from, m.to]) {
      if (x === 63) strip('K'); if (x === 56) strip('Q');
      if (x === 7) strip('k'); if (x === 0) strip('q');
    }
    this.cast = c;
    this.ep = m.fl === 'd' ? (m.from + m.to) / 2 : -1;
    this.half = m.piece.toUpperCase() === 'P' || m.cap ? 0 : this.half + 1;
    if (!w) this.full++;
    this.turn = w ? 'b' : 'w';
    return u;
  }

  un(m, u) {
    const b = this.b;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    const w = this.turn === 'w';
    b[m.from] = m.piece;
    b[m.to] = m.fl === 'e' ? '' : m.cap;
    if (m.fl === 'e') b[m.to + (w ? 8 : -8)] = m.cap;
    if (m.fl === 'k') { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = ''; }
    if (m.fl === 'q') { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = ''; }
    this.cast = u.c; this.ep = u.e; this.half = u.h; this.full = u.f;
  }

  moves() {
    const o = [];
    for (const m of this.gen()) {
      const u = this.mk(m);
      const k = this.b.indexOf(this.turn === 'w' ? 'k' : 'K');
      if (!this.att(k, this.turn)) o.push(m);
      this.un(m, u);
    }
    return o;
  }

  targets(n) {
    const f = sqIdx(n);
    return this.moves().filter(m => m.from === f).map(m => ({ to: sqName(m.to), pr: m.pr }));
  }

  san(m, legal) {
    if (m.fl === 'k') return 'O-O';
    if (m.fl === 'q') return 'O-O-O';
    const t = m.piece.toUpperCase();
    let s = '';
    if (t === 'P') { if (m.cap) s = F[m.from & 7]; }
    else {
      s = t;
      const o = legal.filter(x => x !== m && x.piece === m.piece && x.to === m.to);
      if (o.length) {
        const sf = o.some(x => (x.from & 7) === (m.from & 7)), sr = o.some(x => (x.from >> 3) === (m.from >> 3));
        s += !sf ? F[m.from & 7] : !sr ? 8 - (m.from >> 3) : sqName(m.from);
      }
    }
    if (m.cap) s += 'x';
    s += sqName(m.to);
    if (m.pr) s += '=' + m.pr.toUpperCase();
    return s;
  }

  // Executa um lance { from:'e2', to:'e4', promotion:'q' }. Retorna o registro do lance ou null se ilegal.
  move({ from, to, promotion }) {
    const legal = this.moves(), f = sqIdx(from), t = sqIdx(to);
    const m = legal.find(x => x.from === f && x.to === t && (!x.pr || x.pr === (promotion || 'q')));
    if (!m) return null;
    let san = this.san(m, legal);
    this.mk(m);
    san += this.inCheck() ? (this.moves().length ? '+' : '#') : '';
    this.rec();
    return { from, to, san, promotion: m.pr || undefined };
  }

  insufficient() {
    const p = this.b.filter(x => x && x.toUpperCase() !== 'K');
    if (!p.length) return true;
    if (p.length === 1) return 'BN'.includes(p[0].toUpperCase());
    if (p.every(x => x.toUpperCase() === 'B')) {
      const cs = new Set();
      this.b.forEach((x, i) => { if (x && x.toUpperCase() === 'B') cs.add(((i >> 3) + (i & 7)) % 2); });
      return cs.size === 1;
    }
    return false;
  }

  // true se o lado c não tem como dar mate (usado para tempo esgotado)
  lacksMating(c) {
    const p = this.b.filter(x => x && col(x) === c && x.toUpperCase() !== 'K');
    return p.length === 0 || (p.length === 1 && 'BN'.includes(p[0].toUpperCase()));
  }

  result() {
    if (!this.moves().length)
      return this.inCheck()
        ? { over: true, winner: this.turn === 'w' ? 'b' : 'w', reason: 'checkmate' }
        : { over: true, winner: null, reason: 'stalemate' };
    if (this.insufficient()) return { over: true, winner: null, reason: 'insufficient' };
    if (this.seen[this.key()] >= 3) return { over: true, winner: null, reason: 'threefold' };
    if (this.half >= 100) return { over: true, winner: null, reason: 'fifty' };
    return { over: false };
  }
}
