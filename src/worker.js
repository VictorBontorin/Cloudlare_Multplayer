import { DurableObject } from 'cloudflare:workers';
import { Chess } from '../public/chess.js';
import { TITLE_TEXT } from '../public/events.js';

const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = 864e5;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;

    if (p === '/api/create' && req.method === 'POST') {
      const cfg = await req.json().catch(() => ({}));
      for (let i = 0; i < 5; i++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), x => ALFA[x % 32]).join('');
        const r = await env.ROOM.get(env.ROOM.idFromName(code)).fetch('https://room/init', {
          method: 'POST',
          body: JSON.stringify({ ...cfg, code }),
        });
        if (r.ok) return json({ code });
      }
      return json({ error: 'Não foi possível criar a sala.' }, 500);
    }

    const um = p.match(/^\/api\/u\/(register|login|me|save|game|logout)$/);
    if (um && req.method === 'POST') {
      const d = await req.json().catch(() => ({})), act = um[1], auth = act === 'register' || act === 'login';
      const name = String(auth ? d.user || '' : String(d.token || '').split('.')[0]);
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name))
        return json({ error: auth ? 'Usuário inválido (3 a 20 letras, números ou _).' : 'Sessão inválida.' }, auth ? 400 : 401);
      if (auth && (typeof d.pass !== 'string' || d.pass.length < 6 || d.pass.length > 100))
        return json({ error: 'A senha precisa ter de 6 a 100 caracteres.' }, 400);
      const stub = env.USER.get(env.USER.idFromName(name.toLowerCase()));
      return stub.fetch('https://user/' + act, { method: 'POST', body: JSON.stringify({ ...d, user: name }) });
    }

    const ws = p.match(/^\/ws\/([A-Z0-9]{6})$/);
    if (ws) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Esperado WebSocket', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName(ws[1])).fetch(req);
    }

    if (/^\/sala\/[A-Za-z0-9]{6}$/.test(p)) return env.ASSETS.fetch(new URL('/', req.url));
    return env.ASSETS.fetch(req);
  },
};

export class ChessRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;
    this.g = new Chess();
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get('s')) || null;
      if (this.s) for (const m of this.s.moves) this.g.move(m);
    });
  }

  timed() { return this.s.base > 0; }

  async commit() {
    const s = this.s;
    s.at = Date.now();
    await this.ctx.storage.put('s', s);
    let t = s.at + DAY;
    if (s.status === 'playing' && this.timed() && s.since) t = Math.min(t, s.since + s.clock[this.g.turn]);
    await this.ctx.storage.setAlarm(t);
  }

  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === '/init') {
      if (this.s) return new Response('', { status: 409 });
      const c = await req.json();
      const clamp = (v, a, b) => Math.min(Math.max(+v || 0, a), b);
      const base = clamp(c.min, 0, 180) * 6e4, inc = clamp(c.inc, 0, 60) * 1e3;
      const first = c.color === 'w' || c.color === 'b' ? c.color : Math.random() < 0.5 ? 'w' : 'b';
      this.s = {
        code: c.code, base, inc, first, p: { w: null, b: null }, moves: [], clock: { w: base, b: base },
        since: null, status: 'waiting', result: null, draw: null, rematch: {}, chat: [], game: 1, at: Date.now(),
      };
      await this.commit();
      return new Response('ok');
    }
    if (!this.s) return new Response('Sala não encontrada', { status: 404 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- helpers ----------
  who(ws) {
    const a = ws.deserializeAttachment(), p = this.s.p;
    if (!a || !a.token) return 's';
    return p.w && p.w.token === a.token ? 'w' : p.b && p.b.token === a.token ? 'b' : 's';
  }
  live() { return this.ctx.getWebSockets().filter(w => w.readyState === 1); }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch {} }

  state(ws) {
    const s = this.s, L = this.live();
    const pv = r => s.p[r] && { n: s.p[r].name, t: s.p[r].title || '', on: L.some(w => this.who(w) === r) };
    return JSON.stringify({
      t: 'state', you: this.who(ws), code: s.code, base: s.base, inc: s.inc,
      p: { w: pv('w'), b: pv('b') }, moves: s.moves, status: s.status, result: s.result,
      draw: s.draw, rematch: s.rematch, clock: s.clock, since: s.since, now: Date.now(),
      chat: s.chat, game: s.game,
      spec: L.filter(w => (w.deserializeAttachment() || {}).j && this.who(w) === 's').length,
    });
  }
  bc() { for (const w of this.live()) { try { w.send(this.state(w)); } catch {} } }
  err(ws, m) { this.send(ws, { t: 'err', m }); try { ws.send(this.state(ws)); } catch {} }

  async end(winner, reason) {
    const s = this.s;
    Object.assign(s, { status: 'over', result: { winner, reason }, since: null, draw: null, rematch: {} });
    await this.commit();
    this.bc();
  }
  async flag(loser) {
    const w = loser === 'w' ? 'b' : 'w';
    return this.g.lacksMating(w) ? this.end(null, 'insufficient') : this.end(w, 'timeout');
  }

  // ---------- mensagens ----------
  async webSocketMessage(ws, raw) {
    const s = this.s;
    if (!s || typeof raw !== 'string') return;
    let d; try { d = JSON.parse(raw); } catch { return; }

    if (d.t === 'join') {
      const name = String(d.name || '').trim().slice(0, 20) || 'Anônimo';
      const title = TITLE_TEXT[d.title] ? d.title : '';
      const other = s.first === 'w' ? 'b' : 'w';
      let tok = typeof d.token === 'string' ? d.token : null;
      if (tok && s.p.w && s.p.w.token === tok) { s.p.w.name = name; s.p.w.title = title; }
      else if (tok && s.p.b && s.p.b.token === tok) { s.p.b.name = name; s.p.b.title = title; }
      else {
        const free = !s.p[s.first] ? s.first : !s.p[other] ? other : null;
        if (free) { tok = crypto.randomUUID(); s.p[free] = { token: tok, name, title }; } else tok = null;
      }
      ws.serializeAttachment({ token: tok, name, j: 1 });
      if (s.p.w && s.p.b && s.status === 'waiting') s.status = 'playing';
      await this.commit();
      this.send(ws, { t: 'joined', token: tok });
      return this.bc();
    }

    const a = ws.deserializeAttachment();
    if (!a || !a.j) return;
    const r = this.who(ws), o = r === 'w' ? 'b' : 'w';

    if (d.t === 'chat') {
      const x = String(d.text || '').trim().slice(0, 300);
      if (!x) return;
      s.chat = [...s.chat, { n: a.name, r, x }].slice(-60);
      await this.commit();
      return this.bc();
    }
    if (r === 's') return;

    if (s.status === 'playing') {
      if (d.t === 'move') {
        if (this.g.turn !== r) return this.err(ws, 'Não é a sua vez.');
        if (typeof d.from !== 'string' || typeof d.to !== 'string') return;
        const now = Date.now(), run = this.timed() && s.since;
        if (run && now - s.since >= s.clock[r]) { s.clock[r] = 0; return this.flag(r); }
        const mv = this.g.move(d);
        if (!mv) return this.err(ws, 'Lance ilegal.');
        if (run) s.clock[r] = s.clock[r] - (now - s.since) + s.inc;
        s.moves.push(mv);
        s.draw = null;
        s.since = this.timed() && s.moves.length >= 2 ? now : null;
        const res = this.g.result();
        if (res.over) return this.end(res.winner, res.reason);
        await this.commit();
        return this.bc();
      }
      if (d.t === 'resign') return this.end(o, 'resign');
      if (d.t === 'abort' && s.moves.length < 2) return this.end(null, 'aborted');
      if (d.t === 'draw' && s.moves.length >= 2) {
        if (d.a === 'offer') s.draw = r;
        else if (d.a === 'accept' && s.draw === o) return this.end(null, 'agreement');
        else if (d.a === 'decline' || d.a === 'cancel') s.draw = null;
        await this.commit();
        return this.bc();
      }
    }

    if (s.status === 'over' && d.t === 'rematch') {
      s.rematch[r] = true;
      if (s.rematch.w && s.rematch.b) {
        [s.p.w, s.p.b] = [s.p.b, s.p.w];
        Object.assign(s, {
          moves: [], clock: { w: s.base, b: s.base }, since: null, status: 'playing',
          result: null, draw: null, rematch: {}, game: s.game + 1,
        });
        this.g = new Chess();
      }
      await this.commit();
      this.bc();
    }
  }

  webSocketClose(ws) { try { ws.close(); } catch {} this.bc(); }
  webSocketError() { this.bc(); }

  async alarm() {
    const s = this.s;
    if (!s) return;
    const now = Date.now();
    if (s.status === 'playing' && this.timed() && s.since && now >= s.since + s.clock[this.g.turn] - 5) {
      const l = this.g.turn;
      s.clock[l] = 0;
      return this.flag(l);
    }
    if (now >= s.at + DAY) {
      for (const w of this.ctx.getWebSockets()) { try { w.close(1000, 'Sala expirada'); } catch {} }
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      this.s = null;
      return;
    }
    await this.commit();
  }
}

