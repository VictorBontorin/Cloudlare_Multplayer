import { Chess, sqName, sqIdx } from '/chess.js';
import { play, muted, setMute } from '/sound.js';
import { LEVELS, tier, params, Engine, SKINS, prog, save, bestElo, skinOpen, setBoard, setPiece, setAllPieces, replaceProg, hooks } from '/bot.js';
import { openAnalysis, parsePgn, draw } from '/analysis.js';
import { pieceSVG } from '/pieces.js';
import { TITLE_TEXT } from '/events.js';
import { renderProfile, checkAwards, eventWin, grant } from '/profile.js';

const $ = s => document.querySelector(s);
const bt = p => pieceSVG(p);
const V = { Q: 9, R: 5, B: 3, N: 3, P: 1 }, N0 = { Q: 1, R: 2, B: 2, N: 2, P: 8 };
const FILES = 'abcdefgh';
const WHY = {
  checkmate: 'xeque-mate', stalemate: 'afogamento', insufficient: 'material insuficiente',
  threefold: 'tripla repetição', fifty: 'regra dos 50 lances', resign: 'desistência',
  timeout: 'tempo esgotado', agreement: 'acordo', aborted: 'partida abortada',
};

let ws, S, g, code, off = 0, sel = null, flip = false, chatN = 0, anim = null, local = false, lg, LC, lastGame = null;
const cor = p => (p < 'a' ? 'w' : 'b');
const me = () => (S.you === 'w' || S.you === 'b' ? S.you : null);
const myTurn = () => S.status === 'playing' && me() === g.turn;
const send = o => (local ? localSend(o) : ws && ws.readyState === 1 && ws.send(JSON.stringify(o)));

function toast(t) {
  const e = $('#toast');
  e.textContent = t; e.classList.add('show');
  clearTimeout(e.h); e.h = setTimeout(() => e.classList.remove('show'), 2500);
}

// ---------- home ----------
$('#name').value = localStorage.tu || localStorage.nome || '';
const saveName = () => { localStorage.nome = $('#name').value.trim() || 'Anônimo'; };
$('#create').onclick = async () => {
  saveName();
  const [min, inc] = $('#tc').value.split('+');
  try {
    const r = await fetch('/api/create', { method: 'POST', body: JSON.stringify({ min, inc, color: $('#clr').value }) });
    connect((await r.json()).code);
  } catch { toast('Não foi possível criar a partida.'); }
};
$('#code').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
$('#join').onclick = () => {
  const c = $('#code').value.trim().toUpperCase();
  if (c.length !== 6) return toast('O código tem 6 caracteres.');
  saveName(); connect(c);
};
const m = location.pathname.match(/^\/sala\/([A-Za-z0-9]{6})$/);
if (m) {
  $('#code').value = m[1].toUpperCase();
  if (localStorage.nome) connect(m[1].toUpperCase());
}

// ---------- conexão ----------
function connect(c) {
  code = c;
  $('#home').hidden = true; $('#game').hidden = false;
  history.replaceState(0, '', '/sala/' + c);
  $('#rcode').textContent = c;
  open();
}
function open() {
  const tk = 'tk_' + code;
  ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws/' + code);
  ws.onopen = () => send({ t: 'join', name: localStorage.nome || 'Anônimo', token: localStorage[tk], title: prog.title });
  ws.onmessage = e => {
    if (e.data === 'pong') return;
    const d = JSON.parse(e.data);
    if (d.t === 'joined') { if (d.token) localStorage[tk] = d.token; }
    else if (d.t === 'state') update(d);
    else if (d.t === 'err') toast(d.m);
  };
  ws.onclose = () => {
    if (S) setTimeout(open, 1500);
    else { alert('Sala não encontrada.'); location.href = '/'; }
  };
}
setInterval(() => ws && ws.readyState === 1 && ws.send('ping'), 25000);

function update(d) {
  const old = S, og = g;
  S = d; off = d.now - Date.now();
  g = new Chess();
  d.moves.forEach(mv => g.move(mv));
  sel = null; anim = null;
  if (old && og && old.game === d.game && d.moves.length === old.moves.length + 1) {
    const mv = d.moves[d.moves.length - 1], pc = og.b[sqIdx(mv.from)], tp = og.b[sqIdx(mv.to)];
    let cap = tp, capSq = tp ? mv.to : null;
    if (!tp && pc.toUpperCase() === 'P' && mv.from[0] !== mv.to[0]) { capSq = mv.to[0] + mv.from[1]; cap = og.b[sqIdx(capSq)]; }
    anim = { mv, cap: capSq ? cap : null, capSq, rook: null };
    if (pc.toUpperCase() === 'K' && Math.abs(mv.from.charCodeAt(0) - mv.to.charCodeAt(0)) === 2) {
      const k = mv.to[0] === 'g';
      anim.rook = { from: (k ? 'h' : 'a') + mv.from[1], to: (k ? 'f' : 'd') + mv.from[1] };
    }
  }
  const doMate = old && old.status === 'playing' && d.status === 'over' && d.result.reason === 'checkmate';
  const delay = anim ? 1000 : 0;
  if (anim) {
    const mv = anim.mv;
    play(mv.promotion ? 'promote' : anim.rook ? 'castle' : anim.cap ? 'capture' : 'move', 300);
    if (doMate) play('mate', delay); else if (g.inCheck()) play('check', 450);
  }
  if (old && old.status === 'playing' && d.status === 'over') {
    const w = d.result.winner, m = local && !LC.bot ? null : me();
    play(w && m ? (w === m ? 'win' : 'lose') : 'end', doMate ? 2400 : anim ? 600 : 100);
    if (d.moves.length >= 2 && (local || me())) { lastGame = gameRecord(d); putGame(lastGame); }
  }
  render();
  if (doMate) setTimeout(() => mate(d.result.winner), delay);
}

