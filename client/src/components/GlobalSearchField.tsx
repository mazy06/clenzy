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
 * Il est rendu en permanence dans le `PageHeader` et a deux modes :
 *   - **filtre d'écran** — un écran s'est branché via `useScreenSearch` : la
 *     saisie filtre ses données (plus aucun champ local dans les toolbars) ;
 *   - **centre de commande** — aucun écran branché : le champ n'est plus un
 *     champ mais le déclencheur de la palette ⌘K, qui sait faire tout ce que
 *     l'ancienne liste déroulante faisait (aller à un écran) et le reste :
 *     créer, changer l'affichage, ouvrir un outil. Une seule liste à
 *     maintenir, un seul endroit où chercher.
 */

/**
 * Exception locale au kit, assumee : les champs portent normalement la hairline
 * `--bui-input`, plus marquee que le `--bui-border` des boutons, pour signaler
 * une zone de saisie. Dans la barre de titre, ce champ n'a pour voisins QUE des
 * boutons — la nuance ne distinguait plus rien, elle se lisait comme un defaut
 * d'alignement. Ailleurs dans l'app, les champs gardent leur bordure de champ.
 */
const HEADER_FIELD_BORDER = 'border-border';

export default function GlobalSearchField({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { search, setSearchValue, submitSearch } = useScreenChrome();
  const { openCenter } = useCommandCenter();

  /**
   * Le champ de filtre est REPLIÉ en loupe par défaut, à toutes les largeurs :
   * il occupait une place permanente pour un geste occasionnel. Déployé au clic
   * (focus immédiat), replié quand on le quitte vide — jamais quand un filtre
   * est encore actif, sinon on l'effacerait de vue.
   */
  const [expanded, setExpanded] = useState(false);
  const fieldWrapRef = useRef<HTMLDivElement | null>(null);

  /** Déplie le champ ET y pose le focus — sinon le repli au blur ne peut
   *  jamais s'engager et la loupe demanderait deux clics. */
  const expandField = () => {
    setExpanded(true);
    requestAnimationFrame(() => fieldWrapRef.current?.querySelector('input')?.focus());
  };

  // ── Mode « centre de commande » ───────────────────────────────────────────
  // Pas de champ : un déclencheur. La saisie se fait DANS la palette, qui porte
  // la navigation clavier, les groupes et les raccourcis.
  if (!search) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn('shrink-0 md:hidden', className)}
          aria-label={t('commandCenter.trigger', 'Rechercher ou commander')}
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
            // Aucune hauteur imposee : le gabarit du kit (32 px) est deja celui
            // des boutons voisins de la barre de titre.
            'hidden md:flex md:w-56 lg:w-64 justify-start gap-2 px-2.5 font-normal text-muted-foreground',
            className,
          )}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={() => openCenter()}
        >
          <SearchIcon />
          <span className="truncate">{t('commandCenter.trigger', 'Rechercher ou commander')}</span>
          <kbd className="ms-auto shrink-0 rounded border border-border px-1 text-2xs text-muted-foreground">
            {openShortcutLabel()}
          </kbd>
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
          className="shrink-0"
          aria-label={label}
          aria-expanded={false}
          onClick={expandField}
        >
          <SearchIcon />
        </Button>
      )}
      <div
        ref={fieldWrapRef}
        className={cn('items-center', expanded ? 'flex' : 'hidden')}
        onBlur={(event) => {
          if (value === '' && !event.currentTarget.contains(event.relatedTarget as Node)) {
            setExpanded(false);
          }
        }}
      >
        <InputGroup className={cn(HEADER_FIELD_BORDER, 'w-44 md:w-56 lg:w-64', className)}>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={value}
            placeholder={label}
            aria-label={label}
            onChange={(event) => setSearchValue(event.target.value)}
            // Entrée : soumet à l'écran branché s'il porte un onSubmit (ex.
            // Planning + constellation ouverte → demande aux agents). Sans
            // onSubmit, ne fait rien — le filtre agit déjà à la frappe.
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitSearch();
            }}
          />
          {value !== '' && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={t('common.clear', 'Effacer')}
                size="icon-xs"
                onClick={() => setSearchValue('')}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>
    </>
  );
}
