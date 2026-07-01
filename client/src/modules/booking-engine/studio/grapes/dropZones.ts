import type { Editor, Component } from 'grapesjs';

/**
 * DnD horizontal — « zones de dépôt » gauche/droite en plus de haut/bas.
 *
 * Problème : en flux CSS `block`, le sorter natif de GrapesJS ne propose que des dépôts
 * verticaux (au-dessus / en-dessous). Impossible de poser une image À GAUCHE d'un titre
 * sans passer le conteneur en `flex row` à la main.
 *
 * Solution (sur les API GrapesJS existantes, sans réécrire le sorter) :
 *  1. Pendant un drag (bloc de la palette OU déplacement d'un composant), on suit le pointeur
 *     dans le canvas, on calcule la zone survolée (haut/bas/gauche/droite) et on dessine un repère.
 *  2. Au dépôt LATÉRAL (gauche/droite), on poste-traite : on enveloppe la cible + l'élément déposé
 *     dans une `div` `flex row` (réutilisée si elle existe déjà). Le dépôt haut/bas reste 100% natif.
 *
 * Le wrapper est une simple `div` flex → aucun impact sur les sites publiés (CSS standard).
 */
type Zone = 'top' | 'bottom' | 'left' | 'right';

const SIDE_THRESHOLD = 0.35;        // fraction de largeur considérée « bord » gauche/droite
const ROW_ATTR = 'data-bt-row';     // marque nos conteneurs-ligne (évite le double wrapping)
const OVERLAY_ID = 'bt-dropzone-overlay';
const BAR = 4;                      // épaisseur du repère (px)
const ACCENT = '#5453D6';