// ---------- animações ----------
const still = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const cell = (n, bot) => {
  const f = FILES.indexOf(n[0]), r = 8 - n[1];
  return bot === 'w' ? { c: f, r } : { c: 7 - f, r: 7 - r };
};

function fxBox(P, extra = '') {
  const box = document.createElement('div');
  box.className = 'fxs' + extra;
  box.style.left = P.c * 12.5 + '%'; box.style.top = P.r * 12.5 + '%';
  $('#fx').append(box);
  return box;
}

function dust(P, delay) {
  if (still()) return;
  const box = fxBox(P), r = document.createElement('div');
  r.className = 'dust'; box.append(r);
  r.animate([{ transform: 'scale(.3)', opacity: 0.7 }, { transform: 'scale(1.35)', opacity: 0 }], { duration: 380, delay, fill: 'both' });
  setTimeout(() => box.remove(), delay + 450);
}

function burst(P, sz) {
  if (still()) return;
  const box = fxBox(P), ring = document.createElement('div');
  ring.className = 'ring'; box.append(ring);
  ring.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(2.1)', opacity: 0 }], { duration: 600, fill: 'both' });
  for (let i = 0; i < 8; i++) {
    const k = document.createElement('i'), ang = i * Math.PI / 4;
    k.className = 'spk'; k.textContent = '✦'; box.append(k);
    k.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * sz * .75}px,${Math.sin(ang) * sz * .75}px) scale(1.3) rotate(120deg)`, opacity: 0 }],
      { duration: 650, easing: 'ease-out', fill: 'both' });
  }
  setTimeout(() => box.remove(), 800);
}

function playAnim(a, bot) {
  const calm = still(), B = $('#board'), sz = B.clientWidth / 8, mv = a.mv;
  const sq = P => B.children[P.r * 8 + P.c];
  const hop = (from, to, kind) => {
    const F = cell(from, bot), T = cell(to, bot), d = sq(T), p = d.querySelector('.pc');
    if (!p) return;
    const dx = (F.c - T.c) * sz, dy = (F.r - T.r) * sz;
    d.style.zIndex = 6;
    let k, dur;
    if (kind === 'P' || calm) { // movimento leve: só desliza, com um respiro de escala no meio
      dur = calm ? 170 : 240;
      k = [{ transform: `translate(${dx}px,${dy}px) scale(1)` },
        { transform: `translate(${dx * .5}px,${dy * .5}px) scale(${calm ? 1 : 1.07})`, offset: .5 },
        { transform: 'translate(0,0) scale(1)' }];
    } else {
      const kn = kind === 'N', up = kn ? -sz * .5 : -sz * .12, big = kn ? 1.35 : 1.15;
      dur = kn ? 420 : 340;
      k = [
        { transform: `translate(${dx}px,${dy}px) scale(1)`, offset: 0 },
        { transform: `translate(${dx * .8}px,${dy * .8 + up * .5}px) scale(${big})`, offset: .2 },
        { transform: `translate(${dx * .4}px,${dy * .4 + up}px) scale(${big})`, offset: .5 },
        { transform: `translate(0,${up * .3}px) scale(${big * .98})`, offset: .8 },
        { transform: 'translate(0,0) scale(1.1,.88)', offset: .9 },
        { transform: 'translate(0,0) scale(1)', offset: 1 }];
    }
    p.animate(k, { duration: dur, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = () => { d.style.zIndex = ''; };
    dust(T, dur * .85);
  };
  const F = cell(mv.from, bot), T = cell(mv.to, bot);
  if (mv.promotion && !calm) {
    const dest = sq(T), pb = dest.querySelector('.pc'), color = pb ? cor(g.b[sqIdx(mv.to)]) : 'w';
    if (pb) pb.style.visibility = 'hidden';
    const box = fxBox(F), fr = document.createElement('div');
    fr.className = 'frag p' + color; fr.innerHTML = bt('P'); box.append(fr);
    const dx = (T.c - F.c) * sz, dy = (T.r - F.r) * sz;
    box.style.zIndex = 5;
    box.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * .5}px,${dy * .5 - sz * .15}px) scale(1.2)`, offset: .5 },
      { transform: `translate(${dx}px,${dy}px) scale(1)` }], { duration: 300, easing: 'ease-in-out', fill: 'forwards' });
    setTimeout(() => {
      box.remove();
      if (pb) {
        pb.style.visibility = '';
        pb.animate([{ transform: 'scale(.2) rotate(-200deg)', filter: 'brightness(3) drop-shadow(0 0 12px #ffd35a)' },
          { transform: 'scale(1.4) rotate(10deg)', filter: 'brightness(2) drop-shadow(0 0 16px #ffd35a)', offset: .55 },
          { transform: 'none', filter: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' });
      }
      burst(T, sz);
    }, 300);
  } else hop(mv.from, mv.to, mv.promotion ? 'P' : (g.b[sqIdx(mv.to)] || '').toUpperCase());
  if (a.rook) hop(a.rook.from, a.rook.to, 'R');
  if (a.cap) shatter(a.cap, a.capSq, bot, sz);
}

function shatter(cap, sq, bot, sz) {
  if (still()) return;
  const P = cell(sq, bot), box = document.createElement('div'), DELAY = 280;
  box.className = 'fxs';
  box.style.left = P.c * 12.5 + '%'; box.style.top = P.r * 12.5 + '%';
  const pts = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]];
  const cx = 40 + Math.random() * 20, cy = 40 + Math.random() * 20;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % 8], f = document.createElement('div');
    f.className = 'frag p' + cor(cap);
    f.innerHTML = bt(cap);
    f.style.clipPath = `polygon(${cx}% ${cy}%,${p[0]}% ${p[1]}%,${q[0]}% ${q[1]}%)`;
    const mx = (p[0] + q[0]) / 2 - cx, my = (p[1] + q[1]) / 2 - cy, L = Math.hypot(mx, my) || 1;
    const dist = sz * (0.7 + Math.random() * 0.8);
    f.animate(
      [{ transform: 'none', opacity: 1 },
       { transform: `translate(${mx / L * dist}px,${my / L * dist + sz * 0.5}px) rotate(${(Math.random() - 0.5) * 170}deg)`, opacity: 0 }],
      { duration: 650, delay: DELAY, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
    box.append(f);
  });
  const ring = document.createElement('div');
  ring.className = 'ring';
  ring.animate([{ transform: 'scale(.2)', opacity: 0.9 }, { transform: 'scale(1.9)', opacity: 0 }],
    { duration: 450, delay: DELAY, fill: 'both' });
  box.append(ring);
  $('#fx').append(box);
  setTimeout(() => box.remove(), 1000);
  $('#board').animate(
    [{ transform: 'none' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'none' }],
    { duration: 260, delay: DELAY });
}

