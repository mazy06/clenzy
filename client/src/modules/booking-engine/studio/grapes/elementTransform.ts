import type { Editor } from 'grapesjs';

/**
 * Redimensionnement (échelle) + déplacement au pixel des éléments, RESPONSIVE-SAFE.
 *
 * Principe : tout est écrit dans la règle `#id` de l'élément AU DEVICE COURANT (média-query du
 * DeviceManager) → chaque breakpoint garde sa valeur, le responsive est préservé. On ne pose JAMAIS de
 * largeur/hauteur px fixe ni de position absolue (qui casseraient le flux responsive).
 *
 *  - Échelle (toolbar « − » / « + ») : `zoom` sur l'élément → réduit/agrandit TOUT l'élément (texte +
 *    espacements + enfants) uniformément, avec reflow. Bornée [0.3 … 2].
 *  - Déplacement (flèches clavier) : `transform: translate(Xpx, Ypx)` → décalage visuel au pixel
 *    (Maj = 10px) sans sortir l'élément du flux. `zoom` et `transform` cohabitent (propriétés distinctes).
 */

const SCALE_STEP = 0.1;
const SCALE_MIN = 0.3;
const SCALE_MAX = 2;
const SCALE_DOWN_CMD = 'cz-scale-down';
const SCALE_UP_CMD = 'cz-scale-up';

type AtRuleOpts = { atRuleType?: string; atRuleParams?: string };

type Selected = { getId?: () => string; getEl?: () => HTMLElement | undefined } | undefined;

/** Options d'@-règle pour cibler le device COURANT (média-query), comme le Style Manager de GrapesJS. */
function deviceMediaOpts(editor: Editor): AtRuleOpts {
  const dm = editor.DeviceManager as unknown as {
    get: (id: string) => { get: (k: string) => unknown } | undefined;
  };
  const dev = dm.get(editor.getDevice());
  const w = dev ? String(dev.get('widthMedia') || dev.get('width') || '') : '';
  return w ? { atRuleType: 'media', atRuleParams: `(max-width: ${w})` } : {};
}

/** Lit le style courant de la règle `#id` au device courant (objet vide si absente). */
function readRuleStyle(editor: Editor, id: string, opts: AtRuleOpts): Record<string, string> {
  const css = editor.Css as unknown as {
    getRule: (sel: string, o?: AtRuleOpts) => { getStyle: () => Record<string, string> } | undefined;
  };
  const rule = css.getRule(`#${id}`, opts);
  return rule ? { ...rule.getStyle() } : {};
}

/** Écrit (merge) un style dans la règle `#id` au device courant. */
function writeRuleStyle(editor: Editor, id: string, style: Record<string, string>, opts: AtRuleOpts): void {
  const css = editor.Css as unknown as {
    setRule: (sel: string, style: Record<string, string>, o?: AtRuleOpts) => unknown;
  };
  css.setRule(`#${id}`, style, opts);
}

/** Applique un delta d'échelle (zoom) à l'élément sélectionné, au device courant. */
function adjustScale(editor: Editor, delta: number): void {
  const cmp = editor.getSelected() as Selected;
  if (!cmp || typeof cmp.getId !== 'function') return;
  const id = cmp.getId();
  const opts = deviceMediaOpts(editor);
  const style = readRuleStyle(editor, id, opts);
  const current = parseFloat(style.zoom) || 1;
  const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round((current + delta) * 100) / 100));
  writeRuleStyle(editor, id, { ...style, zoom: String(next) }, opts);
}

/** Déplace l'élément sélectionné de (dx, dy) px via `transform: translate`, au device courant. */
function nudge(editor: Editor, dx: number, dy: number): void {
  const cmp = editor.getSelected() as Selected;
  if (!cmp || typeof cmp.getId !== 'function') return;
  const id = cmp.getId();
  const opts = deviceMediaOpts(editor);
  const style = readRuleStyle(editor, id, opts);
  const m = (style.transform || '').match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/);
  const x = (m ? parseFloat(m[1]) : 0) + dx;
  const y = (m ? parseFloat(m[2]) : 0) + dy;
  writeRuleStyle(editor, id, { ...style, transform: `translate(${x}px, ${y}px)` }, opts);
}

/** Ajoute les boutons toolbar « − » / « + » (échelle) au composant sélectionné (idempotent). */
function addScaleToolbar(cmp: { get: (k: string) => unknown; set: (k: string, v: unknown) => void }): void {
  const toolbar = (cmp.get('toolbar') as Array<{ command?: string }> | undefined) ?? [];
  if (toolbar.some((t) => t.command === SCALE_DOWN_CMD)) return;
  cmp.set('toolbar', [
    { attributes: { class: 'fa fa-search-minus', title: 'Réduire la taille' }, command: SCALE_DOWN_CMD },
    { attributes: { class: 'fa fa-search-plus', title: 'Agrandir la taille' }, command: SCALE_UP_CMD },
    ...toolbar,
  ]);
}

/** Vrai si l'utilisateur est en train d'éditer du texte (RTE) ou un champ → on n'intercepte pas les flèches. */
function isTextEditing(doc: Document): boolean {
  const a = doc.activeElement as HTMLElement | null;
  if (!a) return false;
  return a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT';
}

/**
 * Branche le redimensionnement (échelle) + le déplacement clavier. À appeler une fois après l'init.
 * Aucune valeur en px fixe / position absolue → responsive préservé (tout au device courant).
 */
export function setupElementTransform(editor: Editor): void {
  editor.Commands.add(SCALE_DOWN_CMD, { run: (ed: Editor) => adjustScale(ed, -SCALE_STEP) });
  editor.Commands.add(SCALE_UP_CMD, { run: (ed: Editor) => adjustScale(ed, SCALE_STEP) });

  editor.on('component:selected', (cmp: { get: (k: string) => unknown; set: (k: string, v: unknown) => void }) => {
    addScaleToolbar(cmp);
  });

  // Déplacement au pixel : flèches = 1px, Maj+flèches = 10px (sur l'élément sélectionné, hors édition texte).
  const attachKeys = (): void => {
    const doc = editor.Canvas.getDocument() as (Document & { __czNudge?: boolean }) | undefined;
    if (!doc || doc.__czNudge) return;
    doc.__czNudge = true;
    doc.addEventListener('keydown', (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const dir = map[e.key];
      if (!dir || !editor.getSelected() || isTextEditing(doc)) return;
      e.preventDefault();
      const f = e.shiftKey ? 10 : 1;
      nudge(editor, dir[0] * f, dir[1] * f);
    });
  };
  editor.on('load', attachKeys);
  editor.on('canvas:frame:load', attachKeys);
}