export function registerDropZones(editor: Editor): void {
  let dragging = false;
  let wrapping = false;             // garde anti-réentrance : nos propres ajouts ne se re-traitent pas
  let lastZone: Zone | null = null;
  let lastTarget: Component | null = null;
  let movingComp: Component | null = null; // composant déplacé (cas « move » d'un élément existant)
  let rafPending = false;

  const doc = () => editor.Canvas.getDocument();
  const win = () => editor.Canvas.getWindow();
  const body = () => editor.Canvas.getBody();

  // ── Repère visuel ───────────────────────────────────────────────────────────
  function overlayEl(): HTMLElement | null {
    const b = body();
    const d = doc();
    if (!b || !d) return null;
    let ov = b.querySelector<HTMLElement>(`#${OVERLAY_ID}`);
    if (!ov) {
      ov = d.createElement('div');
      ov.id = OVERLAY_ID;
      ov.style.cssText =
        `position:absolute;z-index:99999;pointer-events:none;display:none;`
        + `background:${ACCENT};border-radius:3px;box-shadow:0 0 0 2px ${ACCENT}33;transition:all .04s linear;`;
      b.appendChild(ov);
    }
    return ov;
  }
  function hideOverlay() {
    const b = body();
    const ov = b?.querySelector<HTMLElement>(`#${OVERLAY_ID}`);
    if (ov) ov.style.display = 'none';
  }
  function showOverlay(comp: Component, zone: Zone) {
    const el = comp.getEl();
    const ov = overlayEl();
    if (!el || !ov) return;
    const r = el.getBoundingClientRect();
    const w = win();
    const top = r.top + w.scrollY;
    const left = r.left + w.scrollX;
    if (zone === 'left' || zone === 'right') {
      ov.style.top = `${top}px`;
      ov.style.height = `${r.height}px`;
      ov.style.width = `${BAR}px`;
      ov.style.left = `${(zone === 'left' ? left : left + r.width) - BAR / 2}px`;
    } else {
      ov.style.left = `${left}px`;
      ov.style.width = `${r.width}px`;
      ov.style.height = `${BAR}px`;
      ov.style.top = `${(zone === 'top' ? top : top + r.height) - BAR / 2}px`;
    }
    ov.style.display = 'block';
  }

  // ── Détection composant + zone sous le pointeur ──────────────────────────────
  function compAtPoint(x: number, y: number): Component | null {
    const d = doc();
    const el = d ? (d.elementFromPoint(x, y) as HTMLElement | null) : null;
    if (!el) return null;
    const wrapper = editor.getWrapper();
    if (!wrapper) return null;
    let cur: Component = wrapper;
    let advanced = true;
    while (advanced) {
      advanced = false;
      const kids = cur.components();
      for (let i = 0; i < kids.length; i += 1) {
        const k = kids.at(i);
        const kel = k.getEl();
        if (kel && (kel === el || kel.contains(el))) { cur = k; advanced = true; break; }
      }
    }
    return cur === wrapper ? null : cur;
  }
  function zoneFor(comp: Component, x: number, y: number): Zone {
    const el = comp.getEl();
    if (!el) return 'bottom';
    const r = el.getBoundingClientRect();
    const rx = (x - r.left) / Math.max(1, r.width);
    const ry = (y - r.top) / Math.max(1, r.height);
    if (rx < SIDE_THRESHOLD) return 'left';
    if (rx > 1 - SIDE_THRESHOLD) return 'right';
    return ry < 0.5 ? 'top' : 'bottom';
  }

  function onMove(e: MouseEvent) {
    if (!dragging || rafPending) return;
    rafPending = true;
    const cx = e.clientX;
    const cy = e.clientY;
    win().requestAnimationFrame(() => {
      rafPending = false;
      const comp = compAtPoint(cx, cy);
      if (!comp || !comp.getEl() || comp === movingComp) { lastTarget = null; lastZone = null; hideOverlay(); return; }
      lastTarget = comp;
      lastZone = zoneFor(comp, cx, cy);
      showOverlay(comp, lastZone);
    });
  }

  // ── Mise en ligne flex (wrap) ────────────────────────────────────────────────
  function wrapSideBySide(moved: Component, target: Component, side: Zone) {
    const parent = target.parent();
    if (!parent || moved === target) return;
    // La cible doit être (devenue) sœur de l'élément déposé — sinon repli silencieux (placement natif).
    if (moved.parent() !== parent) return;
    wrapping = true;
    try {
      if (parent.getAttributes()[ROW_ATTR]) {
        // Déjà une de nos lignes → on insère juste au bon index, pas de double conteneur.
        const idx = target.index() + (side === 'right' ? 1 : 0);
        parent.append(moved, { at: idx });
      } else {
        const at = target.index();
        const added = parent.append(
          {
            tagName: 'div',
            attributes: { [ROW_ATTR]: 'true' },
            style: { display: 'flex', 'flex-direction': 'row', 'align-items': 'center', gap: '16px', 'flex-wrap': 'wrap' },
          },
          { at },
        );
        const row = (Array.isArray(added) ? added[0] : added) as Component;
        // GrapesJS n'applique pas le `style` passé à la définition → on le pose explicitement (sinon display reste block).
        row.setStyle({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', gap: '16px', 'flex-wrap': 'wrap' });
        if (side === 'left') { row.append(moved); row.append(target); }
        else { row.append(target); row.append(moved); }
      }
      editor.select(moved);
    } finally {
      wrapping = false;
    }
  }

  function maybeWrap(moved: Component | null) {
    if (!moved || !lastTarget || (lastZone !== 'left' && lastZone !== 'right')) return;
    if (moved === lastTarget) return;
    wrapSideBySide(moved, lastTarget, lastZone);
  }

  // ── Cycle de drag ────────────────────────────────────────────────────────────
  function onEnd() {
    // Différé : laisse `component:add` (drop) lire lastZone/lastTarget AVANT le nettoyage.
    setTimeout(stop, 0);
  }
  function start() {
    if (dragging) return;
    dragging = true;
    const d = doc();
    if (!d) return;
    d.addEventListener('mousemove', onMove, true);
    d.addEventListener('dragover', onMove as EventListener, true); // drag HTML5 des blocs
    // Fin de drag fiable (block:drag:stop ne se déclenche pas toujours) → on hide/nettoie sur mouseup/drop/dragend.
    d.addEventListener('mouseup', onEnd, true);
    d.addEventListener('drop', onEnd, true);
    d.addEventListener('dragend', onEnd, true);
  }
  function stop() {
    if (!dragging) return;
    dragging = false;
    const d = doc();
    if (d) {
      d.removeEventListener('mousemove', onMove, true);
      d.removeEventListener('dragover', onMove as EventListener, true);
      d.removeEventListener('mouseup', onEnd, true);
      d.removeEventListener('drop', onEnd, true);
      d.removeEventListener('dragend', onEnd, true);
    }
    hideOverlay();
    lastZone = null;
    lastTarget = null;
    movingComp = null;
  }

  // Blocs déposés depuis la palette → `component:add`.
  editor.on('block:drag:start', start);
  editor.on('component:add', (comp: Component) => {
    if (wrapping || !dragging) return;
    maybeWrap(comp);
    hideOverlay(); // le repère disparaît dès le dépôt (ne pas attendre block:drag:stop)
  });
  editor.on('block:drag:stop', stop);

  // Déplacement d'un composant existant → `component:drag:*` (best-effort selon la version).
  editor.on('component:drag:start', () => { movingComp = editor.getSelected() ?? null; start(); });
  editor.on('component:drag:end', () => { if (!wrapping) maybeWrap(movingComp); movingComp = null; stop(); });
}