function mate(winner) {
  if (still()) return;
  const loser = winner === 'w' ? 'b' : 'w', M = $('#mate');
  M.innerHTML = `<div class="rays"></div><div class="flash"></div>
    <svg class="king p${loser}" viewBox="0 0 100 120" aria-hidden="true">
      <g class="body">
        <path d="M36 58 Q32 82 22 98 H78 Q68 82 64 58 Z"/>
        <rect x="16" y="98" width="68" height="12" rx="5"/>
        <ellipse cx="50" cy="56" rx="20" ry="7"/>
        <circle cx="50" cy="44" r="11"/>
      </g>
      <g class="crown" fill="#f2c14e" stroke="#7a5a10" stroke-width="3" stroke-linejoin="round">
        <path d="M30 36 L25 13 L40 25 L50 7 L60 25 L75 13 L70 36 Z"/>
        <circle cx="25" cy="12" r="3.5"/><circle cx="50" cy="6" r="3.5"/><circle cx="75" cy="12" r="3.5"/>
      </g>
    </svg>
    <div class="slash"></div>
    <h2>XEQUE-MATE</h2><p>${winner === 'w' ? 'Brancas' : 'Pretas'} vencem</p>`;
  M.hidden = false;
  M.onclick = () => { M.hidden = true; };
  clearTimeout(M.h); M.h = setTimeout(() => { M.hidden = true; }, 5200);
}

// ---------- ações ----------
$('#leave').onclick = () => { location.href = '/'; };
$('#flip').onclick = () => { flip = !flip; render(); };
$('#cpcode').onclick = () => { navigator.clipboard.writeText(code).then(() => toast('Código copiado!')); };
$('#copy').onclick = () => { navigator.clipboard.writeText(location.href).then(() => toast('Link copiado!')); };
$('#draw').onclick = () => send({ t: 'draw', a: S.draw === me() ? 'cancel' : S.draw ? 'accept' : 'offer' });
$('#decl').onclick = () => send({ t: 'draw', a: 'decline' });
$('#resign').onclick = () => {
  if (S.moves.length < 2) send({ t: 'abort' });
  else if (confirm('Desistir da partida?')) send({ t: 'resign' });
};
$('#rematch').onclick = () => send({ t: 'rematch' });
$('#chatf').onsubmit = e => {
  e.preventDefault();
  const v = $('#msg').value.trim();
  if (v) send({ t: 'chat', text: v });
  $('#msg').value = '';
};

