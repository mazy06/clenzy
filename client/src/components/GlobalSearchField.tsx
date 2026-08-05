import React, { useRef, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './ui';
import { useTranslation } from '../hooks/useTranslation';
import { useScreenChrome } from './ScreenChrome';
import { useCommandCenter } from './command-center';
import { openShortcutLabel } from './command-center/shortcuts';
import { cn } from '../utils/cn';

/**
 * Champ de recherche UNIQUE de l'application (Baitly UI).
 *
 * Rendu en permanence dans le `PageHeader`, il a deux modes — mais UN SEUL
 * gabarit : même largeur, même bordure, même pastille ⌘K à droite. Un écran ne
 * doit pas se distinguer d'un autre par la forme de sa barre de recherche ;
 * c'est le CONTENU qui s'adapte, pas la coquille.
 *
 *   - **filtre d'écran** — un écran s'est branché via `useScreenSearch` : on
 *     tape directement dedans pour filtrer ses données, en un geste. Le
 *     placeholder vient de l'écran (« Rechercher un logement… »), la pastille
 *     ⌘K rappelle que la palette reste ouvrable depuis le champ ;
 *   - **centre de commande** — aucun écran branché : le champ devient le
 *     déclencheur de la palette, qui sait aller à un écran, créer, changer
 *     l'affichage, ouvrir un outil.
 *
 * Sous 768 px, les deux modes se replient en loupe : la barre de titre n'a plus
 * la place d'un champ.
 */

/**
 * Exception locale au kit, assumee : les champs portent normalement la hairline
 * `--bui-input`, plus marquee que le `--bui-border` des boutons, pour signaler
 * une zone de saisie. Dans la barre de titre, ce champ n'a pour voisins QUE des
 * boutons — la nuance ne distinguait plus rien, elle se lisait comme un defaut
 * d'alignement. Ailleurs dans l'app, les champs gardent leur bordure de champ.
 */
const HEADER_FIELD_BORDER = 'border-border';

/** Largeur commune aux deux modes — c'est elle qui fait l'identité visuelle. */
const FIELD_WIDTH = 'md:w-56 lg:w-64';

/** Pastille du raccourci, identique dans le champ et dans le déclencheur. */
const SHORTCUT_BADGE =
  'shrink-0 rounded border border-border px-1 font-sans text-2xs font-medium text-muted-foreground';

export default function GlobalSearchField({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { search, setSearchValue, submitSearch } = useScreenChrome();
  const { openCenter } = useCommandCenter();

  /**
   * Repli en loupe SOUS 768 px uniquement. Au-dessus, le champ est permanent :
   * l'emplacement est de toute façon occupé par le déclencheur sur les écrans
   * sans filtre — le masquer ici ne rendrait aucune place et ferait diverger
   * l'allure des deux modes.
   */
  const [expanded, setExpanded] = useState(false);
  const fieldWrapRef = useRef<HTMLDivElement | null>(null);

  const shortcut = openShortcutLabel();

  /** Déplie le champ ET y pose le focus — sinon la loupe demanderait 2 clics. */
  const expandField = () => {
    setExpanded(true);
    requestAnimationFrame(() => fieldWrapRef.current?.querySelector('input')?.focus());
  };

  // ── Mode « centre de commande » ───────────────────────────────────────────
  // Pas de champ : un déclencheur. La saisie se fait DANS la palette, qui porte
  // la navigation clavier, les groupes et les raccourcis.
  if (!search) {
    const triggerLabel = t('commandCenter.trigger', 'Rechercher ou commander');
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 md:hidden"
          aria-label={triggerLabel}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={() => openCenter()}
        >
          <SearchIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn(
            HEADER_FIELD_BORDER,
            FIELD_WIDTH,
            // Aucune hauteur imposee : le gabarit du kit (32 px) est deja celui
            // des boutons voisins de la barre de titre.
            'hidden justify-start gap-2 px-2.5 font-normal text-muted-foreground md:flex',
            className,
          )}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={() => openCenter()}
        >
          <SearchIcon />
          <span className="truncate">{triggerLabel}</span>
          <kbd className={cn(SHORTCUT_BADGE, 'ms-auto')}>{shortcut}</kbd>
        </Button>
      </>
    );
  }

  // ── Mode filtre d'écran ───────────────────────────────────────────────────
  const value = search.value;
  const label = search.placeholder ?? t('common.search', 'Rechercher…');

  return (
    <>
      {!expanded && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          /* Pas de taille forcee : `size="icon"` porte le gabarit du kit (32 px,
             rayon 10). Un `size-9` maison desalignait ce bouton de ses voisins. */
          className="shrink-0 md:hidden"
          aria-label={label}
          aria-expanded={false}
          onClick={expandField}
        >
          <SearchIcon />
        </Button>
      )}
      <div
        ref={fieldWrapRef}
        className={cn('items-center', expanded ? 'flex' : 'hidden md:flex')}
        onBlur={(event) => {
          // Repli mobile uniquement, et jamais tant qu'un filtre est actif :
          // on effacerait de vue un filtre encore en vigueur.
          if (value === '' && !event.currentTarget.contains(event.relatedTarget as Node)) {
            setExpanded(false);
          }
        }}
      >
        <InputGroup className={cn(HEADER_FIELD_BORDER, 'w-44', FIELD_WIDTH, className)}>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={value}
            placeholder={label}
            aria-label={label}
            aria-keyshortcuts="Meta+K Control+K"
            onChange={(event) => setSearchValue(event.target.value)}
            // Entrée : soumet à l'écran branché s'il porte un onSubmit (ex.
            // Planning + constellation ouverte → demande aux agents). Sans
            // onSubmit, ne fait rien — le filtre agit déjà à la frappe.
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitSearch();
            }}
          />
          <InputGroupAddon align="inline-end">
            {value !== '' ? (
              <InputGroupButton
                aria-label={t('common.clear', 'Effacer')}
                size="icon-xs"
                onClick={() => setSearchValue('')}
              >
                <XIcon />
              </InputGroupButton>
            ) : (
              // Décorative : le raccourci est capté globalement (cf.
              // `useCommandShortcuts`), y compris depuis ce champ. Elle n'est là
              // que pour donner au filtre la MÊME signature que le déclencheur
              // des écrans sans filtre.
              <kbd aria-hidden className={cn(SHORTCUT_BADGE, 'pointer-events-none')}>
                {shortcut}
              </kbd>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
    </>
  );
}
