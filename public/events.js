// Eventos sazonais, emblemas e títulos (usado no navegador e no servidor).
const easter = y => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
};
const D = (y, m, d) => new Date(y, m - 1, d);
const add = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

export const GOALS = [1, 3, 5]; // vitórias contra robôs durante o evento: emblema, título, skin
export const EVENTS = [
  { id: 'carnaval', nome: 'Carnaval', range: y => [add(easter(y), -52), add(easter(y), -43)], skin: 'carnaval', skinNome: 'Carnaval' },
  { id: 'pascoa', nome: 'Páscoa', range: y => [add(easter(y), -10), add(easter(y), 3)], skin: 'pascoa', skinNome: 'Páscoa' },
  { id: 'junina', nome: 'Festa Junina', range: y => [D(y, 6, 5), D(y, 7, 5)], skin: 'junina', skinNome: 'Arraiá' },
  { id: 'halloween', nome: 'Halloween', range: y => [D(y, 10, 20), D(y, 11, 3)], skin: 'abobora', skinNome: 'Abóbora' },
  { id: 'natal', nome: 'Natal', range: y => [D(y, 12, 10), D(y, 12, 31)], skin: 'natal', skinNome: 'Natal' },
];
export function eventState(e, now = new Date()) {
  const y = now.getFullYear(), [a, b] = e.range(y);
  if (now >= a && now < add(b, 1)) return { active: true, year: y, start: a, end: b };
  return { active: false, year: y, next: now < a ? a : e.range(y + 1)[0] };
}

export const TITLES = [
  { id: 'novato', text: 'o Novato', req: 'Disponível desde o início.' },
  { id: 'tatico', text: 'o Tático', bot: 1000, req: 'Vença o robô de 1000.' },
  { id: 'mestre', text: 'o Mestre', bot: 2000, req: 'Vença o robô de 2000.' },
  { id: 'lenda', text: 'a Lenda dos Tabuleiros', bot: 3000, req: 'Vença o robô de 3000.' },
  { id: 'analista', text: 'o Analista', req: 'Analise uma partida.' },
  { id: 't-halloween', text: 'o Rei das Abóboras', req: 'Evento de Halloween: 3 vitórias contra robôs.' },
  { id: 't-natal', text: 'o Ajudante do Papai Noel', req: 'Evento de Natal: 3 vitórias contra robôs.' },
  { id: 't-pascoa', text: 'o Coelhinho do Tabuleiro', req: 'Evento de Páscoa: 3 vitórias contra robôs.' },
  { id: 't-carnaval', text: 'o Folião do Xadrez', req: 'Evento de Carnaval: 3 vitórias contra robôs.' },
  { id: 't-junina', text: 'o Rei do Arraiá', req: 'Evento de Festa Junina: 3 vitórias contra robôs.' },
];
export const TITLE_TEXT = Object.fromEntries(TITLES.map(t => [t.id, t.text]));

export const BADGES = [
  { id: 'b200', nome: 'Primeira vitória', bot: 200, cor: '#cd7f32', lab: '200', desc: 'Vença o robô de 200.' },
  { id: 'b600', nome: 'Aprendiz', bot: 600, cor: '#cd7f32', lab: '600', desc: 'Vença o robô de 600.' },
  { id: 'b1000', nome: 'Clubista', bot: 1000, cor: '#c0c4cc', lab: '1000', desc: 'Vença o robô de 1000.' },
  { id: 'b1500', nome: 'Tático', bot: 1500, cor: '#c0c4cc', lab: '1500', desc: 'Vença o robô de 1500.' },
  { id: 'b2000', nome: 'Mestre', bot: 2000, cor: '#f2c14e', lab: '2000', desc: 'Vença o robô de 2000.' },
  { id: 'b2500', nome: 'Grande Mestre', bot: 2500, cor: '#7fe0ff', lab: '2500', desc: 'Vença o robô de 2500.' },
  { id: 'b3000', nome: 'Lenda', bot: 3000, cor: '#ff6a2b', lab: '3000', desc: 'Vença o robô de 3000.' },
  { id: 'conta', nome: 'Registrado', icon: 'conta', desc: 'Crie uma conta.' },
  { id: 'analista', nome: 'Analista', icon: 'analista', desc: 'Analise uma partida.' },
  ...EVENTS.map(e => ({ id: 'ev-' + e.id, nome: e.nome, icon: e.id, ev: e.id, desc: `Evento de ${e.nome}: 1 vitória contra um robô.` })),
];