function promo(c) {
  return new Promise(res => {
    const d = $('#dlg');
    d.innerHTML = '<p>Promover para:</p><div class="row"></div>';
    for (const k of 'QRBN') {
      const b = document.createElement('button');
      b.className = 'pp p' + c; b.innerHTML = bt(k);
      b.onclick = () => { d.close(); res(k.toLowerCase()); };
      d.querySelector('.row').append(b);
    }
    d.onclose = () => res(null);
    d.showModal();
  });
}

async function click(n) {
  if (!myTurn()) return;
  const p = g.b[sqIdx(n)], t = sel && g.targets(sel).find(x => x.to === n);
  if (t) {
    let pr;
    if (t.pr) { pr = await promo(me()); if (!pr) return; }
    send({ t: 'move', from: sel, to: n, promotion: pr });
    sel = null; render();
    return;
  }
  sel = p && cor(p) === me() && n !== sel ? n : null;
  render();
}

// ---------- desenho ----------
const mat = c => g.b.reduce((a, p) => a + (p && cor(p) === c ? V[p.toUpperCase()] || 0 : 0), 0);
function lost(c) {
  const n = {};
  for (const p of g.b) if (p && cor(p) === c) n[p.toUpperCase()] = (n[p.toUpperCase()] || 0) + 1;
  return Object.keys(N0).flatMap(k => Array(Math.max(0, N0[k] - (n[k] || 0))).fill(k));
}
const el = (tag, txt, cls) => { const e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; };

function render() {
  const b0 = local && !LC.bot && !LC.auto ? 'w' : me() || 'w', bot = flip ? (b0 === 'w' ? 'b' : 'w') : b0, top = bot === 'w' ? 'b' : 'w';
  const last = S.moves[S.moves.length - 1], tg = sel ? g.targets(sel) : [];
  const chk = g.inCheck() ? sqName(g.b.indexOf(g.turn === 'w' ? 'K' : 'k')) : null;

  const B = $('#board'); B.innerHTML = '';
  for (let i = 0; i < 64; i++) {
    const r = bot === 'w' ? i >> 3 : 7 - (i >> 3), f = bot === 'w' ? i & 7 : 7 - (i & 7);
    const n = FILES[f] + (8 - r), p = g.b[r * 8 + f], d = document.createElement('div');
    d.className = 'sq ' + ((r + f) % 2 ? 'd' : 'l') + (p ? ' p' + cor(p) : '') + (n === sel ? ' sel' : '') +
      (last && (n === last.from || n === last.to) ? ' lm' : '') + (n === chk ? ' ck' : '') +
      (tg.some(t => t.to === n) ? (p ? ' tc' : ' t') : '');
    d.innerHTML = (p ? bt(p) : '') + ((i & 7) === 0 ? '<i class="rk">' + (8 - r) + '</i>' : '') +
      (i >> 3 === 7 ? '<i class="fl">' + FILES[f] + '</i>' : '');
    d.onclick = () => click(n);
    B.append(d);
  }
  const a = anim; anim = null;
  if (a) playAnim(a, bot);

  for (const [id, c] of [['#top', top], ['#bot', bot]]) {
    const pl = S.p[c], o = c === 'w' ? 'b' : 'w', e = $(id), diff = mat(c) - mat(o);
    e.dataset.c = c;
    e.querySelector('.nm').textContent = (pl ? pl.n : 'Aguardando…') + (pl && !pl.on ? ' (offline)' : '');
    e.querySelector('.ttl').textContent = (pl && TITLE_TEXT[pl.t]) || '';
    e.querySelector('.cap').innerHTML = `<span class="p${o}">` + lost(o).map(k => pieceSVG(k)).join('') + '</span>' + (diff > 0 ? ' +' + diff : '');
  }

  const pl = !!me(), playing = S.status === 'playing', over = S.status === 'over', opp = me() === 'w' ? 'b' : 'w';
  let st;
  if (S.status === 'waiting') st = 'Aguardando o oponente. Envie o código ou o link.';
  else if (over) {
    const w = S.result.winner;
    st = (w ? (w === 'w' ? 'Brancas vencem' : 'Pretas vencem') : 'Empate') + ' — ' + WHY[S.result.reason];
  } else {
    st = pl && !local ? (myTurn() ? 'Sua vez' : 'Vez do oponente') : 'Vez das ' + (g.turn === 'w' ? 'brancas' : 'pretas');
    if (g.inCheck()) st += ' (xeque)';
    if (S.draw && S.draw === opp) st += ' — empate proposto';
  }
  $('#status').textContent = st;

  $('#draw').hidden = !(pl && playing && S.moves.length >= 2);
  $('#draw').textContent = S.draw === me() ? 'Cancelar empate' : S.draw ? 'Aceitar empate' : 'Propor empate';
  $('#decl').hidden = !(pl && playing && S.draw === opp);
  $('#resign').hidden = !(pl && playing);
  $('#resign').textContent = S.moves.length < 2 ? 'Abortar' : 'Desistir';
  $('#rematch').hidden = !(pl && over);
  $('#analyze').hidden = !(over && S.moves.length >= 2 && (pl || local));
  $('#rematch').textContent = S.rematch[me()] ? 'Aguardando revanche…' : S.rematch[opp] ? 'Aceitar revanche' : 'Revanche';
  $('#spec').textContent = S.spec ? S.spec + (S.spec > 1 ? ' espectadores' : ' espectador') : '';

  const ml = $('#moves'); ml.innerHTML = '';
  S.moves.forEach((mv, i) => {
    if (i % 2 === 0) ml.append(el('span', i / 2 + 1 + '.', 'n'));
    ml.append(el('span', mv.san));
  });
  ml.scrollTop = ml.scrollHeight;

  const box = $('#msgs'); box.innerHTML = '';
  for (const c of S.chat) { const d = document.createElement('div'); d.append(el('b', c.n + ': '), c.x); box.append(d); }
  box.scrollTop = box.scrollHeight;
  if (S.chat.length > chatN && chatN) document.title = '💬 Xadrez online';
  chatN = S.chat.length;
  tick();
}

