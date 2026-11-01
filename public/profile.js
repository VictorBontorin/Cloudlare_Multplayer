// Aba Perfil: foto, título, emblemas e eventos sazonais.
import { prog, save, bestElo } from '/bot.js';
import { EVENTS, BADGES, TITLES, GOALS, eventState, badgeSVG } from '/events.js';

const $ = s => document.querySelector(s);
const add = (k, id) => { if (prog[k].includes(id)) return false; prog[k].push(id); return true; };

export function grant(k, id, toast) {
  if (!add(k, id)) return;
  save();
  const o = (k === 'badges' ? BADGES : TITLES).find(x => x.id === id);
  if (o && toast) toast((k === 'badges' ? 'Novo emblema: ' : 'Novo título: ') + (o.nome || o.text));
}
export function checkAwards(toast) {
  const el = bestElo();
  for (const b of BADGES) if (b.bot && el >= b.bot) grant('badges', b.id, toast);
  for (const t of TITLES) if (t.bot && el >= t.bot) grant('titles', t.id, toast);
}
// Chamado a cada vitória contra um robô: conta para os eventos ativos e devolve as recompensas novas.
export function eventWin() {
  const now = new Date(), got = [];
  for (const e of EVENTS) {
    const st = eventState(e, now);
    if (!st.active) continue;
    const key = e.id + st.year, w = (prog.ev[key] || 0) + 1;
    prog.ev[key] = w;
    if (w >= GOALS[0] && add('badges', 'ev-' + e.id)) got.push('Emblema do evento de ' + e.nome);
    if (w >= GOALS[1] && add('titles', 't-' + e.id)) got.push('Título: ' + TITLES.find(t => t.id === 't-' + e.id).text);
    if (w >= GOALS[2] && add('xs', e.skin)) got.push('Skin do evento: ' + e.skinNome);
  }
  save();
  return got;
}

const h = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
const fmt = d => d.toLocaleDateString('pt-BR');

function photo(f, o) {
  if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const c = document.createElement('canvas'), s = Math.min(img.width, img.height);
    c.width = c.height = 128;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
    URL.revokeObjectURL(url);
    prog.avatar = c.toDataURL('image/jpeg', 0.82);
    save(); renderProfile(o);
  };
  img.onerror = () => { URL.revokeObjectURL(url); o.toast('Não foi possível ler essa imagem.'); };
  img.src = url;
}

export function renderProfile(o) {
  const R = $('#prof');
  R.innerHTML = '';
  const now = new Date(), cur = TITLES.find(t => t.id === prog.title);

  // topo: foto, nome e título
  const top = h('div', 'pf-top'), av = h('div', 'avatar');
  if (prog.avatar) { const im = new Image(); im.src = prog.avatar; im.alt = 'Foto do perfil'; av.append(im); }
  else av.textContent = (o.name[0] || '?').toUpperCase();
  const info = h('div', 'pf-info'), row = h('div', 'row'), file = document.createElement('input');
  file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
  file.onchange = () => photo(file.files[0], o);
  const pick = h('button', '', prog.avatar ? 'Trocar foto' : 'Importar foto'), del = h('button', '', 'Remover');
  pick.onclick = () => file.click();
  del.onclick = () => { prog.avatar = ''; save(); renderProfile(o); };
  row.append(pick); if (prog.avatar) row.append(del);
  info.append(h('b', 'pf-name', o.name), h('small', 'pf-ttl', cur ? cur.text : ''), row, file);
  top.append(av, info);
  R.append(top);

  // números
  const st = h('div', 'stats');
  st.innerHTML = `<div><b>${bestElo() || '—'}</b><small>Maior robô vencido</small></div><div><b>${o.games}</b><small>Partidas salvas</small></div><div><b>${prog.badges.length}</b><small>Emblemas</small></div>`;
  R.append(st);

  // títulos
  R.append(h('h3', '', 'Título (aparece embaixo do seu nome)'));
  const tt = h('div', 'chips2');
  for (const t of TITLES) {
    const own = prog.titles.includes(t.id), b = h('button', 'tt' + (prog.title === t.id ? ' on' : ''), t.text);
    b.disabled = !own; b.title = own ? t.text : t.req;
    b.onclick = () => { prog.title = t.id; save(); renderProfile(o); };
    tt.append(b);
  }
  R.append(tt);

  // eventos
  R.append(h('h3', '', 'Eventos'));
  const evs = h('div', 'evs');
  for (const e of EVENTS) {
    const s = eventState(e, now), w = prog.ev[e.id + s.year] || 0, card = h('div', 'evc' + (s.active ? ' on' : ''));
    const bd = BADGES.find(b => b.ev === e.id);
    const ico = h('div', 'evi'); ico.innerHTML = badgeSVG(bd);
    const body = h('div', 'evb');
    body.append(h('b', '', e.nome), h('small', '', s.active ? `Ativo até ${fmt(s.end)}` : `Volta em ${fmt(s.next)}`));
    if (s.active) {
      const bar = h('div', 'bar'), fill = h('i'); fill.style.width = Math.min(100, w / GOALS[2] * 100) + '%'; bar.append(fill);
      const got = [prog.badges.includes('ev-' + e.id), prog.titles.includes('t-' + e.id), prog.xs.includes(e.skin)];
      body.append(bar, h('small', '', `${w} vitória(s) contra robôs · ${GOALS[0]}: emblema ${got[0] ? '✓' : '○'} · ${GOALS[1]}: título ${got[1] ? '✓' : '○'} · ${GOALS[2]}: skin ${got[2] ? '✓' : '○'}`));
    }
    card.append(ico, body);
    evs.append(card);
  }
  R.append(evs);

  // emblemas
  R.append(h('h3', '', 'Emblemas'));
  const bg = h('div', 'bgrid');
  for (const b of BADGES) {
    const own = prog.badges.includes(b.id), c = h('div', 'bdg' + (own ? '' : ' off'));
    const i = h('div', 'bi'); i.innerHTML = badgeSVG(b);
    c.title = b.desc;
    c.append(i, h('b', '', b.nome), h('small', '', own ? 'Conquistado' : b.desc));
    bg.append(c);
  }
  R.append(bg);
}
