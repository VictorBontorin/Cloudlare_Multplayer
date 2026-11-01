// Peças em SVG. Cada skin muda cores, contorno, brilho e textura (cores vêm de SKINS em bot.js).
import { SKINS, prog } from '/bot.js';

const BASE = '<path d="M20 91 H80 V85 Q80 80 75 80 H25 Q20 80 20 85 Z"/>';
const DT = d => `<path style="fill:none;stroke:var(--dt);stroke-width:1.8" d="${d}"/>`;
const SHAPES = {
  P: '<circle cx="50" cy="27" r="11"/><path d="M50 40 C44 40 39 43 38 47 C38 50 41 52 44 53 C41 61 38 70 34 80 H66 C62 70 59 61 56 53 C59 52 62 50 62 47 C61 43 56 40 50 40Z"/>',
  R: '<path d="M26 16 H38 V24 H44 V16 H56 V24 H62 V16 H74 V38 L68 44 H32 L26 38Z"/><path d="M33 44 H67 L64 80 H36Z"/>' + DT('M29 38 H71'),
  B: '<circle cx="50" cy="13" r="5"/><path d="M50 19 C60 26 67 36 63 47 C61 52 57 54 57 58 H43 C43 54 39 52 37 47 C33 36 40 26 50 19Z"/><rect x="33" y="58" width="34" height="7" rx="3.5"/><path d="M39 65 H61 C62 71 64 76 69 80 H31 C36 76 38 71 39 65Z"/>' + DT('M47 30 L57 40'),
  Q: '<path d="M27 42 L19 22 L34 33 L41 14 L50 31 L59 14 L66 33 L81 22 L73 42Z"/><circle cx="19" cy="19" r="4"/><circle cx="41" cy="11" r="4"/><circle cx="59" cy="11" r="4"/><circle cx="81" cy="19" r="4"/><rect x="30" y="42" width="40" height="7" rx="3.5"/><path d="M34 49 H66 C65 60 63 70 70 80 H30 C37 70 35 60 34 49Z"/>',
  K: '<path d="M46 6 H54 V13 H61 V20 H54 V27 H46 V20 H39 V13 H46Z"/><path d="M31 44 C31 34 39 28 50 28 C61 28 69 34 69 44Z"/><rect x="29" y="44" width="42" height="7" rx="3.5"/><path d="M35 51 H65 C64 62 62 71 70 80 H30 C38 71 36 62 35 51Z"/>' + DT('M40 38 Q50 32 60 38'),
  N: '<path d="M27 80 C27 67 33 58 41 52 L29 48 C23 46 20 41 21 37 C23 31 30 27 36 22 L41 10 L49 18 C57 16 63 20 69 27 C79 38 80 60 73 80Z"/><circle cx="38" cy="31" r="2.6" style="fill:var(--dt);stroke:none"/>' + DT('M52 24 C60 30 64 42 62 56'),
};
const G_STYLE = 'fill:var(--fl);stroke:var(--sk);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round';
const syms = Object.entries(SHAPES).map(([k, v]) => `<g id="pc-${k}" style="${G_STYLE}">${BASE}${v}</g>`).join('');
const grads = SKINS.map(s => ['w', 'b'].map(c =>
  `<linearGradient id="g-${s.id}-${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s[c][0]}"/><stop offset="1" stop-color="${s[c][1]}"/></linearGradient>`).join('')).join('');
const pats = '<pattern id="pat-grain" width="9" height="100" patternUnits="userSpaceOnUse"><path d="M2 0 V100 M6.5 0 V100" stroke="#000" stroke-opacity=".14" stroke-width="1.2"/></pattern>' +
  '<pattern id="pat-scales" width="12" height="9" patternUnits="userSpaceOnUse"><path d="M0 9 Q6 -1 12 9" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.2"/></pattern>';

const css = SKINS.map(s => `[data-board=${s.id}]{--lt:${s.bd[0]};--dk:${s.bd[1]}}` + ['w', 'b'].map((c, i) =>
  `.p${c} .pc[data-ps=${s.id}]{--fl:url(#g-${s.id}-${c});--sk:${s[c][2]};--dt:${s[c][3]};--ov:${s.ov ? `url(#pat-${s.ov})` : 'transparent'};${s.gl ? `--gl:${s.gl[0]}px;--gc:${s.gl[i + 1]};` : ''}}`).join('')).join('\n');

const st = document.createElement('style');
st.textContent = css;
document.head.append(st);
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${syms}${grads}${pats}</defs></svg>`);

// HTML da peça p (letra) com a skin escolhida para aquele tipo (ou a skin sk, para prévias)
export const pieceSVG = (p, sk) => {
  const T = p.toUpperCase(), id = sk || (SKINS.find(s => s.id === prog.pieces[T]) || SKINS[0]).id;
  return `<svg class="pc" data-ps="${id}" viewBox="0 0 100 100" aria-hidden="true"><use href="#pc-${T}"/><use class="ov" href="#pc-${T}"/></svg>`;
};