const fmt = ms => {
  const s = Math.max(0, ms) / 1e3;
  return s < 10 ? s.toFixed(1) : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
};
function tick() {
  if (!S) return;
  const run = S.status === 'playing' && S.since;
  document.querySelectorAll('.pl').forEach(e => {
    const c = e.dataset.c, k = e.querySelector('.clk');
    if (!S.base) { k.textContent = '∞'; return; }
    const on = run && g.turn === c, ms = S.clock[c] - (on ? Date.now() + off - S.since : 0);
    k.textContent = fmt(ms);
    if (local && on && ms <= 0 && !LC.flagging) { LC.flagging = true; localFlag(c); }
    k.classList.toggle('on', !!on);
    k.classList.toggle('low', ms < 2e4 && S.status !== 'waiting');
  });
}
setInterval(tick, 100);
document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = 'Xadrez online'; });

// ---------- modo local e robôs ----------
let eng;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function startLocalGame(cfg) {
  local = true; lg = new Chess();
  LC = { base: 0, inc: 0, auto: false, moves: [], since: null, status: 'playing', result: null, game: 1, ...cfg };
  LC.clock = { w: LC.base, b: LC.base };
  document.body.classList.add('local');
  document.body.classList.toggle('bot', !!LC.bot);
  $('#mate').hidden = true;
  $('#home').hidden = true; $('#game').hidden = false;
  S = null;
  localPush();
}
$('#local').onclick = () => {
  const [min, inc] = $('#tc').value.split('+');
  startLocalGame({ base: +min * 6e4, inc: +inc * 1e3, auto: $('#auto').checked });
};

function startBot(idx) {
  const c = $('#bcolor').value, human = c === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : c;
  const elo = LEVELS[idx], t = tier(idx);
  startLocalGame({ bot: { idx, elo, name: `${t[0]} ${t[1]} (${elo})`, ...params(elo) }, human });
}

function localPush() {
  const L = LC, B = L.bot;
  const nm = c => (B ? (L.human === c ? auth.user || localStorage.nome || 'Você' : B.name) : c === 'w' ? 'Brancas' : 'Pretas');
  const tt = c => (B && L.human === c ? prog.title : '');
  update({
    t: 'state', you: B ? L.human : L.status === 'playing' ? lg.turn : 'w', code: 'LOCAL', base: L.base, inc: L.inc,
    p: { w: { n: nm('w'), on: true, t: tt('w') }, b: { n: nm('b'), on: true, t: tt('b') } },
    moves: L.moves.slice(), status: L.status, result: L.result, draw: null, rematch: {},
    clock: { ...L.clock }, since: L.since, now: Date.now(), chat: [], spec: 0, game: L.game,
  });
  if (B) botTurn();
}
function localEnd(winner, reason) {
  Object.assign(LC, { status: 'over', result: { winner, reason }, since: null });
  localPush();
  if (LC.bot && winner === LC.human) botWon();
}
function localFlag(c) {
  const w = c === 'w' ? 'b' : 'w';
  LC.clock[c] = 0;
  if (lg.lacksMating(w)) localEnd(null, 'insufficient'); else localEnd(w, 'timeout');
}
function localSend(d) {
  const L = LC, now = Date.now(), turn = lg.turn;
  if (L.status === 'playing') {
    if (d.t === 'move') {
      const run = L.base > 0 && L.since;
      if (run && now - L.since >= L.clock[turn]) return localFlag(turn);
      const mv = lg.move(d);
      if (!mv) return;
      if (run) L.clock[turn] += L.inc - (now - L.since);
      L.moves.push(mv);
      L.since = L.base > 0 && L.moves.length >= 2 ? now : null;
      const res = lg.result();
      if (res.over) return localEnd(res.winner, res.reason);
    } else if (d.t === 'resign') {
      const loser = L.bot ? L.human : turn;
      return localEnd(loser === 'w' ? 'b' : 'w', 'resign');
    } else if (d.t === 'abort' && L.moves.length < 2) return localEnd(null, 'aborted');
    else if (d.t === 'draw' && L.moves.length >= 2 && !L.bot) {
      if (confirm('Os dois jogadores concordam com o empate?')) return localEnd(null, 'agreement');
      return;
    }
  } else if (L.status === 'over' && d.t === 'rematch') {
    lg = new Chess();
    Object.assign(L, { moves: [], clock: { w: L.base, b: L.base }, since: null, status: 'playing', result: null, game: L.game + 1, flagging: false });
  }
  localPush();
}

