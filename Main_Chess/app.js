import { Chess, sqName, sqIdx } from '/chess.js';

const $ = s => document.querySelector(s);
const G = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const gl = p => G[p.toUpperCase()] + '\uFE0E';
const V = { Q: 9, R: 5, B: 3, N: 3, P: 1 }, N0 = { Q: 1, R: 2, B: 2, N: 2, P: 8 };
const FILES = 'abcdefgh';
const WHY = {
  checkmate: 'xeque-mate', stalemate: 'afogamento', insufficient: 'material insuficiente',
  threefold: 'tripla repetição', fifty: 'regra dos 50 lances', resign: 'desistência',
  timeout: 'tempo esgotado', agreement: 'acordo', aborted: 'partida abortada',
};

let ws, S, g, code, off = 0, sel = null, flip = false, chatN = 0;
const cor = p => (p < 'a' ? 'w' : 'b');
const me = () => (S.you === 'w' || S.you === 'b' ? S.you : null);
const myTurn = () => S.status === 'playing' && me() === g.turn;
const send = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));

function toast(t) {
  const e = $('#toast');
  e.textContent = t; e.classList.add('show');
  clearTimeout(e.h); e.h = setTimeout(() => e.classList.remove('show'), 2500);
}

// ---------- home ----------
$('#name').value = localStorage.nome || '';
const saveName = () => { localStorage.nome = $('#name').value.trim() || 'Anônimo'; };
$('#create').onclick = async () => {
  saveName();
  const [min, inc] = $('#tc').value.split('+');
  try {
    const r = await fetch('/api/create', { method: 'POST', body: JSON.stringify({ min, inc, color: $('#clr').value }) });
    connect((await r.json()).code);
  } catch { toast('Não foi possível criar a partida.'); }
};
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
  open();
}
function open() {
  const tk = 'tk_' + code;
  ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws/' + code);
  ws.onopen = () => send({ t: 'join', name: localStorage.nome || 'Anônimo', token: localStorage[tk] });
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
  S = d; off = d.now - Date.now();
  g = new Chess();
  d.moves.forEach(mv => g.move(mv));
  sel = null;
  render();
}

// ---------- ações ----------
$('#flip').onclick = () => { flip = !flip; render(); };
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
      b.className = 'pp p' + c; b.textContent = gl(k);
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
  const b0 = me() || 'w', bot = flip ? (b0 === 'w' ? 'b' : 'w') : b0, top = bot === 'w' ? 'b' : 'w';
  const last = S.moves[S.moves.length - 1], tg = sel ? g.targets(sel) : [];
  const chk = g.inCheck() ? sqName(g.b.indexOf(g.turn === 'w' ? 'K' : 'k')) : null;

  const B = $('#board'); B.innerHTML = '';
  for (let i = 0; i < 64; i++) {
    const r = bot === 'w' ? i >> 3 : 7 - (i >> 3), f = bot === 'w' ? i & 7 : 7 - (i & 7);
    const n = FILES[f] + (8 - r), p = g.b[r * 8 + f], d = document.createElement('div');
    d.className = 'sq ' + ((r + f) % 2 ? 'd' : 'l') + (p ? ' p' + cor(p) : '') + (n === sel ? ' sel' : '') +
      (last && (n === last.from || n === last.to) ? ' lm' : '') + (n === chk ? ' ck' : '') +
      (tg.some(t => t.to === n) ? (p ? ' tc' : ' t') : '');
    d.innerHTML = (p ? '<b>' + gl(p) + '</b>' : '') + ((i & 7) === 0 ? '<i class="rk">' + (8 - r) + '</i>' : '') +
      (i >> 3 === 7 ? '<i class="fl">' + FILES[f] + '</i>' : '');
    d.onclick = () => click(n);
    B.append(d);
  }

  for (const [id, c] of [['#top', top], ['#bot', bot]]) {
    const pl = S.p[c], o = c === 'w' ? 'b' : 'w', e = $(id), diff = mat(c) - mat(o);
    e.dataset.c = c;
    e.querySelector('.nm').textContent = (pl ? pl.n : 'Aguardando…') + (pl && !pl.on ? ' (offline)' : '');
    e.querySelector('.cap').textContent = lost(o).map(gl).join('') + (diff > 0 ? ' +' + diff : '');
  }

  const pl = !!me(), playing = S.status === 'playing', over = S.status === 'over', opp = me() === 'w' ? 'b' : 'w';
  let st;
  if (S.status === 'waiting') st = 'Aguardando o oponente. Envie o link desta página.';
  else if (over) {
    const w = S.result.winner;
    st = (w ? (w === 'w' ? 'Brancas vencem' : 'Pretas vencem') : 'Empate') + ' — ' + WHY[S.result.reason];
  } else {
    st = pl ? (myTurn() ? 'Sua vez' : 'Vez do oponente') : 'Vez das ' + (g.turn === 'w' ? 'brancas' : 'pretas');
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
    k.classList.toggle('on', !!on);
    k.classList.toggle('low', ms < 2e4 && S.status !== 'waiting');
  });
}
setInterval(tick, 100);
document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = 'Xadrez online'; });
