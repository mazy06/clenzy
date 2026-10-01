/*
  Baitly · Teaser 15 s · animation, version 2 (un seul code pour le 9:16 et le 16:9).

  À quoi sert ce fichier : dessiner l'instant t du teaser (window.renderAt(t)) ; render.mjs le rend
  image par image. Le format vient de TIMELINE.width / height ; le tempo et les scènes de GRILLE
  (grille.js, partagée avec musique.py) : 128 BPM, 8 mesures = 15 s, une scène par mesure.
  Version 2 : composants de niveau produit (vraies notifications, fenêtre Baitly en 3D, tuiles
  d'application et tuyaux de données, fiche de mission, agents nommés, carte de décision complète,
  fiche de paiement et facture), profondeur par plans et ombres teintées, flou de mouvement sur les
  entrées rapides, grain discret.
  Scènes : 1 accroche (mot géant + cascade de notifications, un temps chacune) · 2 logo (tout se
  replie en un point qui trace la maison) · 3 planning (une réservation arrive et devient une brique)
  · 4 canaux (le planning devient la cible des flux) · 5 ménage (iris sable, checklist sur les temps)
  · 6 agents (le badge devient le hub, « Approuver » cliqué sur le temps) · 7 paiement (la carte se
  transforme, montant qui roule, tampon) · 8 fin (tout converge dans le logo sur l'impact).
  À qui il s'adresse : motion designer, développeur.
*/
(function () {
  const TL = window.TIMELINE, GR = window.GRILLE;
  const W = TL.width, H = TL.height, P = H > W;
  const BEAT = 60 / GR.bpm, BAR = 4 * BEAT, B = (n) => n * BEAT;
  const IMG = '../../brand-book/assets/photos/', GST = '../../brand-book/assets/guests/';

  /* ---------- temps & courbes ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (t, a, d) => clamp((t - a) / d);
  const eo = (x) => 1 - Math.pow(1 - clamp(x), 5);              // ease-out-quint (brand book)
  const ei = (x) => Math.pow(clamp(x), 3);
  const eio = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], p))).join(',')})`; };
  const punch = (t) => (t >= B(8) && t < B(28) ? 1 + 0.01 * Math.exp(-((t % BEAT) / BEAT) * 7) : 1);
  const blur = (p, max) => `blur(${(Math.pow(1 - clamp(p), 2) * max).toFixed(2)}px)`;   // flou de mouvement à l'entrée

  /* ---------- DOM ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  function h(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v); }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }
  const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const set = (el, css) => { for (const k in css) el.style[k] = css[k]; };
  const ICONS = {
    msg: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
    broom: '<path d="m16 22-1-4"/><path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1"/><path d="M5 14h14l1.97 6.77A1 1 0 0 1 20 22H4a1 1 0 0 1-.97-1.23z"/><path d="m8 22 1-4"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    ccheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
    sliders: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  };
  function icon(name, size, sw = 2) {
    const s = sv('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${ICONS[name]}</svg>`, 'image/svg+xml');
    for (const n of [...doc.documentElement.childNodes]) s.append(document.importNode(n, true));
    return s;
  }
  const HOUSE = 'M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 V710 A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 313.9 419.6 L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 719 441.8 V675 A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 A30.25 30.25 0 0 1 559 529.75 A30.25 30.25 0 0 1 559 590.25';
  /** Mark Baitly : tracé (draw 0→1) + deux packets (cycle 5 s, requête puis réponse). */
  function mark(size, { trait = '#25406E', w = 21 } = {}) {
    const svg = sv('svg', { viewBox: '251 251 522 522', width: size, height: size, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: 'overflow:visible;display:block' });
    const mk = (stroke, sw, dash) => { const p = sv('path', { d: HOUSE, pathLength: 100, stroke, 'stroke-width': sw }); if (dash) p.setAttribute('stroke-dasharray', dash); svg.append(p); return p; };
    const tr = mk(trait, w, '100 100'), rq = mk('#2563EB', w + 6, '6 94'), rs = mk('#0D9488', w + 6, '6 94');
    rq.style.opacity = 0; rs.style.opacity = 0; tr.setAttribute('stroke-dashoffset', '0');
    return {
      svg, path: tr,
      draw(p) { tr.setAttribute('stroke-dashoffset', String(100 - 100 * p)); },
      packets(t, t0) {
        const on = t >= t0, c = ((((t - t0) % 5) + 5) % 5) / 5;
        rq.style.opacity = on && c < .5 ? 1 : 0; rq.setAttribute('stroke-dashoffset', String(-lerp(0, 94, c / .5)));
        rs.style.opacity = on && c >= .5 ? 1 : 0; rs.setAttribute('stroke-dashoffset', String(-lerp(94, 0, (c - .5) / .5)));
      },
    };
  }
  const markPt = (vx, vy, cx, cy, s) => ({ x: cx - s / 2 + (vx - 251) / 522 * s, y: cy - s / 2 + (vy - 251) / 522 * s });

  /* ---------- scène ---------- */
  const stage = document.getElementById('stage');
  set(stage, { width: W + 'px', height: H + 'px' });
  const dots = h('div', { id: 'dots' });
  stage.append(dots, h('div', { id: 'grain' }));
  const layer = (z) => { const e = h('div', { class: 'a', style: `inset:0;z-index:${z}` }); stage.append(e); return e; };
  const svgLayer = (z) => { const s = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: `position:absolute;left:0;top:0;z-index:${z};overflow:visible` }); stage.append(s); return s; };
  const box = (parent, x, y, w, hh, cls = '', st = '') => { const e = h('div', { class: ('a ' + cls).trim(), style: `left:${x}px;top:${y}px;${w != null ? `width:${w}px;` : ''}${hh != null ? `height:${hh}px;` : ''}${st}` }); parent.append(e); return e; };
  const C = P ? { x: 540, y: 960 } : { x: 960, y: 540 };
  const TT = P ? { x: 90, y: 250, w: 900, size: 88 } : { x: 120, y: 392, w: 780, size: 84 };

  /** Titre de scène : chapitre « 0N / VERBE » + deux lignes, chacune sortant d'un masque. */
  function title(l1, l2, chap) {
    const c = h('div', { class: 'eyebrow', style: 'font-family:BM,sans-serif;font-size:24px;margin-bottom:18px' }, chap);
    const a = h('div', {}, l1), b = h('div', { class: 'acc' }, l2);
    const el = h('div', { class: 'a t', style: `left:${TT.x}px;top:${TT.y - 44}px;width:${TT.w}px;font-size:${TT.size}px;z-index:40` }, h('div', { class: 'mask' }, c), h('div', { class: 'mask' }, a), h('div', { class: 'mask' }, b));
    stage.append(el);
    const line = (x, t, tin, tout) => { const pi = eo(seg(t, tin, .5)), po = ei(seg(t, tout - .28, .28)); set(x, { transform: `translateY(${(1 - pi) * 110 - po * 110}%)`, filter: blur(pi, 6) }); };
    return { render(t, in1, in2, out) { const on = t > in1 - .1 && t < out + .05; el.style.visibility = on ? 'visible' : 'hidden'; if (on) { line(c, t, in1 - .06, out); line(a, t, in1, out); line(b, t, in2, out); } } };
  }

  /* =========================================================================================
     1 · ACCROCHE — mot géant + cascade de notifications, un temps chacune
     ========================================================================================= */
  const L1 = layer(10);
  const WB = P ? { x: 90, bottom: 660, w: 900, cap: 250 } : { x: 120, bottom: 650, w: 780, cap: 228 };
  const ey1 = box(L1, WB.x, P ? 330 : 370, 900, null, 'eyebrow', `font-size:${P ? 26 : 24}px`);
  ey1.textContent = 'Tout arrive en même temps';
  const WH = WB.cap + 40;                         // masque à la hauteur du mot : l'ancien sort entièrement
  const wordWin = box(L1, WB.x - 10, WB.bottom + 30 - WH, WB.w + 40, WH, '', 'overflow:hidden');
  const WORDS = [['Réservations', '#1B2A35'], ['Messages', '#9A6C3A'], ['Ménage', '#1B2A35'], ['Paiements', '#9A6C3A']];
  const wEls = WORDS.map(([w, c]) => { const e = h('div', { class: 'bigword', style: `color:${c};left:10px;bottom:30px` }, w); wordWin.append(e); return e; });
  const NT = [
    { bg: '#9A6C3A', l: 'A', src: 'Plateforme A', tm: 'à l’instant', tt: 'Nouvelle réservation', bd: 'Studio Canut · 3 nuits · 342 €' },
    { bg: '#25406E', ic: 'msg', src: 'Léa · voyageuse', tm: '23:41', tt: '« On arrive vers 23 h ? »', bd: 'Loft Presqu’île · arrivée ce soir' },
    { bg: '#5C3A21', ic: 'broom', src: 'Équipe ménage', tm: '09:12', tt: 'Retard de 45 minutes', bd: 'Appartement Bellecour · arrivée à 15 h' },
    { bg: '#E0C89B', fg: '#2B211A', ic: 'card', src: 'Paiement', tm: '10:03', tt: 'Virement à rapprocher', bd: '420,00 € · Loft Presqu’île' },
  ];
  const NF = P ? { x: 80, y: 740, dy: 184, w: 920, ap: 84, f1: 22, f2: 33, f3: 24 } : { x: 1000, y: 150, dy: 196, w: 760, ap: 74, f1: 20, f2: 29, f3: 22 };
  const NOFF = [[0, -1.4], [26, 1.1], [-14, -.7], [18, 1.5]];
  const nEls = NT.map((n, k) => {
    const ap = h('span', { class: 'ap', style: `width:${NF.ap}px;height:${NF.ap}px;background:${n.bg};color:${n.fg || '#FDFDFE'};font-size:${NF.ap * .5}px` }, n.l || icon(n.ic, NF.ap * .48, 2.2));
    const e = h('div', { class: 'a ntf', style: `left:${NF.x + NOFF[k][0]}px;top:${NF.y + k * NF.dy}px;width:${NF.w}px;opacity:0` }, ap,
      h('div', { class: 'tx' }, h('div', { class: 'r1', style: `font-size:${NF.f1}px` }, h('span', {}, n.src), h('span', {}, n.tm)),
        h('div', { class: 'tt', style: `font-size:${NF.f2}px` }, n.tt), h('div', { class: 'bd', style: `font-size:${NF.f3}px` }, n.bd)));
    L1.append(e); return e;
  });
  const dot1 = h('div', { class: 'a', style: 'width:32px;height:32px;border-radius:50%;background:#25406E;opacity:0;z-index:12' });
  stage.append(dot1);
  let wordSize = null;
  function measure() {
    if (wordSize) return;
    const k = stage.getBoundingClientRect().width / W;
    wordSize = wEls.map((e) => { e.style.fontSize = '100px'; const w = e.getBoundingClientRect().width / k; const s = Math.min(WB.cap, WB.w / w * 100); e.style.fontSize = s + 'px'; return s; });
  }

  /* =========================================================================================
     2 · LOGO — tout se replie en un point, qui trace la maison
     ========================================================================================= */
  const M2 = P ? 440 : 380, C2 = P ? { x: 540, y: 860 } : { x: 960, y: 440 };
  const L2 = layer(12);
  const disc2 = box(L2, 0, 0, 10, 10, '', 'border-radius:50%;background:#EEF3F6');
  const logo2 = mark(M2);
  const logoWrap = box(L2, C2.x - M2 / 2, C2.y - M2 / 2, M2, M2);
  logoWrap.append(logo2.svg);
  const pen = box(L2, 0, 0, 30, 30, '', 'border-radius:50%;background:#25406E;opacity:0');
  const wm2 = h('div', { class: 'wm', style: `font-size:${P ? 136 : 120}px` }, 'baitly');
  const wm2Box = box(L2, 0, C2.y + M2 / 2 + 20, W, null, 'mask', 'text-align:center');
  wm2Box.append(h('div', { style: 'display:inline-block' }, wm2));
  const tag2 = box(L2, 0, C2.y + M2 / 2 + (P ? 196 : 170), W, null, '', `text-align:center;font-size:${P ? 38 : 34}px;font-weight:600;color:#4D5A64`);
  tag2.textContent = 'Tout s’orchestre.';
  const penStart = markPt(463, 590.25, C2.x, C2.y, M2);
  const door = markPt(511, 600, C2.x, C2.y, M2);
  const DRAW0 = B(4) + .55, DRAW1 = B(7) - .08;

  /* =========================================================================================
     3 · PLANNING — la fenêtre Baitly, une réservation arrive et devient une brique
     ========================================================================================= */
  const T3 = title('Un seul', 'planning.', '01 / Centraliser');
  const WN = P ? { cx: 540, cy: 1090, w: 980, h: 790, top: 84, dh: 78, col: 250, bh: 88, av: 60, f: 26 } : { cx: 1395, cy: 570, w: 900, h: 660, top: 76, dh: 70, col: 246, bh: 74, av: 50, f: 22 };
  const DW = (WN.w - WN.col) / 7, RH = (WN.h - WN.top - WN.dh) / 4;
  const L3 = layer(8);
  const plate3 = box(L3, WN.cx - WN.w / 2 + 40, WN.cy - WN.h / 2 + 50, WN.w + 60, WN.h + 40, 'plate');
  const winBox = box(L3, WN.cx - WN.w / 2, WN.cy - WN.h / 2, WN.w, WN.h, '', 'perspective:2200px');
  const win = h('div', { class: 'a win', style: 'inset:0;transform-origin:50% 40%' });
  winBox.append(win);
  const chMark = mark(38, { w: 36 });
  const chrome = h('div', { class: 'chrome', style: `height:${WN.top}px` }, chMark.svg, h('span', { class: 'wmk' }, 'baitly'), h('span', { class: 'crumb' }, '/ Planning'),
    h('div', { class: 'seg' }, h('span', { class: 'on' }, 'Semaine'), h('span', {}, 'Mois')),
    h('div', { class: 'avs', style: 'margin-left:14px' }, ['provider-1.jpg', 'provider-2.jpg', 'provider-3.jpg'].map((f) => h('img', { src: IMG + f, alt: '' }))));
  win.append(chrome);
  const DAYS = [['Lun', 6], ['Mar', 7], ['Mer', 8], ['Jeu', 9], ['Ven', 10], ['Sam', 11], ['Dim', 12]];
  const dEls = DAYS.map(([d, n], i) => { const e = h('div', { class: 'days' + (i === 3 ? ' today' : ''), style: `left:${WN.col + i * DW}px;width:${DW}px;top:${WN.top}px;height:${WN.dh}px` }, h('span', {}, d), h('b', {}, String(n))); win.append(e); return e; });
  const PROPS = [['bedroom.jpg', 'Studio Canut', 'Lyon 4e'], ['pricingRoom.webp', 'Loft Presqu’île', 'Lyon 2e'], ['guesthouse.jpg', 'Villa Basque', 'Biarritz'], ['pool.jpg', 'Chalet Aravis', 'La Clusaz']];
  const G0 = WN.top + WN.dh;
  const PI = P ? 60 : 46;
  const pEls = PROPS.map(([img, n, c], r) => { const e = h('div', { class: 'prop', style: `top:${G0 + r * RH + RH / 2 - PI / 2}px;gap:${P ? 14 : 11}px;left:${P ? 20 : 16}px` }, h('img', { src: IMG + img, alt: '', style: `width:${PI}px;height:${PI}px;border-radius:${PI * .27}px` }), h('div', {}, h('b', { style: `font-size:${P ? 22 : 19}px` }, n), h('small', { style: `font-size:${P ? 18 : 16}px` }, c))); win.append(e); return e; });
  const lines = [];
  for (let r = 0; r <= 4; r++) lines.push(box(win, 0, G0 + r * RH, WN.w, 1.5, 'ln', 'transform-origin:50% 50%'));
  for (let d = 0; d <= 7; d++) lines.push(box(win, WN.col + d * DW, WN.top, 1.5, WN.h - WN.top, 'ln', 'transform-origin:50% 0'));
  const ST = { confirmed: ['#9A6C3A', '#FDFDFE'], checked_in: ['#5C3A21', '#FDFDFE'], pending: ['#E0C89B', '#2B211A'], checked_out: ['#A89684', '#2B211A'] };
  const BR = [
    { r: 1, a: -0.3, b: 1.45, st: 'checked_out', g: 'g3', n: 'Jad', ni: '2 nuits' },
    { r: 0, a: 0.6, b: 2.45, st: 'confirmed', g: 'g2', n: 'Sara', ni: '2 nuits' },
    { r: 3, a: 0.6, b: 3.45, st: 'confirmed', g: 'g11', n: 'Salma', ni: '3 nuits', px: '390 €' },
    { r: 1, a: 1.6, b: 5.45, st: 'checked_in', g: 'g8', n: 'Nadia', ni: '4 nuits', px: '480 €' },
    { r: 2, a: 2.6, b: 6.45, st: 'confirmed', g: 'g5', n: 'Omar', ni: '4 nuits', px: '512 €' },
    { r: 3, a: 4.6, b: 7.3, st: 'pending', g: 'g6', n: 'Lina', ni: '3 nuits' },
    { r: 0, a: 3.6, b: 6.45, st: 'pending', g: 'g9', n: 'Léa', ni: '3 nuits', px: '342 €', key: true },
  ];
  const track = box(win, WN.col, 0, WN.w - WN.col, WN.h, '', 'overflow:hidden');
  const bEls = BR.map((x) => {
    const [bg, fg] = ST[x.st];
    const l = Math.max(0, x.a) * DW, r = Math.min(7, x.b) * DW;
    const dark = x.st === 'confirmed' || x.st === 'checked_in';
    const px = x.px ? h('span', { class: 'px', style: `font-size:${WN.f - 5}px;${dark ? 'background:rgba(0,0,0,.2);color:#FDFDFE' : 'background:rgba(255,255,255,.6);color:#2B211A'}` }, x.key ? icon('check', WN.f - 6, 3) : null, x.px) : null;
    const e = h('div', { class: 'brk', style: `left:${l + 5}px;width:${r - l - 10}px;height:${WN.bh}px;top:${G0 + x.r * RH + RH / 2 - WN.bh / 2}px;background:${bg};color:${fg}` },
      h('img', { src: `${GST}${x.g}.jpg`, alt: '', style: `width:${WN.av}px;height:${WN.av}px` }), h('div', { class: 'nm' }, h('b', { style: `font-size:${WN.f}px` }, x.n), h('small', { style: `font-size:${WN.f - 7}px` }, x.ni)), px);
    track.append(e); return { e, x, px };
  });
  const lea = bEls.find((b) => b.x.key);
  const nowL = box(win, WN.col + (3 + 10 / 24) * DW - 2, G0, 4, WN.h - G0, 'now', 'transform:scaleY(0)');
  // la notification qui arrive puis tombe dans le planning
  const TO = P ? { x: 70, y: 590, w: 620 } : { x: 900, y: 118, w: 560 };
  const toast = h('div', { class: 'a ntf', style: `left:${TO.x}px;top:${TO.y}px;width:${TO.w}px;opacity:0;z-index:20;padding:18px 22px 18px 18px` },
    h('span', { class: 'ap', style: 'width:64px;height:64px;background:#25406E;font-size:32px' }, 'B'),
    h('div', { class: 'tx' }, h('div', { class: 'r1', style: 'font-size:19px' }, h('span', {}, 'Plateforme B'), h('span', {}, 'à l’instant')),
      h('div', { class: 'tt', style: 'font-size:27px' }, 'Réservation · Léa'), h('div', { class: 'bd', style: 'font-size:21px' }, 'Studio Canut · 3 nuits · 342 €')));
  stage.append(toast);
  const leaPt = () => { const r = lea.e.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = W / s.width; return { x: (r.left - s.left + r.width / 2) * k, y: (r.top - s.top + r.height / 2) * k }; };

  /* =========================================================================================
     4 · CANAUX — tuiles d'application, hub Baitly, tuyaux de données
     ========================================================================================= */
  const T4 = title('Tous vos canaux,', 'synchronisés.', '02 / Synchroniser');
  const TS = P ? 170 : 150, HUB = P ? 230 : 210;
  const TILES = P ? [{ x: 200, y: 700 }, { x: 540, y: 700 }, { x: 880, y: 700 }] : [{ x: 1040, y: 300 }, { x: 1040, y: 540 }, { x: 1040, y: 780 }];
  const HC = P ? { x: 540, y: 1085 } : { x: 1400, y: 540 };
  const MINI = P ? { x: 540, y: 1360, s: .3 } : { x: 1722, y: 540, s: .26 };
  const L4 = layer(9), S4 = svgLayer(8);
  const TCOL = ['#9A6C3A', '#25406E', '#5C3A21'];
  const tEls = TILES.map((p, i) => {
    const e = box(L4, p.x - TS / 2, p.y - TS / 2, TS, TS, 'tile', `font-size:${TS * .5}px;color:${TCOL[i]}`);
    e.textContent = 'ABC'[i];
    const lb = box(L4, p.x, p.y + TS / 2 + 14, null, null, 'tlbl'); lb.textContent = 'Plateforme ' + 'ABC'[i];
    const sy = box(L4, p.x, p.y + TS / 2 - 22, null, null, 'sync', 'opacity:0'); sy.append(icon('check', 18, 3), 'Synchronisé');
    return { e, lb, sy };
  });
  const hub = box(L4, HC.x - HUB / 2, HC.y - HUB / 2, HUB, HUB, 'appicon', `border-radius:${HUB * .26}px`);
  const hubMark = mark(HUB * .6, { trait: '#F7FBFC', w: 26 });
  hub.append(hubMark.svg);
  const hubRing = box(L4, HC.x - HUB / 2, HC.y - HUB / 2, HUB, HUB, '', `border-radius:${HUB * .26}px;border:3px solid #25406E;opacity:0`);
  const miniOk = box(L4, MINI.x + WN.w * MINI.s / 2 - 30, MINI.y - WN.h * MINI.s / 2 - 18, 48, 48, 'okb', 'opacity:0');
  miniOk.append(icon('check', 26, 3));
  const pipeD = (p) => (P
    ? `M${p.x} ${p.y + TS / 2 + 50} C${p.x} ${p.y + TS / 2 + 170} ${HC.x} ${HC.y - HUB / 2 - 120} ${HC.x} ${HC.y - HUB / 2}`
    : `M${p.x + TS / 2} ${p.y} C${p.x + TS / 2 + 150} ${p.y} ${HC.x - HUB / 2 - 150} ${HC.y} ${HC.x - HUB / 2} ${HC.y}`);
  const outD = P ? `M${HC.x} ${HC.y + HUB / 2} L${MINI.x} ${MINI.y - WN.h * MINI.s / 2}` : `M${HC.x + HUB / 2} ${HC.y} L${MINI.x - WN.w * MINI.s / 2} ${MINI.y}`;
  const pipe = (d, color) => {
    const tr = sv('path', { d, fill: 'none', stroke: '#DCE5EB', 'stroke-width': 10, 'stroke-linecap': 'round' });
    const fl = sv('path', { d, fill: 'none', stroke: color, 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0 });
    const fl2 = sv('path', { d, fill: 'none', stroke: '#0D9488', 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0 });
    S4.append(tr, fl, fl2); return { tr, fl, fl2 };
  };
  const pipes = TILES.map((p) => pipe(pipeD(p), '#2563EB'));
  const outP = pipe(outD, '#0D9488');
  const plen = (path) => path.__len || (path.__len = path.getTotalLength());
  const flow = (path, p, back = false, sl = 90) => {
    if (p <= 0 || p >= 1) { path.setAttribute('opacity', 0); return; }
    const L = plen(path);
    path.setAttribute('stroke-dasharray', `${sl} ${L + sl}`);
    path.setAttribute('stroke-dashoffset', String(back ? lerp(-L, sl, p) : lerp(sl, -L, p)));
    path.setAttribute('opacity', 1);
  };
  const drawIn = (path, p) => { const L = plen(path); path.setAttribute('stroke-dasharray', `${L} ${L}`); path.setAttribute('stroke-dashoffset', String(L * (1 - p))); };

  /* =========================================================================================
     5 · MÉNAGE — iris sable, fiche de mission cochée sur les temps
     ========================================================================================= */
  const T5 = title('Ménage planifié.', 'Prêt à accueillir.', '03 / Préparer');
  const DIAG = Math.hypot(W, H) * 1.1;
  const iris = h('div', { class: 'a', style: 'border-radius:50%;background:#F3EBDD;z-index:14;display:none' });
  stage.append(iris);
  const L5 = layer(16);
  const MS = P ? { x: 90, y: 600, w: 900, ph: 300, tt: 50, row: 76, f: 28, bx: 42 } : { x: 1000, y: 120, w: 780, ph: 230, tt: 42, row: 64, f: 25, bx: 38 };
  const ready = h('span', { class: 'ready', style: 'opacity:0' }, icon('ccheck', 28, 2.4), 'Prêt pour l’arrivée');
  const CKS = ['Chambre', 'Salle d’eau', 'Linge changé', 'Photos de fin'];
  const ckEls = CKS.map((x) => {
    const bx = h('span', { class: 'bx', style: `width:${MS.bx}px;height:${MS.bx}px` }, icon('check', MS.bx * .55, 3.2));
    const st = h('i', { style: 'transform:scaleX(0);width:100%' });
    const lb = h('span', { class: 'lb' }, x, st);
    return { el: h('div', { class: 'ck', style: `height:${MS.row}px;font-size:${MS.f}px` }, bx, lb), bx, st, lb };
  });
  const pbar = h('i');
  const mis = box(L5, MS.x, MS.y, MS.w, null, 'mis');
  mis.append(h('div', { class: 'ph', style: `height:${MS.ph}px` }, h('img', { src: IMG + 'operationsBed.webp', alt: '' }), ready),
    h('div', { class: 'bd' },
      h('div', { class: 'eyebrow', style: 'font-size:21px' }, 'Mission · ménage après départ'),
      h('div', { class: 'mt', style: `font-size:${MS.tt}px` }, 'Appartement Bellecour'),
      h('div', { class: 'meta', style: `font-size:${MS.f - 4}px` }, h('span', {}, icon('clock', 26), 'Aujourd’hui · 11 h → 14 h'), h('span', {}, h('img', { src: IMG + 'provider-1.jpg', alt: '' }), 'Inès M.')),
      h('div', { style: 'margin-top:18px' }, ckEls.map((c) => c.el)),
      h('div', { class: 'pbar', style: 'margin-top:22px' }, pbar)));
  const BG5 = P ? 134 : 116;
  const badgeC = { x: MS.x + MS.w - 110, y: MS.y + MS.ph };
  const badge = box(L5, badgeC.x - BG5 / 2, badgeC.y - BG5 / 2, BG5, BG5, 'badge');
  const bSvg = sv('svg', { width: BG5, height: BG5, viewBox: `${-BG5 / 2} ${-BG5 / 2} ${BG5} ${BG5}` });
  const RR = BG5 / 2 - 16;
  bSvg.append(sv('circle', { r: RR, fill: 'none', stroke: 'rgba(154,108,58,.18)', 'stroke-width': 11 }));
  const bArc = sv('circle', { r: RR, fill: 'none', stroke: '#9A6C3A', 'stroke-width': 11, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': '0 100', transform: 'rotate(-90)' });
  bSvg.append(bArc);
  const bNum = h('b', { style: `font-size:${P ? 34 : 30}px` }, '0/4');
  badge.append(bSvg, bNum);
  const dot5 = h('div', { class: 'a', style: 'width:44px;height:44px;border-radius:50%;background:#9A6C3A;opacity:0;z-index:30' });
  stage.append(dot5);

  /* =========================================================================================
     6 · AGENTS — le badge devient le hub, agents nommés, carte de décision complète
     ========================================================================================= */
  const T6 = title('Vous approuvez.', 'Ils exécutent.', '04 / Décider');
  const K6 = P ? { x: 540, y: 830, s: 170, rx: 380, ry: 210, a: [192, 230, 270, 310, 348] } : { x: 1400, y: 300, s: 150, rx: 330, ry: 150, a: [194, 232, 270, 308, 346] };
  const AG = [['Revenue', '#9A6C3A'], ['Communication', '#E0C89B'], ['Opérations', '#5C3A21'], ['Finance', '#25406E'], ['Avis', '#A89684']];
  const L6 = layer(9), S6 = svgLayer(8);
  const hub6 = box(L6, K6.x - K6.s / 2, K6.y - K6.s / 2, K6.s, K6.s, 'appicon', `border-radius:${K6.s * .26}px`);
  const hub6Mark = mark(K6.s * .6, { trait: '#F7FBFC', w: 26 });
  hub6.append(hub6Mark.svg);
  const agPos = K6.a.map((deg) => { const r = deg * Math.PI / 180; return { x: K6.x + Math.cos(r) * K6.rx, y: K6.y + Math.sin(r) * K6.ry }; });
  const agEls = AG.map(([n, c]) => { const e = h('div', { class: 'a agp', style: 'opacity:0' }, h('i', { style: `background:${c}` }), n); L6.append(e); return e; });
  const agLines = agPos.map((p) => { const d = `M${K6.x} ${K6.y} Q${(K6.x + p.x) / 2} ${Math.min(K6.y, p.y) - 40} ${p.x} ${p.y}`; const l = sv('path', { d, fill: 'none', stroke: '#C9D4DC', 'stroke-width': 3, 'stroke-linecap': 'round' }); S6.append(l); return l; });
  const agPk = agLines.map((_, i) => { const c = sv('circle', { r: 9, fill: i % 2 ? '#0D9488' : '#2563EB', opacity: 0 }); S6.append(c); return c; });
  const CD = P ? { x: 70, y: 1010, w: 940, tt: 44, f: 25 } : { x: 1010, y: 470, w: 780, tt: 38, f: 22 };
  const L7 = layer(18);
  const card = box(L7, CD.x, CD.y, CD.w, null, 'hc', 'opacity:0;overflow:hidden');
  const stW = h('span', { class: 'bdg st', style: 'background:rgba(212,165,116,.2);color:#7A5320' }, h('i', { style: 'width:10px;height:10px;border-radius:50%;background:#D4A574' }), 'En attente');
  const stOk = h('span', { class: 'bdg st', style: 'background:rgba(13,148,136,.14);color:#0C7166;display:none' }, icon('check', 18, 3), 'Fait');
  const bLbl = h('span', {}, 'Approuver');
  const bApp = h('span', { class: 'btn p' }, icon('check', 24, 3), bLbl);
  const hitl = h('div', { class: 'a', style: 'left:0;top:0;right:0;padding:34px 36px' },
    h('div', { class: 'top' }, h('span', { class: 'bdg ag' }, icon('sparkles', 20), 'Agent Revenue'), h('span', { class: 'bdg ol' }, 'Tarification'), stW, stOk),
    h('div', { class: 'tt', style: `font-size:${CD.tt}px` }, 'Ajuster le prix du week-end'),
    h('div', { class: 'cc', style: `font-size:${CD.f}px` }, 'Demande en hausse samedi et dimanche.'),
    h('div', { class: 'vg' }, h('div', {}, h('small', {}, 'Actuel'), h('b', {}, '118 €')), h('div', {}, h('small', {}, 'Proposé'), h('b', { style: 'color:#0C7166' }, '132 €')), h('div', {}, h('small', {}, 'Plancher'), h('b', {}, '95 €'))),
    h('div', { class: 'btns' }, bApp, h('span', { class: 'btn o' }, icon('sliders', 22), 'Ajuster'), h('span', { class: 'btn g' }, 'Ignorer')));
  card.append(hitl);
  const cursor = sv('svg', { viewBox: '0 0 24 24', width: 64, height: 64, style: 'position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 8px 12px rgba(27,42,53,.35));opacity:0' });
  cursor.append(sv('path', { d: 'M4 2.5 19.5 12l-7 1.6-3.4 6.6z', fill: '#1B2A35', stroke: '#F7FBFC', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }));
  stage.append(cursor);
  const tapRing = box(stage, 0, 0, 96, 96, '', 'margin:-48px 0 0 -48px;border-radius:50%;border:4px solid rgba(27,42,53,.4);opacity:0;z-index:49');

  /* =========================================================================================
     7 · PAIEMENT — la carte devient la fiche de paiement, facture derrière, tampon
     ========================================================================================= */
  const T7 = title('Payé.', 'Rapproché.', '05 / Encaisser');
  const PY = P ? { x: 70, y: 640, w: 940, h: 780, amt: 160 } : { x: 1010, y: 200, w: 780, h: 690, amt: 136 };
  const rcp = box(L7, PY.x + PY.w - (P ? 380 : 330), PY.y - (P ? 120 : 100), P ? 400 : 350, P ? 460 : 400, 'rcp', 'opacity:0;z-index:-1;transform-origin:50% 100%');
  rcp.append(h('div', { style: 'display:flex;align-items:center;gap:12px;color:#7A5230' }, icon('receipt', 30, 2), h('b', { style: 'font-size:22px;color:#1B2A35' }, 'Facture F-2026-0142')),
    ...[.9, .7, .8, .5, .65].map((w) => h('div', { class: 'rl', style: `width:${w * 100}%` })));
  const pst = h('span', { class: 'pst', style: 'margin-left:auto;background:rgba(212,165,116,.2);color:#7A5320' }, 'En cours');
  const amt = h('div', { class: 'amt', style: `font-size:${PY.amt}px` }, '0,00 €');
  const TLS = [['Réservation', '10:41'], ['Paiement', '10:43'], ['Rapprochement', '10:43']];
  const tlEls = TLS.map(([l, tm]) => { const bar = h('i'); const ck = h('span', { style: 'display:flex;color:#0C7166;opacity:0' }, icon('check', 20, 3)); return { el: h('div', { class: 'st' }, h('div', { class: 'bar' }, bar), h('div', { class: 'lb' }, ck, l), h('div', { class: 'tm' }, tm)), bar, ck }; });
  const pay = h('div', { class: 'a', style: 'inset:0;padding:42px 46px;display:flex;flex-direction:column;opacity:0' },
    h('div', { style: 'display:flex;align-items:center;gap:12px' }, h('span', { class: 'eyebrow', style: 'font-size:21px' }, 'Paiement · séjour de Léa'), pst),
    h('div', { style: 'margin-top:26px' }, amt),
    h('div', { style: `font-size:${P ? 26 : 23}px;color:#4D5A64;margin-top:14px;font-weight:600` }, 'Loft Presqu’île · 3 nuits · réservation directe'),
    h('div', { class: 'mth', style: 'margin-top:26px' }, h('span', {}, icon('card', 24), 'Carte •••• 4242'), h('span', {}, icon('link', 22), 'Lien de paiement')),
    h('div', { class: 'tl', style: 'margin-top:auto' }, tlEls.map((x) => x.el)));
  card.append(pay);
  const stamp = h('div', { class: 'a stamp', style: 'z-index:30' }, icon('ccheck', 50, 3), 'PAYÉ');
  stage.append(stamp);
  const waves = Array.from({ length: 8 }, () => box(stage, PY.x, PY.y, PY.w, PY.h, '', 'border:2px solid #9A6C3A;border-radius:40px;opacity:0;z-index:5'));

  /* =========================================================================================
     8 · FIN — tout converge dans le logo sur l'impact
     ========================================================================================= */
  const M8 = P ? 300 : 210;
  const C8 = P ? { x: 540, y: 720 } : { x: 655, y: 430 };
  const L8 = layer(35);
  const disc8 = box(L8, 0, 0, 10, 10, '', 'border-radius:50%;background:#EEF3F6');
  const logo8 = mark(M8);
  const logo8Box = box(L8, C8.x - M8 / 2, C8.y - M8 / 2, M8, M8, '', 'opacity:0');
  logo8Box.append(logo8.svg);
  const wm8 = h('div', { class: 'wm', style: `font-size:${P ? 140 : 168}px` }, 'baitly');
  const wm8Box = P ? box(L8, 0, C8.y + M8 / 2 + 20, W, null, 'mask', 'text-align:center') : box(L8, C8.x + M8 / 2 + 44, C8.y - 100, 900, null, 'mask');
  wm8Box.append(P ? h('div', { style: 'display:inline-block' }, wm8) : wm8);
  const shock = box(L8, C8.x - M8 / 2, C8.y - M8 / 2, M8, M8, '', 'border-radius:50%;border:4px solid #E0C89B;opacity:0');
  const tagA = h('div', {}, 'Votre location courte durée,'), tagB = h('div', { class: 'acc' }, 'en pilote automatique.');
  const tag8 = P ? box(L8, 0, 1080, W, null, 't', 'text-align:center;font-size:62px') : box(L8, 0, 620, W, null, 't', 'text-align:center;font-size:62px;display:flex;justify-content:center;gap:.28em');
  tag8.append(h('div', { class: 'mask' }, tagA), h('div', { class: 'mask' }, tagB));
  const url8 = box(L8, 0, P ? 1290 : 790, W, null, 'url', `text-align:center;font-size:${P ? 58 : 52}px;opacity:0`);
  url8.textContent = 'baitly.fr';
  const TOK = [
    { s: 'width:170px;height:58px;border-radius:18px;background:#FDFDFE;border:1px solid #E6ECF0;box-shadow:0 12px 30px -14px rgba(27,42,53,.4)', from: [-.12, .18] },
    { s: 'width:150px;height:50px;border-radius:16px;background:#9A6C3A', from: [1.1, .22] },
    { s: 'width:84px;height:84px;border-radius:50%;border:12px solid #9A6C3A;background:#FDFDFE', from: [.08, 1.1] },
    { s: 'width:86px;height:86px;border-radius:24px;background:#25406E', from: [.95, 1.08] },
  ].map((x) => ({ e: box(stage, 0, 0, null, null, '', x.s + ';opacity:0;z-index:36'), from: x.from }));

  /* =========================================================================================
     RENDU
     ========================================================================================= */
  function render(t) {
    measure();
    set(dots, { transform: `translate(${(t * 16) % 40}px, ${(t * 10) % 40}px)` });

    /* 1 · accroche */
    const v1 = t < B(4) + .6;
    L1.style.visibility = v1 ? 'visible' : 'hidden';
    if (v1) {
      set(ey1, { opacity: eo(seg(t, .04, .35)) * (1 - eo(seg(t, B(4) - .1, .2))), transform: `translateY(${lerp(14, 0, eo(seg(t, .04, .35)))}px)` });
      wEls.forEach((e, k) => {
        const pin = eo(seg(t, B(k), .3)), pout = k < 3 ? ei(seg(t, B(k + 1) - .03, .2)) : ei(seg(t, B(4) - .06, .22));
        set(e, { transform: `translateY(${(1 - pin) * WH - pout * WH}px)`, filter: blur(pin, 12), opacity: t >= B(k) - .01 ? 1 : 0 });
      });
      nEls.forEach((e, k) => {
        const p = eo(seg(t, B(k), .36));
        const nudge = [1, 2, 3].reduce((m, j) => (j > k && t >= B(j) ? m + 10 * Math.exp(-(t - B(j)) * 16) : m), 0);
        const conv = ei(seg(t, B(4) - .02 + k * .035, .34));
        const cx = C.x - (NF.x + NOFF[k][0] + NF.w / 2), cy = C.y - (NF.y + k * NF.dy + 75);
        set(e, { opacity: Math.min(1, p * 2.5) * (1 - clamp(conv * 1.4 - .4)), filter: blur(p, 10),
          transform: `translate(${(1 - p) * 220 + conv * cx}px, ${-nudge + conv * cy}px) rotate(${NOFF[k][1] + (1 - p) * 6}deg) scale(${lerp(1.06, 1, p) * lerp(1, .08, conv)})` });
      });
    }
    // le point : naît au centre quand tout s'y est replié, rejoint le départ du tracé
    const dIn = eo(seg(t, B(4) + .26, .15)), dMv = eio(seg(t, B(4) + .34, DRAW0 - B(4) - .34));
    set(dot1, { opacity: t >= B(4) + .26 && t < DRAW0 ? 1 : 0, left: lerp(C.x, penStart.x, dMv) - 16 + 'px', top: lerp(C.y, penStart.y, dMv) - 16 + 'px', transform: `scale(${dIn})` });

    /* 2 · logo */
    const v2 = t >= B(4) && t < B(8) + .35;
    L2.style.visibility = v2 ? 'visible' : 'hidden';
    if (v2) {
      const r = lerp(0, P ? 470 : 390, eo(seg(t, B(4) + .3, 1.1))) * lerp(1, 3, ei(seg(t, B(8) - .12, .4)));
      set(disc2, { width: r * 2 + 'px', height: r * 2 + 'px', left: C2.x - r + 'px', top: C2.y - r + 'px', opacity: 1 - eo(seg(t, B(8) + .02, .25)) });
      const d = eio(seg(t, DRAW0, DRAW1 - DRAW0));
      logo2.draw(d);
      logo2.packets(t, B(7));
      const z = ei(seg(t, B(8) - .12, .4));
      set(logoWrap, { transformOrigin: `${door.x - (C2.x - M2 / 2)}px ${door.y - (C2.y - M2 / 2)}px`, transform: `scale(${lerp(1, 7, z)})`, opacity: 1 - eo(seg(t, B(8) + .05, .22)) });
      const L = logo2.path.getTotalLength(), q = logo2.path.getPointAtLength(L * d), tip = markPt(q.x, q.y, C2.x, C2.y, M2);
      set(pen, { left: tip.x - 15 + 'px', top: tip.y - 15 + 'px', opacity: t >= DRAW0 && t < DRAW1 + .12 ? 1 - eo(seg(t, DRAW1, .12)) : 0 });
      const out2 = 1 - eo(seg(t, B(8) - .18, .2));
      set(wm2, { transform: `translateY(${(1 - eo(seg(t, B(7), .45))) * 105}%)` });
      wm2Box.style.opacity = out2;
      set(tag2, { opacity: eo(seg(t, B(7) + .18, .4)) * out2, transform: `translateY(${lerp(16, 0, eo(seg(t, B(7) + .18, .4)))}px)` });
    }

    /* 3 · planning (puis cible des canaux) */
    const v3 = t >= B(8) - .05 && t < B(16) + .3;
    L3.style.visibility = v3 ? 'visible' : 'hidden';
    T3.render(t, B(8) + .05, B(8) + .2, B(12));
    if (v3) {
      const e = eo(seg(t, B(8), .65));
      const sh = eio(seg(t, B(12) - .05, .45));
      const tx = lerp(0, MINI.x - WN.cx, sh), ty = lerp(0, MINI.y - WN.cy, sh), sc = lerp(1, MINI.s, sh);
      const drift = 1 + .025 * seg(t, B(8), BAR);
      const rx = lerp(P ? 18 : 12, P ? 7 : 5, e) * (1 - sh), ry = (P ? 0 : lerp(-16, -9, e)) * (1 - sh);
      set(win, { opacity: Math.min(1, e * 1.6), transform: `translate(${tx}px, ${ty}px) scale(${sc * (sh < .01 ? drift * punch(t) : 1)}) rotateX(${rx}deg) rotateY(${ry}deg) translateY(${lerp(80, 0, e)}px)` });
      set(plate3, { opacity: Math.min(1, e * 1.4) * (1 - sh), transform: `translate(${lerp(30, 0, e)}px, ${lerp(60, 0, e)}px) scale(${lerp(.96, 1, e)})` });
      lines.forEach((l, i) => { const q = eo(seg(t, B(8) + .1 + i * .012, .4)); l.style.transform = i <= 4 ? `scaleX(${q})` : `scaleY(${q})`; });
      dEls.forEach((x, i) => { const q = eo(seg(t, B(8) + .18 + i * .03, .35)); set(x, { opacity: q, transform: `translateY(${lerp(-10, 0, q)}px)` }); });
      pEls.forEach((x, i) => { const q = eo(seg(t, B(8) + .22 + i * .05, .35)); set(x, { opacity: q, transform: `translateX(${lerp(-16, 0, q)}px)` }); });
      bEls.forEach(({ e: el, x, px }, i) => {
        const t0 = x.key ? B(10) + .22 : B(8) + .32 + i * BEAT / 2;
        const q = eo(seg(t, t0, .42));
        set(el, { opacity: q, clipPath: `inset(-6px ${lerp(100, 0, q)}% -6px -6px)`, transform: `translateX(${lerp(-26, 0, q)}px)` });
        if (x.key) {
          const s = eo(seg(t, B(11), .3));
          el.style.background = mix(ST.pending[0], ST.confirmed[0], s); el.style.color = mix(ST.pending[1], ST.confirmed[1], s);
          const c = eo(seg(t, B(11) + .12, .3));
          set(px, { opacity: c, transform: `scale(${lerp(.6, 1, c)})`, background: 'rgba(0,0,0,.2)', color: '#FDFDFE' });
        }
      });
      nowL.style.transform = `scaleY(${eo(seg(t, B(10), .4))})`;
    }
    // la réservation arrive (temps 9) puis tombe dans sa brique (temps 10)
    const ta = eo(seg(t, B(9), .36)), tf = eio(seg(t, B(10), .34));
    if (t >= B(9) - .02 && t < B(10) + .36) {
      const lp = leaPt(), cx = TO.x + TO.w / 2, cy = TO.y + 50;
      set(toast, { opacity: Math.min(1, ta * 2) * (1 - clamp(tf * 1.5 - .5)), filter: blur(ta, 10),
        transform: `translate(${tf * (lp.x - cx)}px, ${(1 - ta) * -60 + tf * (lp.y - cy)}px) scale(${lerp(1.05, 1, ta) * lerp(1, .3, tf)})` });
    } else toast.style.opacity = 0;

    /* 4 · canaux */
    const v4 = t >= B(12) && t < B(16) + .3;
    L4.style.visibility = v4 ? 'visible' : 'hidden'; S4.style.visibility = v4 ? 'visible' : 'hidden';
    T4.render(t, B(12) + .05, B(14), B(16));
    if (v4) {
      tEls.forEach(({ e, lb, sy }, i) => {
        const q = eo(seg(t, B(12) + .06 + i * .08, .45));
        set(e, { opacity: q, transform: `translateY(${lerp(40, 0, q)}px) scale(${lerp(.8, 1, q) * punch(t)})`, filter: blur(q, 6) }); lb.style.opacity = q;
        const c = eo(seg(t, B(15) + .4 + i * .06, .3)); set(sy, { opacity: c, transform: `translateX(-50%) translateY(${lerp(10, 0, c)}px)` });
      });
      pipes.forEach((p, i) => { drawIn(p.tr, eo(seg(t, B(12) + .18 + i * .06, .45))); flow(p.fl, eio(seg(t, B(13) + i * .07, .5))); flow(p.fl2, eio(seg(t, B(15) + i * .05, .42)), true); });
      drawIn(outP.tr, eo(seg(t, B(14) - .1, .3)));
      flow(outP.fl, eio(seg(t, B(14), .38)));
      const hq = eo(seg(t, B(12) + .22, .45)), hp = seg(t, B(14), .5);
      set(hub, { opacity: hq, transform: `scale(${lerp(.7, 1, hq) * (1 + .08 * Math.sin(Math.PI * clamp(hp * 1.8)))})` });
      set(hubRing, { opacity: hp > 0 && hp < 1 ? (.45 * (1 - hp)).toFixed(3) : 0, transform: `scale(${lerp(1, 1.5, eo(hp))})` });
      hubMark.packets(t, B(13));
      const mo = eo(seg(t, B(14) + .36, .28)); set(miniOk, { opacity: mo, transform: `scale(${lerp(.4, 1, mo)})` });
    }

    /* 5 · ménage (iris) */
    const ir = ei(seg(t, B(16) - .2, .44)), irc = ei(seg(t, B(20) - .02, .36));
    if (t >= B(16) - .2 && t < B(20) + .34) {
      const cx = t < B(20) ? HC.x : badgeC.x, cy = t < B(20) ? HC.y : badgeC.y;
      const d = t < B(20) ? lerp(HUB, DIAG * 2, ir) : lerp(DIAG * 2, 40, irc);
      set(iris, { display: 'block', width: d + 'px', height: d + 'px', left: cx - d / 2 + 'px', top: cy - d / 2 + 'px' });
    } else iris.style.display = 'none';
    const v5 = t >= B(16) && t < B(20) + .4;
    L5.style.visibility = v5 ? 'visible' : 'hidden';
    T5.render(t, B(16) + .1, B(19), B(20));
    if (v5) {
      const e = eo(seg(t, B(16) + .02, .55)), col = ei(seg(t, B(20) - .06, .34));
      set(mis, { opacity: Math.min(1, e * 1.5) * (1 - clamp(col * 1.3 - .3)), filter: blur(e, 8), transformOrigin: `${badgeC.x - MS.x}px ${badgeC.y - MS.y}px`,
        transform: `perspective(2000px) rotateX(${lerp(12, 0, e)}deg) translateY(${lerp(90, 0, e)}px) scale(${lerp(1, .04, col) * punch(t)})` });
      let prog = 0;
      ckEls.forEach((c, k) => {
        const q = eo(seg(t, B(16 + k) + .02, .3));
        prog += q;
        set(c.bx, { background: mix('#FDFDFE', '#0D9488', q), borderColor: mix('#C9D4DC', '#0D9488', q), transform: `scale(${1 + .18 * Math.sin(Math.PI * q)})` });
        c.bx.firstChild.style.opacity = q;
        c.st.style.transform = `scaleX(${eo(seg(t, B(16 + k) + .08, .3))})`;
        c.lb.style.color = mix('#1B2A35', '#6B7B85', q);
      });
      pbar.style.transform = `scaleX(${prog / 4})`;
      bArc.setAttribute('stroke-dasharray', `${prog * 25} 100`);
      bNum.textContent = `${ckEls.filter((_, k) => t >= B(16 + k) + .1).length}/4`;
      set(badge, { opacity: Math.min(1, e * 1.5) * (1 - clamp(col * 2)), transform: `scale(${lerp(.6, 1, eo(seg(t, B(16) + .25, .4)))})` });
      const rq = eo(seg(t, B(19) + .25, .35)); set(ready, { opacity: rq, transform: `translateY(${lerp(-16, 0, rq)}px)` });
    }
    // le badge replié devient le hub des agents
    const dm = eio(seg(t, B(20) + .22, .34));
    if (t >= B(20) + .14 && t < B(20) + .6) set(dot5, { opacity: 1, left: lerp(badgeC.x, K6.x, dm) - 22 + 'px', top: lerp(badgeC.y, K6.y, dm) - 22 + 'px' });
    else dot5.style.opacity = 0;

    /* 6 · agents */
    const v6 = t >= B(20) && t < B(24) + .45;
    L6.style.visibility = v6 ? 'visible' : 'hidden'; S6.style.visibility = v6 ? 'visible' : 'hidden';
    T6.render(t, B(20) + .1, B(23) + .05, B(24));
    if (v6) {
      const out6 = ei(seg(t, B(24) - .1, .35));
      const hq = eo(seg(t, B(20) + .5, .4));
      set(hub6, { opacity: Math.min(1, hq * 2) * (1 - out6), transform: `scale(${lerp(.26, 1, hq) * lerp(1, .85, out6) * punch(t)})` });
      hub6Mark.packets(t, B(20) + .6);
      agEls.forEach((e, i) => {
        const q = eo(seg(t, B(20) + .62 + i * .06, .4));
        const w = e.offsetWidth, hh = e.offsetHeight, p = agPos[i];
        set(e, { left: lerp(K6.x, p.x, q) - w / 2 + 'px', top: lerp(K6.y, p.y, q) - hh / 2 + 'px', opacity: q * (1 - out6), transform: `scale(${lerp(.6, 1, q)})` });
        drawIn(agLines[i], eo(seg(t, B(20) + .66 + i * .06, .4)));
        agLines[i].style.opacity = 1 - out6;
      });
      [[0, B(21.5)], [2, B(22)], [4, B(22.5)], [1, B(21.75)]].forEach(([n, t0], j) => {
        const q = eio(seg(t, t0, .42)), c = agPk[n];
        if (q <= 0 || q >= 1 || t > B(24) - .1) { c.setAttribute('opacity', 0); return; }
        const pt = agLines[n].getPointAtLength(plen(agLines[n]) * (j % 2 ? 1 - q : q));
        c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('opacity', 1);
      });
    }

    /* 6 → 7 · la carte de décision devient la fiche de paiement */
    const vc = t >= B(21) - .05 && t < B(28) + .1;
    L7.style.visibility = vc ? 'visible' : 'hidden';
    if (vc) {
      const cin = eo(seg(t, B(21), .45)), mo = eio(seg(t, B(24) - .05, .45));
      card.style.width = lerp(CD.w, PY.w, mo) + 'px';        // largeur d'abord : la hauteur du texte en dépend
      const hitlH = hitl.offsetHeight || 420;
      const x = lerp(CD.x, PY.x, mo), y = lerp(CD.y, PY.y, mo) + (1 - cin) * 80, hh = lerp(hitlH, PY.h, mo);
      const endS = ei(seg(t, B(28) - .32, .32));
      const slam = eo(seg(t, B(27), .25)), pun = t >= B(27) && t < B(27) + .3 ? 1 + .025 * (1 - slam) : 1;
      set(card, { left: x + 'px', top: y + 'px', height: hh + 'px', opacity: Math.min(1, cin * 1.5) * (1 - endS), filter: blur(cin, 8),
        transform: `scale(${lerp(1, .05, endS) * pun})`, transformOrigin: `${C8.x - x}px ${C8.y - y}px`,
        borderColor: mo > 0 ? '#D5DEE7' : (t >= B(23) + .1 ? mix('#D4A574', '#0D9488', eo(seg(t, B(23) + .1, .3))) : '#D4A574') });
      hitl.style.opacity = 1 - eo(seg(t, B(24) - .05, .15));
      pay.style.opacity = eo(seg(t, B(24) + .22, .25));
      const clicked = t >= B(23);
      bApp.style.background = clicked ? mix('#1B2A35', '#0D9488', eo(seg(t, B(23), .3))) : '#1B2A35';
      bLbl.textContent = t >= B(23) + .08 ? 'Approuvé' : 'Approuver';
      bApp.style.transform = `scale(${t >= B(23) - .04 && t < B(23) + .1 ? .94 : 1})`;
      stW.style.display = t >= B(23) + .15 ? 'none' : ''; stOk.style.display = t >= B(23) + .15 ? '' : 'none';
      const br = bApp.getBoundingClientRect(), sr = stage.getBoundingClientRect(), k = W / sr.width;
      const bx = (br.left - sr.left + br.width / 2) * k, by = (br.top - sr.top + br.height / 2) * k;
      const cv = t >= B(22) - .15 && t < B(23) + .55, cm = eio(seg(t, B(22), .6));
      set(cursor, { opacity: cv ? Math.min(1, (t - B(22) + .15) / .2, (B(23) + .55 - t) / .25) : 0, transform: `translate(${lerp(bx + 280, bx - 6, cm)}px, ${lerp(by + 220, by - 4, cm)}px) scale(${t >= B(23) - .04 && t < B(23) + .1 ? .9 : 1})` });
      const tq = seg(t, B(23), .45);
      set(tapRing, { left: bx + 'px', top: by + 'px', opacity: tq > 0 && tq < 1 ? (.9 * (1 - tq)).toFixed(3) : 0, transform: `scale(${lerp(.4, 1.3, eo(tq))})` });
      const ro = eio(seg(t, B(24) + .25, B(1) + .15));
      amt.textContent = (420 * ro).toFixed(2).replace('.', ',') + ' €';
      TLS.forEach((_, i) => { const t0 = [B(25), B(26), B(26.5)][i], q = eo(seg(t, t0, .3)); tlEls[i].bar.style.transform = `scaleX(${q})`; tlEls[i].ck.style.opacity = eo(seg(t, t0 + .2, .2)); });
      const paid = t >= B(27);
      set(pst, { background: paid ? 'rgba(13,148,136,.14)' : 'rgba(212,165,116,.2)', color: paid ? '#0C7166' : '#7A5320' });
      pst.textContent = paid ? 'Payé' : 'En cours';
      const rq = eo(seg(t, B(25), .5));
      set(rcp, { opacity: rq * (1 - endS), transform: `translateY(${lerp(140, 0, rq)}px) rotate(${lerp(0, 7, rq)}deg)` });
    }
    T7.render(t, B(24) + .1, B(26.5), B(28) - .15);
    const sp = seg(t, B(27), .36), sOut = ei(seg(t, B(28) - .32, .25));
    if (t >= B(27) && t < B(28)) {
      const s = sp < .55 ? lerp(1.8, .95, ei(sp / .55)) : lerp(.95, 1, eo((sp - .55) / .45));
      set(stamp, { left: PY.x + PY.w - stamp.offsetWidth - 50 + 'px', top: PY.y + (P ? 455 : 400) + 'px', opacity: Math.min(1, sp * 3) * (1 - sOut), transform: `rotate(-8deg) scale(${s})` });
    } else stamp.style.opacity = 0;
    waves.forEach((wv, i) => { const q = seg(t, B(26) + i * BEAT / 2, .55); set(wv, { opacity: q > 0 && q < 1 && t < B(28) ? ((.16 + .05 * i) * (1 - q)).toFixed(3) : 0, transform: `scale(${lerp(1, 1.14, eo(q))})` }); });

    /* 8 · fin */
    TOK.forEach(({ e, from }, i) => {
      const q = ei(seg(t, B(28) - .45 + i * .03, .42)), on = q > 0 && q < 1;
      set(e, { opacity: on ? 1 : 0, left: lerp(from[0] * W, C8.x, q) - e.offsetWidth / 2 + 'px', top: lerp(from[1] * H, C8.y, q) - e.offsetHeight / 2 + 'px', transform: `rotate(${lerp(i % 2 ? -140 : 140, 0, q)}deg) scale(${lerp(1, .2, q)})`, filter: `blur(${(q * 4).toFixed(1)}px)` });
    });
    const v8 = t >= B(28) - .05;
    L8.style.visibility = v8 ? 'visible' : 'hidden';
    if (v8) {
      const r = lerp(0, P ? 360 : 330, eo(seg(t, B(28), .9)));
      set(disc8, { width: r * 2 + 'px', height: r * 2 + 'px', left: C8.x - r + 'px', top: C8.y - r + 'px' });
      set(logo8Box, { opacity: clamp((t - B(28)) / .08), transform: `scale(${lerp(1.18, 1, eo(seg(t, B(28), .45)))})` });
      logo8.packets(t, B(28) + .1);
      const sq = seg(t, B(28), .8);
      set(shock, { opacity: sq > 0 && sq < 1 ? (.7 * (1 - sq)).toFixed(3) : 0, transform: `scale(${lerp(.5, 2.6, eo(sq))})` });
      set(wm8, { transform: `translateY(${(1 - eo(seg(t, B(28) + .12, .5))) * 105}%)` });
      tagA.style.transform = `translateY(${(1 - eo(seg(t, B(29), .5))) * 110}%)`;
      tagB.style.transform = `translateY(${(1 - eo(seg(t, B(29) + .18, .5))) * 110}%)`;
      const uq = eo(seg(t, B(30), .45));
      set(url8, { opacity: uq, transform: `translateY(${lerp(18, 0, uq)}px)` });
    }
  }

  /* ---------- aperçu dans le navigateur ; le rendu MP4 appelle renderAt(t) lui-même ---------- */
  window.renderAt = render;
  document.fonts.ready.then(() => {
    render(0);
    if (window.__RENDER__) return;
    const hud = h('div', { id: 'hud' }); document.body.append(hud);
    const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`; };
    addEventListener('resize', fit); fit();
    let t0 = performance.now(), off = 0, paused = false, cur = 0;
    addEventListener('keydown', (ev) => {
      if (ev.code === 'Space') paused = !paused;
      if (ev.code === 'ArrowRight') cur = Math.min(TL.duration, cur + BEAT);
      if (ev.code === 'ArrowLeft') cur = Math.max(0, cur - BEAT);
      off = cur; t0 = performance.now();
    });
    const audio = new Audio('../teaser-15s-shared/audio/teaser-musique.wav');
    addEventListener('click', () => { off = 0; t0 = performance.now(); audio.currentTime = 0; audio.play(); });
    const loop = () => {
      cur = paused ? off : (off + (performance.now() - t0) / 1000) % TL.duration;
      render(cur); hud.textContent = `${W}×${H} · ${cur.toFixed(2)} s · temps ${(cur / BEAT).toFixed(1)} (clic = musique)`;
      requestAnimationFrame(loop);
    };
    loop();
  });
})();