async function botTurn() {
  const L = LC;
  if (!L || !L.bot || L.status !== 'playing' || lg.turn === L.human) return;
  const tok = L.game + ':' + L.moves.length;
  if (L.pend === tok) return;
  L.pend = tok;
  $('#status').textContent = 'Robô pensando…';
  const rnd = () => {
    const m = lg.moves(), x = m[(Math.random() * m.length) | 0];
    return sqName(x.from) + sqName(x.to) + (x.pr || '');
  };
  let uci;
  try {
    if (Math.random() < L.bot.blunder) uci = rnd();
    else {
      eng = eng || new Engine();
      uci = await Promise.race([
        eng.best(L.moves.map(m => m.from + m.to + (m.promotion || '')), L.bot),
        sleep(10000).then(() => { throw new Error('timeout'); }),
      ]);
    }
  } catch {
    if (!L.warned) { L.warned = true; toast('Motor do robô indisponível; jogando lances aleatórios.'); }
    uci = rnd();
  }
  await sleep(350);
  if (LC !== L || L.pend !== tok || L.status !== 'playing') return;
  localSend({ t: 'move', from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

function botWon() {
  const idx = LC.bot.idx, before = bestElo();
  let gifts = [];
  if (idx > prog.best) { prog.best = idx; save(); gifts = SKINS.filter(s => s.at > before && s.at <= LEVELS[idx]); }
  const nxt = idx + 1 < LEVELS.length ? idx + 1 : -1;
  const wait = LC.result.reason === 'checkmate' ? 4200 : 900;
  renderBots(); renderSkins();
  const evr = eventWin();
  checkAwards(toast);
  setTimeout(() => reward(idx, gifts, nxt, evr), wait);
}
function reward(idx, gifts, nxt, evr = []) {
  const d = $('#dlg');
  d.innerHTML = `<p><b>Vitória!</b> Você venceu o robô de ${LEVELS[idx]}.</p>` +
    (gifts.length ? `<p>🎁 Skin desbloqueada: <b>${gifts.map(s => s.nome).join(', ')}</b></p>` : '') +
    (evr.length ? `<p>🎉 ${evr.join('<br>')}</p>` : '') +
    (nxt >= 0 ? `<p>Próximo robô: ${LEVELS[nxt]}</p>` : '<p>Você derrotou todos os robôs!</p>') +
    '<div class="row"><button id="rw-x">Fechar</button>' + (nxt >= 0 ? '<button class="p" id="rw-n">Próximo nível</button>' : '') + '</div>';
  d.onclose = null;
  d.showModal();
  d.querySelector('#rw-x').onclick = () => d.close();
  const n = d.querySelector('#rw-n');
  if (n) n.onclick = () => { d.close(); startBot(nxt); };
}

// ---------- abas, robôs, skins, som ----------
function renderBots() {
  const L = $('#ladder'), open = Math.min(prog.best + 1, LEVELS.length - 1);
  L.innerHTML = '';
  $('#bprog').textContent = prog.best < 0 ? 'Vença o robô de 200 para liberar o próximo.'
    : `Maior robô vencido: ${bestElo()}` + (prog.best + 1 < LEVELS.length ? ` — próximo: ${LEVELS[prog.best + 1]}` : ' — todos derrotados!');
  LEVELS.forEach((elo, i) => {
    const t = tier(i), done = i <= prog.best, lock = i > open, gift = SKINS.find(s => s.at === elo);
    const b = document.createElement('button');
    b.className = 'lv' + (done ? ' done' : '') + (i === open && !done ? ' now' : '');
    b.disabled = lock;
    b.innerHTML = `<span class="em">${t[0]}</span><b>${elo}</b><small>${lock ? '🔒' : done ? '✓ ' + t[1] : t[1]}</small>` +
      (gift ? `<i class="gf" title="Desbloqueia a skin ${gift.nome}">🎁</i>` : '');
    b.onclick = () => startBot(i);
    L.append(b);
  });
}
// ---------- skins (tabuleiro e peças separados) ----------
const PT = [['K', 'Rei'], ['Q', 'Dama'], ['R', 'Torre'], ['B', 'Bispo'], ['N', 'Cavalo'], ['P', 'Peão']];
const req = s => (s.ev ? 'Evento: ' + s.evn : 'Robô ' + s.at);
const pair = (t, sk) => `<span class="c l pw">${pieceSVG(t, sk)}</span><span class="c d pb">${pieceSVG(t, sk)}</span>`;
let skMode = 'b';

function chip(s, on, label, fn) {
  const ok = skinOpen(s), b = document.createElement('button');
  b.className = 'chip' + (on ? ' on' : ''); b.disabled = !ok; b.title = ok ? s.nome : 'Desbloqueie: ' + req(s);
  b.innerHTML = label + (ok ? '' : '<i class="lk">🔒</i>');
  b.onclick = fn;
  return b;
}
function renderSkins() {
  const K = $('#skins');
  K.innerHTML = '<div class="skl"><div class="skprev"><div class="abd"><div class="brd" id="skbrd"></div></div></div>' +
    '<div class="skctl"><div class="seg"><button data-m="b">Tabuleiro</button><button data-m="p">Peças</button></div><div id="skpanel"></div></div></div>';
  draw($('#skbrd'), new Chess(), null, 'w', null);
  K.querySelectorAll('.seg button').forEach(b => {
    b.classList.toggle('on', b.dataset.m === skMode);
    b.onclick = () => { skMode = b.dataset.m; renderSkins(); };
  });
  const P = $('#skpanel');
  if (skMode === 'b') {
    const g = document.createElement('div');
    g.className = 'swg';
    for (const s of SKINS) {
      const ok = skinOpen(s), b = document.createElement('button');
      b.className = 'sw' + (prog.board === s.id ? ' on' : ''); b.disabled = !ok; b.title = ok ? s.nome : 'Desbloqueie: ' + req(s);
      b.innerHTML = `<span class="sws"><i style="background:${s.bd[0]}"></i><i style="background:${s.bd[1]}"></i></span><b>${s.nome}</b><small>${ok ? (prog.board === s.id ? 'Em uso' : 'Usar') : '🔒 ' + req(s)}</small>`;
      b.onclick = () => { setBoard(s.id); renderSkins(); };
      g.append(b);
    }
    P.append(g);
    return;
  }
  P.append(el('h3', 'Conjunto completo'));
  const all = document.createElement('div');
  all.className = 'chips';
  for (const s of SKINS)
    all.append(chip(s, PT.every(([t]) => prog.pieces[t] === s.id), pair('K', s.id) + `<small>${s.nome}</small>`, () => { setAllPieces(s.id); renderSkins(); }));
  P.append(all);
  P.append(el('h3', 'Uma peça de cada vez'));
  for (const [t, nome] of PT) {
    const r = document.createElement('div'), c = document.createElement('div');
    r.className = 'prow'; c.className = 'chips';
    for (const s of SKINS) c.append(chip(s, prog.pieces[t] === s.id, pair(t, s.id), () => { setPiece(t, s.id); renderSkins(); }));
    r.append(el('b', nome), c);
    P.append(r);
  }
}

// ---------- abas ----------
const TABS = ['play', 'bots', 'skins', 'an', 'prof', 'acc'];
function tab(n) {
  document.querySelectorAll('#nav button').forEach(x => x.classList.toggle('on', x.dataset.tab === n));
  for (const t of TABS) $('#sec-' + t).hidden = t !== n;
  if (n === 'an') renderGames();
  if (n === 'prof') renderProf();
}
document.querySelectorAll('#nav button').forEach(b => { b.onclick = () => tab(b.dataset.tab); });

// ---------- partidas salvas e análise ----------
const GK = 'xadrez_games';
const getGames = () => { try { return JSON.parse(localStorage[GK] || '[]'); } catch { return []; } };
const putGame = g => {
  const L = getGames().filter(x => x.id !== g.id);
  L.unshift(g);
  localStorage[GK] = JSON.stringify(L.slice(0, 30));
  if (auth.token) api('game', { game: g }).catch(() => {});
};
function gameRecord(d) {
  const c = local && !LC.bot ? 'w' : me() || 'w';
  return {
    id: Date.now(), date: new Date().toISOString(), mode: local ? (LC.bot ? 'bot' : 'local') : 'online',
    opp: local ? (LC.bot ? LC.bot.name : 'Local') : (d.p[c === 'w' ? 'b' : 'w'] || { n: '?' }).n,
    color: c, result: d.result,
    moves: d.moves.map(x => ({ from: x.from, to: x.to, san: x.san, promotion: x.promotion })),
  };
}
function renderGames() {
  const L = $('#alist'), gs = getGames();
  L.innerHTML = '';
  if (!gs.length) { L.append(el('p', 'Nenhuma partida salva ainda. Jogue uma e ela aparece aqui.', 'mt')); return; }
  for (const g of gs) {
    const w = g.result && g.result.winner, res = !w ? 'Empate' : w === g.color ? 'Vitória' : 'Derrota';
    const b = document.createElement('button');
    b.className = 'gm';
    b.append(el('b', g.mode === 'pgn' ? 'PGN · ' + g.title : res + ' · ' + (g.mode === 'local' ? 'Partida local' : 'contra ' + g.opp)),
      el('small', new Date(g.date).toLocaleString('pt-BR') + ' · ' + g.moves.length + ' lances' + (g.an ? ' · analisada' : '')));
    b.onclick = () => openAnalysis(g, { save: saveAn });
    L.append(b);
  }
}
const saveAn = g => {
  putGame(g);
  if (g.an) { grant('badges', 'analista', toast); grant('titles', 'analista', toast); }
};
const renderProf = () => renderProfile({ name: auth.user || localStorage.nome || 'Jogador', games: getGames().length, toast });
// PGN
function runPgn(text) {
  const r = parsePgn(text), msg = $('#pgnMsg');
  if (r.error) { msg.textContent = r.error; return; }
  msg.textContent = '';
  const gm = { id: Date.now(), date: new Date().toISOString(), mode: 'pgn', title: r.title, opp: r.title, color: 'w', result: r.result, moves: r.moves };
  putGame(gm);
  openAnalysis(gm, { save: saveAn });
}
$('#pgnGo').onclick = () => runPgn($('#pgn').value);
$('#pgnOpen').onclick = () => $('#pgnFile').click();
$('#pgnFile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  $('#pgn').value = await f.text();
  e.target.value = '';
  runPgn($('#pgn').value);
};
$('#analyze').onclick = () => {
  const gm = lastGame && lastGame.moves.length === S.moves.length ? lastGame : gameRecord(S);
  $('#game').hidden = true; $('#home').hidden = false;
  tab('an');
  openAnalysis(gm, { save: saveAn, back: () => { $('#home').hidden = true; $('#game').hidden = false; } });
};

// ---------- conta ----------
const auth = { token: localStorage.tk || '', user: localStorage.tu || '' };
async function api(a, body) {
  const r = await fetch('/api/u/' + a, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, token: auth.token }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Erro de conexão.'); e.status = r.status; throw e; }
  return j;
}
const clearAuth = () => { auth.token = auth.user = ''; localStorage.removeItem('tk'); localStorage.removeItem('tu'); };
function accUI() {
  $('#acc-out').hidden = !!auth.user; $('#acc-in').hidden = !auth.user;
  $('#aname').textContent = auth.user;
  document.querySelector('#nav [data-tab=acc]').textContent = auth.user ? '👤 ' + auth.user : 'Conta';
}
const uni = (a = [], b = []) => [...new Set([...a, ...b])];
function mergeProg(l, s) {
  const base = (s.best ?? -1) >= l.best ? { ...l, ...s } : { ...s, ...l }, ev = { ...(s.ev || {}) };
  for (const [k, v] of Object.entries(l.ev || {})) ev[k] = Math.max(ev[k] || 0, v);
  return { ...base, best: Math.max(l.best, s.best ?? -1), badges: uni(l.badges, s.badges), titles: uni(l.titles, s.titles), xs: uni(l.xs, s.xs), ev, avatar: base.avatar || l.avatar || s.avatar || '' };
}
async function syncDown() {
  const j = await api('me', {}), s = j.prog || {};
  replaceProg(mergeProg(prog, s)); save();
  const have = new Set((j.games || []).map(g => g.id)), loc = getGames(), mine = loc.filter(g => !have.has(g.id));
  localStorage[GK] = JSON.stringify([...(j.games || []), ...mine].sort((a, b) => b.id - a.id).slice(0, 30));
  for (const g of mine.slice(0, 10)) api('game', { game: g }).catch(() => {});
  renderBots(); renderSkins(); renderGames(); checkAwards(toast);
}
async function enter(a) {
  $('#amsg').textContent = '…';
  try {
    const j = await api(a, { user: $('#au').value.trim(), pass: $('#ap').value });
    auth.token = j.token; auth.user = j.user;
    localStorage.tk = j.token; localStorage.tu = j.user;
    $('#ap').value = ''; $('#amsg').textContent = '';
    $('#name').value = j.user; localStorage.nome = j.user;
    await syncDown(); grant('badges', 'conta', toast); accUI();
    toast('Bem-vindo, ' + j.user + '!');
  } catch (e) { $('#amsg').textContent = e.message; }
}
$('#alogin').onclick = () => enter('login');
$('#areg').onclick = () => enter('register');
$('#alogout').onclick = async () => {
  try { await api('logout', {}); } catch {}
  clearAuth(); accUI(); toast('Você saiu da conta.');
};
let pushT;
hooks.push = () => {
  if (!auth.token) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => api('save', { prog }).catch(() => {}), 800);
};

renderBots(); renderSkins(); accUI(); checkAwards(toast);
if (auth.token) syncDown().catch(e => { if (e.status === 401) clearAuth(); }).finally(accUI);

const mb = $('#mute'), mlabel = () => { mb.textContent = muted() ? '🔇 Som' : '🔊 Som'; };
mlabel();
mb.onclick = () => { setMute(!muted()); mlabel(); };
