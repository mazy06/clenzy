import type { Editor } from 'grapesjs';
import { BT_TOKEN_GROUPS, tokenCssValue, type BtToken } from './designTokenCatalog';

/**
 * Type de propriété Style Manager custom `bt-value` : un champ combiné = menu des tokens `--bt-*` du
 * groupe (`tokens` de la propriété) + saisie libre. Choisir un token pose `var(--bt-*)` ; sinon on saisit
 * une valeur CSS quelconque. Permet d'ajuster n'importe quelle propriété en MAPPANT explicitement sur le
 * design system (cohérence édition manuelle ↔ design généré par l'IA, même langage `--bt-*`).
 *
 * <p>Synchro bidirectionnelle : `change()` propage la valeur du champ au composant ; `update({value})`
 * re-remplit le champ depuis le style courant (et re-sélectionne le token si la valeur est `var(--bt-*)`).</p>
 */
export function registerBtValueType(editor: Editor): void {
  // GrapesJS 0.23 : la signature de addType pour un type custom est relâchée → on type localement + caste.
  const addType = editor.StyleManager.addType.bind(editor.StyleManager) as (name: string, def: unknown) => void;

  addType('bt-value', {
    create(this: { el?: HTMLElement }, opts: { props: Record<string, unknown>; change: (d?: { partial?: boolean }) => void }) {
      const group = typeof opts.props?.tokens === 'string' ? opts.props.tokens : '';
      const tokens: BtToken[] = BT_TOKEN_GROUPS[group] ?? [];
      const el = document.createElement('div');
      el.className = 'bt-value';

      const sel = document.createElement('select');
      sel.className = 'bt-value__token';
      sel.title = 'Token de design';
      const custom = document.createElement('option');
      custom.value = '';
      custom.textContent = 'Personnalisé…';
      sel.appendChild(custom);
      for (const t of tokens) {
        const o = document.createElement('option');
        o.value = tokenCssValue(t); // var(--bt-*)
        o.textContent = t.label;
        sel.appendChild(o);
      }

      const inp = document.createElement('input');
      inp.className = 'bt-value__input';
      inp.type = 'text';
      inp.placeholder = 'valeur CSS';
      inp.spellcheck = false;

      el.appendChild(sel);
      el.appendChild(inp);

      sel.addEventListener('change', () => {
        if (sel.value) inp.value = sel.value;
        opts.change();
      });
      inp.addEventListener('change', () => opts.change());
      inp.addEventListener('input', () => opts.change({ partial: true }));
      return el;
    },
    emit(this: { el: HTMLElement }, opts: { updateStyle: (v: string, o?: { partial?: boolean }) => void }, data?: { partial?: boolean }) {
      const inp = this.el.querySelector('.bt-value__input') as HTMLInputElement | null;
      opts.updateStyle(inp ? inp.value : '', { partial: !!data?.partial });
    },
    update(this: { el: HTMLElement }, opts: { value: string }) {
      const value = opts.value ?? '';
      const inp = this.el.querySelector('.bt-value__input') as HTMLInputElement | null;
      const sel = this.el.querySelector('.bt-value__token') as HTMLSelectElement | null;
      if (inp) inp.value = value;
      if (sel) sel.value = Array.from(sel.options).some((o) => o.value === value) ? value : '';
    },
  });
}