const ICON = {
  halloween: '<circle cx="32" cy="32" r="30" fill="#2b1b3d"/><rect x="29" y="14" width="6" height="9" rx="2" fill="#3f8f3a"/><ellipse cx="32" cy="38" rx="20" ry="16" fill="#ff7a1a"/><path d="M23 33 l4 -6 l4 6z M33 33 l4 -6 l4 6z" fill="#2b1b3d"/><path d="M22 42 l4 4 l3 -3 l3 4 l3 -4 l3 3 l4 -4" stroke="#2b1b3d" stroke-width="2.5" fill="none" stroke-linejoin="round"/>',
  natal: '<circle cx="32" cy="32" r="30" fill="#14532d"/><path d="M32 10 L44 27 H20Z M32 19 L47 38 H17Z M32 29 L50 49 H14Z" fill="#2fbf5b"/><rect x="29" y="49" width="6" height="7" fill="#7a4a1f"/><circle cx="32" cy="10" r="4" fill="#ffd54a"/>',
  pascoa: '<circle cx="32" cy="32" r="30" fill="#5b3a8a"/><path d="M32 9 C42 9 49 27 49 38 C49 48 41 55 32 55 C23 55 15 48 15 38 C15 27 22 9 32 9Z" fill="#ffb3d9"/><path d="M16 38 l5.5 -6 l5.5 6 l5 -6 l5.5 6 l5.5 -6 l5.5 6" stroke="#7a3fb0" stroke-width="3" fill="none" stroke-linejoin="round"/>',
  carnaval: '<circle cx="32" cy="32" r="30" fill="#7a1250"/><path d="M10 29 C18 21 46 21 54 29 C54 41 45 47 39 41 L32 37 L25 41 C19 47 10 41 10 29Z" fill="#ffd54a"/><ellipse cx="23" cy="31" rx="5" ry="3.2" fill="#7a1250"/><ellipse cx="41" cy="31" rx="5" ry="3.2" fill="#7a1250"/><path d="M47 23 C55 15 57 10 59 7 C58 15 56 21 52 27Z" fill="#2fd0a5"/>',
  junina: '<circle cx="32" cy="32" r="30" fill="#7a3b12"/><path d="M7 17 Q32 31 57 17" stroke="#f5deb3" stroke-width="2" fill="none"/><path d="M13 20 h7 l-3.5 10z" fill="#ff5252"/><path d="M26 24 h7 l-3.5 10z" fill="#ffd54a"/><path d="M39 24 h7 l-3.5 10z" fill="#4dd0e1"/><path d="M48 21 h7 l-3.5 10z" fill="#8bc34a"/><path d="M32 57 C21 51 23 43 32 35 C34 43 43 45 41 53Z" fill="#ff7a1a"/>',
  conta: '<circle cx="32" cy="32" r="30" fill="#1f7a8c"/><circle cx="32" cy="25" r="9" fill="#fff"/><path d="M14 52 C14 38 50 38 50 52Z" fill="#fff"/>',
  analista: '<circle cx="32" cy="32" r="30" fill="#2f5fb3"/><circle cx="28" cy="28" r="12" stroke="#fff" stroke-width="5" fill="none"/><path d="M37 37 L50 50" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
};
export function badgeSVG(b) {
  const body = b.icon ? ICON[b.icon]
    : `<circle cx="32" cy="32" r="30" fill="${b.cor}"/><circle cx="32" cy="32" r="23" fill="#14202a"/><text x="32" y="${b.lab.length > 3 ? 37 : 38}" text-anchor="middle" font-size="${b.lab.length > 3 ? 15 : 18}" font-weight="700" fill="${b.cor}" font-family="system-ui,sans-serif">${b.lab}</text>`;
  return `<svg class="bsvg" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}