// ---------- contas: uma instância por usuário (senha com PBKDF2, sessões por token) ----------
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
async function pbk(pass, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, k, 256));
}
const sha = async t => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));

export class UserStore extends DurableObject {
  async session(u) {
    const token = u.name + '.' + hex(crypto.getRandomValues(new Uint8Array(24)));
    u.sess = [...(u.sess || []), await sha(token)].slice(-8);
    await this.ctx.storage.put('u', u);
    return json({ token, user: u.name });
  }

  async fetch(req) {
    const act = new URL(req.url).pathname.slice(1), d = await req.json().catch(() => ({})), st = this.ctx.storage;
    let u = await st.get('u');

    if (act === 'register') {
      if (u) return json({ error: 'Esse usuário já existe.' }, 409);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      u = { name: d.user, salt: hex(salt), hash: await pbk(d.pass, salt), prog: {}, sess: [] };
      return this.session(u);
    }
    if (act === 'login') {
      if (!u || (await pbk(d.pass, unhex(u.salt))) !== u.hash) return json({ error: 'Usuário ou senha incorretos.' }, 401);
      return this.session(u);
    }
    if (!u || !u.sess.includes(await sha(String(d.token || '')))) return json({ error: 'Sessão expirada. Entre novamente.' }, 401);

    if (act === 'me') {
      const games = [...(await st.list({ prefix: 'g:' })).values()].reverse();
      return json({ prog: u.prog, games });
    }
    if (act === 'save') {
      if (d.prog && typeof d.prog === 'object') u.prog = d.prog;
      await st.put('u', u);
      return json({ ok: 1 });
    }
    if (act === 'game') {
      const g = d.game;
      if (!g || !Number.isFinite(g.id) || JSON.stringify(g).length > 100000) return json({ error: 'Partida inválida.' }, 400);
      await st.put('g:' + String(g.id).padStart(16, '0'), g);
      const keys = [...(await st.list({ prefix: 'g:' })).keys()];
      if (keys.length > 40) await st.delete(keys.slice(0, keys.length - 40));
      return json({ ok: 1 });
    }
    if (act === 'logout') {
      const h = await sha(String(d.token));
      u.sess = u.sess.filter(x => x !== h);
      await st.put('u', u);
      return json({ ok: 1 });
    }
    return json({ error: 'Rota inválida.' }, 404);
  }
}
