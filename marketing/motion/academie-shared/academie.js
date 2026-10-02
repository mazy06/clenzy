/*
  Baitly Académie · composants communs des épisodes (9:16 et 16:9).

  À quoi sert ce fichier : fournir aux épisodes la mise en page selon le format et les composants
  pédagogiques de la série, par-dessus le kit des Reels (../shared/kit.js : sous-titres, plans calés
  sur la voix, écran de fin). Un épisode appelle `const A = Academie.init(K)` puis compose ses
  scènes avec : tag (étiquette de la série), head (index + titre + sous-titre), card (carte),
  frac (fraction de formule), cal (calendrier du mois), gauge (jauge circulaire), bars (barres de
  prix + moyenne), rchip (ligne du récapitulatif), rise (entrée avec flou de mouvement), progress (barre
  des chapitres, pour les épisodes longs), trap (pastille « Piège » posée dans une carte).
  À qui il s'adresse : motion designer, développeur.
*/
(function () {
  function init(K) {
    const { h, icon, set, prog, lerp, easeOut, easeIn, stage } = K;
    const P = (K.TL.height || 1920) > (K.TL.width || 1080);
    stage.prepend(h('div', { id: 'adots' }));
    stage.append(h('div', { id: 'grain' }));

    // Mise en page : 9:16 = titre en haut, carte dessous ; 16:9 = titre à gauche, carte à droite.
    const L = P
      ? { P, tag: { x: 90, y: 250 }, head: { x: 90, y: 340, w: 900 }, card: { x: 70, y: 680, w: 940, h: 810 } }
      : { P, tag: { x: 120, y: 150 }, head: { x: 120, y: 250, w: 760 }, card: { x: 950, y: 130, w: 850, h: 800 } };

    const abs = (x, y, w, hh, cls = '', st = '') => { const e = h('div', { class: ('abs ' + cls).trim(), style: `left:${x}px;top:${y}px;${w != null ? `width:${w}px;` : ''}${hh != null ? `height:${hh}px;` : ''}${st}` }); stage.append(e); return e; };
    const blur = (p, max) => `blur(${(Math.pow(1 - Math.min(1, Math.max(0, p)), 2) * max).toFixed(2)}px)`;
    /** Entrée : fondu + montée + flou de mouvement ; `v` = visibilité du plan. */
    const rise = (el, v, p, dy = 40, extra = '') => set(el, { opacity: v * p, transform: `translateY(${lerp(dy, 0, p)}px) ${extra}`, filter: blur(p, 8) });

    /** Étiquette de la série, en haut : « Baitly Académie · 01 · Piloter ». */
    function tag(ep, theme) {
      const el = abs(L.tag.x, L.tag.y, null, null, 'atag');
      el.append(h('span', { class: 'mk' }, icon('house', 26)), 'Baitly Académie', h('span', { class: 'sep' }, '·'), h('em', {}, ep), h('span', { class: 'sep' }, '·'), theme);
      return { el, render(t, a, b) { const p = easeOut(prog(t, a, .5)) * (1 - easeIn(prog(t, b - .3, .3))); set(el, { opacity: p, transform: `translateY(${lerp(-16, 0, p)}px)` }); } };
    }

    /** Titre de scène : index (1, 2, 3…) facultatif, titre, sous-titre ; chaque ligne sort d'un masque. */
    function head(ix, title, sub) {
      const T = h('div', { class: 'tt' }, title), S = sub ? h('div', { class: 'sb' }, sub) : null, I = ix ? h('span', { class: 'ix' }, ix) : null;
      const el = abs(L.head.x, L.head.y, L.head.w, null, 'ahead');
      el.append(h('div', { class: 'row' }, I, h('div', { class: 'mask' }, T)));
      if (S) el.append(h('div', { class: 'mask' }, S));      // append(null) écrirait « null »
      const line = (x, t, a, b) => { const pi = easeOut(prog(t, a, .5)), po = easeIn(prog(t, b - .3, .3)); set(x, { transform: `translateY(${(1 - pi) * 110 - po * 110}%)`, filter: blur(pi, 6) }); };
      return {
        el,
        render(t, a, b) {
          const on = t > a - .1 && t < b + .05; el.style.visibility = on ? 'visible' : 'hidden'; if (!on) return;
          line(T, t, a + .05, b); if (S) line(S, t, a + .2, b);
          if (I) { const q = easeOut(prog(t, a, .45)), o = easeIn(prog(t, b - .3, .3)); set(I, { opacity: q * (1 - o), transform: `scale(${lerp(.5, 1, q)}) rotate(${lerp(-12, 0, q)}deg)` }); }
        },
      };
    }

    /** Carte pédagogique à l'emplacement du visuel. */
    function card(pad = P ? 52 : 50) {
      const el = abs(L.card.x, L.card.y, L.card.w, L.card.h, 'acard', `padding:${pad}px;display:flex;flex-direction:column;opacity:0`);
      return { el, render(t, a, b) { const p = easeOut(prog(t, a, .55)), o = easeIn(prog(t, b - .3, .3)); set(el, { opacity: p * (1 - o), transform: `perspective(2000px) rotateX(${lerp(10, 0, p)}deg) translateY(${lerp(70, 0, p) - o * 30}px)`, filter: blur(p, 8) }); } };
    }

    /** Fraction « numérateur / dénominateur » ; highlight(n, d) surligne l'un ou l'autre. */
    function frac(num, den, width) {
      const n = h('div', { class: 'n' }, num), d = h('div', { class: 'd' }, den), bar = h('div', { class: 'fbar', style: `width:${width}px` });   // pas « .bar » : pris par base.css
      const el = h('div', { class: 'frac' }, n, bar, d);
      return { el, n, d, bar, set(t, tn, td) { n.classList.toggle('hi', t >= tn - .05 && t < td - .05); d.classList.toggle('hi', t >= td - .05); } };
    }

    /** Calendrier du mois : `days` jours, `cols` colonnes, première case décalée de `offset`. */
    function cal(days, cols, cell, offset = 0) {
      const cells = [];
      const el = h('div', { class: 'cal', style: `grid-template-columns:repeat(${cols}, ${cell}px);grid-auto-rows:${cell}px` });
      for (let i = 0; i < offset; i++) el.append(h('i', { class: 'x' }));
      for (let d = 1; d <= days; d++) { const c = h('i', { style: `font-size:${cell * .34}px` }, String(d)); el.append(c); cells.push(c); }
      return {
        el, cells,
        /** Remplit `order` (indices) à partir de t0, une case toutes les `step` secondes. */
        fill(t, t0, order, step = .05, color = '#9A6C3A') {
          cells.forEach((c, i) => {
            const k = order.indexOf(i), p = k < 0 ? 0 : easeOut(prog(t, t0 + k * step, .25));
            set(c, { background: p > 0 ? `color-mix(in srgb, ${color} ${Math.round(p * 100)}%, #EEF3F6)` : '#EEF3F6', color: p > .5 ? '#FDFDFE' : '#98A4AB', transform: `scale(${1 + .12 * Math.sin(Math.PI * p)})` });
          });
        },
      };
    }

    /** Jauge circulaire : set(p) de 0 à 1, libellé au centre. */
    function gauge(size, stroke = 22, color = '#9A6C3A') {
      const r = size / 2 - stroke;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`);
      const mk = (col, dash) => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', r); c.setAttribute('fill', 'none'); c.setAttribute('stroke', col); c.setAttribute('stroke-width', stroke); c.setAttribute('stroke-linecap', 'round'); c.setAttribute('pathLength', 100); c.setAttribute('transform', 'rotate(-90)'); if (dash) c.setAttribute('stroke-dasharray', dash); svg.append(c); return c; };
      mk('rgba(154,108,58,.16)'); const arc = mk(color, '0 100');
      const lbl = h('b', { style: `font-size:${size * .24}px` });
      const el = h('div', { class: 'gauge', style: `position:relative;width:${size}px;height:${size}px;flex:none` }, svg, lbl);
      return { el, set(p, text) { arc.setAttribute('stroke-dasharray', `${p * 100} 100`); lbl.textContent = text; } };
    }

    /** Barres de prix par nuit + ligne de moyenne (étiquette). */
    function bars(values, avg, height, label) {
      const max = Math.max(...values) * 1.08;
      const bs = values.map((v) => h('i', { style: `height:${v / max * 100}%` }));
      const line = h('div', { class: 'avg', style: `bottom:${avg / max * 100}%;opacity:0` }, h('span', {}, label));
      const el = h('div', { class: 'bars', style: `height:${height}px` }, bs, line);
      return { el, grow(t, t0, step = .03) { bs.forEach((b, i) => { const p = easeOut(prog(t, t0 + i * step, .35)); b.style.transform = `scaleY(${p})`; b.style.opacity = p; }); }, line };
    }

    /** Ligne du récapitulatif : icône, libellé (+ rappel de formule facultatif), valeur. */
    function rchip(ic, label, value, formula) {
      const tx = h('div', { class: 'tx' }, h('b', {}, label));
      if (formula) tx.append(h('small', {}, formula));
      const el = h('div', { class: 'rchip' }, h('span', { class: 'ic' }, icon(ic, 40)), tx);
      if (value) el.append(h('span', { class: 'v' }, value));
      return el;
    }

    /** Barre des chapitres, en haut (un segment par plan, rempli au fil du plan) : on sait où on en est. */
    function progress(n) {
      const el = abs(P ? 90 : 120, P ? 176 : 84, P ? 900 : 1680, null, 'aprog', 'opacity:0');
      const fills = Array.from({ length: n }, () => { const f = h('i'); el.append(h('span', {}, f)); return f; });
      return {
        el,
        render(t, slots, end) {
          el.style.opacity = easeOut(prog(t, .1, .5)) * (1 - easeIn(prog(t, end - .3, .3)));
          fills.forEach((f, i) => { const [a, b] = slots[i]; f.style.transform = `scaleX(${Math.min(1, Math.max(0, (t - a) / (b - a)))})`; });
        },
      };
    }

    /** Pastille « Piège » dans le coin d'une carte ; render(t, t0, visibilité du plan). */
    function trap(parent, label) {
      const el = h('div', { class: 'atrap', style: 'opacity:0' }, icon('alert', 26), label);
      parent.append(el);
      return { el, render(t, t0, v) { const p = easeOut(prog(t, t0, .4)); set(el, { opacity: p * v, transform: `translateY(${lerp(-12, 0, p)}px) scale(${lerp(.85, 1, p)})` }); } };
    }

    return { P, L, abs, rise, blur, tag, head, card, frac, cal, gauge, bars, rchip, progress, trap };
  }
  window.Academie = { init };
})();
