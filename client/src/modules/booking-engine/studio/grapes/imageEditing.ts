import type { Editor } from 'grapesjs';

/**
 * Édition d'images du template dans le Studio.
 *
 * Problème : les templates posent leurs images en `background-image` (classes CSS `.dx-img-*`,
 * `.dx-hero__bg`…), PAS en `<img>` — or l'Asset Manager GrapesJS ne s'ouvre nativement qu'au double-clic
 * d'un `<img>`. Ce module comble le trou :
 *  1. `loadCanvasImagesIntoAssets` — scanne le canvas (CSS `background-image` + `<img src>`) et ajoute les
 *     URLs à l'Asset Manager → les IMAGES PAR DÉFAUT du template deviennent sélectionnables dans le picker.
 *  2. `setupImageEditing` — sur un élément à `background-image` : bouton toolbar « Changer l'image » +
 *     double-clic → ouvre l'Asset Manager (défauts + médiathèque + UPLOAD existant) ; au choix, applique
 *     l'image en règle `#id` (PAR ÉLÉMENT, prime sur la classe partagée).
 *
 * L'upload + la médiathèque sont déjà branchés (cf. `GrapesStudio` `assetManager.uploadFile`).
 */

const CHANGE_BG_CMD = 'cz-change-bg-image';

/** URL d'un asset GrapesJS (modèle ou chaîne brute). */
function assetUrl(asset: unknown): string | undefined {
  if (typeof asset === 'string') return asset;
  const a = asset as { getSrc?: () => string; get?: (k: string) => unknown } | null;
  if (a && typeof a.getSrc === 'function') return a.getSrc();
  if (a && typeof a.get === 'function') return String(a.get('src') ?? '') || undefined;
  return undefined;
}

/** URL absolue ou racine-relative (on ignore les data:/blob: et gradients). */
function isUsableUrl(u: string): boolean {
  return /^(https?:\/\/|\/)/.test(u);
}

/**
 * Charge les images présentes dans le canvas (CSS `background-image` + `<img src>`) dans l'Asset Manager,
 * sans doublon → le picker propose d'emblée les images par défaut du template.
 */
export function loadCanvasImagesIntoAssets(editor: Editor): void {
  const am = editor.AssetManager;
  const existing = new Set(
    am.getAll().map((a: { get: (k: string) => unknown }) => String(a.get('src') ?? '')),
  );
  const found = new Set<string>();

  const css = editor.getCss?.() ?? '';
  for (const m of css.matchAll(/background(?:-image)?\s*:\s*[^;}]*url\((['"]?)([^'")]+)\1\)/gi)) {
    if (isUsableUrl(m[2])) found.add(m[2]);
  }

  const html = editor.getHtml?.() ?? '';
  for (const m of html.matchAll(/<img[^>]+src=(['"])([^'"]+)\1/gi)) {
    if (isUsableUrl(m[2])) found.add(m[2]);
  }

  const toAdd = Array.from(found).filter((u) => !existing.has(u));
  if (toAdd.length) am.add(toAdd);
}

/** Un composant porte-t-il une `background-image` (et n'est pas un `<img>`, géré nativement) ? */
function hasBackgroundImage(cmp: { getEl?: () => HTMLElement | undefined } | null): boolean {
  const el = cmp?.getEl?.();
  if (!el || el.tagName === 'IMG') return false;
  const win = el.ownerDocument?.defaultView;
  const bg = win ? win.getComputedStyle(el).backgroundImage : '';
  return !!bg && bg !== 'none' && /url\(/i.test(bg);
}

/** Ajoute le bouton toolbar « Changer l'image » au composant (idempotent). */
function addImageToolbarButton(cmp: { get: (k: string) => unknown; set: (k: string, v: unknown) => void }): void {
  const toolbar = (cmp.get('toolbar') as Array<{ command?: string }> | undefined) ?? [];
  if (toolbar.some((t) => t.command === CHANGE_BG_CMD)) return;
  cmp.set('toolbar', [
    { attributes: { class: 'fa fa-picture-o', title: 'Changer l’image' }, command: CHANGE_BG_CMD },
    ...toolbar,
  ]);
}

/**
 * Branche l'édition d'images : scan des défauts à l'ouverture du picker, commande de changement de fond,
 * bouton toolbar + double-clic sur les éléments à `background-image`. À appeler une fois après l'init.
 */
export function setupImageEditing(editor: Editor): void {
  // À chaque ouverture du picker (img natif OU notre commande) : (re)charge les images du template.
  editor.on('run:open-assets', () => loadCanvasImagesIntoAssets(editor));

  // Commande : changer la background-image de l'élément sélectionné, PAR ÉLÉMENT (règle `#id`).
  editor.Commands.add(CHANGE_BG_CMD, {
    run(ed: Editor) {
      const cmp = ed.getSelected() as
        | (Record<string, unknown> & { getId?: () => string; getEl?: () => HTMLElement | undefined })
        | undefined;
      if (!cmp || typeof cmp.getId !== 'function') return;
      loadCanvasImagesIntoAssets(ed);
      const am = ed.AssetManager as unknown as {
        open: (o: unknown) => void;
        render: () => HTMLElement;
      };
      const modal = ed.Modal as unknown as {
        isOpen?: () => boolean;
        open: (o: { title?: string; content?: HTMLElement | string }) => void;
        close: () => void;
      };
      am.open({
        types: ['image'],
        select(asset: unknown) {
          const url = assetUrl(asset);
          if (url) {
            ed.Css.setRule(`#${(cmp.getId as () => string)()}`, {
              'background-image': `url("${url}")`,
              'background-size': 'cover',
              'background-position': 'center',
              'background-repeat': 'no-repeat',
            });
          }
          modal.close(); // 1 clic = applique + ferme
        },
      });
      // Le layout custom (panels strippés) n'ouvre pas la modale via `am.open` seul → on l'ouvre nous-mêmes
      // (la vue Asset Manager — défauts du template + médiathèque + upload — y est déjà rendue).
      if (!modal.isOpen || !modal.isOpen()) {
        modal.open({ title: 'Choisir une image', content: am.render() });
      }
    },
  });

  // Bouton toolbar sur tout élément à background-image sélectionné.
  editor.on('component:selected', (cmp: { getEl?: () => HTMLElement | undefined; get: (k: string) => unknown; set: (k: string, v: unknown) => void }) => {
    if (hasBackgroundImage(cmp)) addImageToolbarButton(cmp);
  });

  // Double-clic sur un élément à background-image → ouvre le picker (parité avec le double-clic sur <img>).
  const attachDblClick = (): void => {
    const doc = editor.Canvas.getDocument() as (Document & { __czImgDbl?: boolean }) | undefined;
    if (!doc || doc.__czImgDbl) return;
    doc.__czImgDbl = true;
    doc.addEventListener('dblclick', () => {
      const cmp = editor.getSelected();
      if (cmp && hasBackgroundImage(cmp as { getEl?: () => HTMLElement | undefined })) {
        editor.runCommand(CHANGE_BG_CMD);
      }
    });
  };
  editor.on('load', attachDblClick);
  editor.on('canvas:frame:load', attachDblClick);
}
