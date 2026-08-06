import { SearchIcon, XIcon } from 'lucide-react';
import { Button } from './ui';
import { useTranslation } from '../hooks/useTranslation';
import { useScreenChrome } from './ScreenChrome';
import { useCommandCenter } from './command-center';
import { openShortcutLabel } from './command-center/shortcuts';
import { cn } from '../utils/cn';

/**
 * Point d'entrée UNIQUE de la recherche — rendu en permanence dans le
 * `PageHeader`.
 *
 * <p>Ce n'est pas un champ mais un DÉCLENCHEUR, et c'est le même partout : un
 * clic (ou ⌘K) ouvre le centre de commande, avec sa liste défilante, ses
 * groupes et sa navigation clavier. Un écran ne doit pas se distinguer d'un
 * autre par ce qui se passe quand on clique sur sa loupe.</p>
 *
 * <p>Ce qui s'adapte, c'est ce qu'il ANNONCE :</p>
 * <ul>
 *   <li>écran sans filtre → « Rechercher ou commander » ;</li>
 *   <li>écran qui filtre ses données, filtre inactif → le libellé de l'écran
 *       (« Rechercher un logement… ») ;</li>
 *   <li>filtre actif → la valeur en cours, avec une croix pour l'annuler sans
 *       passer par la palette.</li>
 * </ul>
 *
 * <p>La saisie, elle, vit dans la palette : c'est là que la liste défile et que
 * les résultats se montrent. Deux endroits où taper, c'était deux moteurs à
 * comprendre.</p>
 */

/**
 * Exception locale au kit, assumee : les champs portent normalement la hairline
 * `--bui-input`, plus marquee que le `--bui-border` des boutons, pour signaler
 * une zone de saisie. Dans la barre de titre, ce declencheur n'a pour voisins
 * QUE des boutons — la nuance ne distinguait plus rien, elle se lisait comme un
 * defaut d'alignement.
 */
const HEADER_FIELD_BORDER = 'border-border';

/** Largeur du déclencheur déployé. */
const FIELD_WIDTH = 'md:w-56 lg:w-64';

/** Pastille du raccourci. */
const SHORTCUT_BADGE =
  'shrink-0 rounded border border-border px-1 font-sans text-2xs font-medium text-muted-foreground';

export default function GlobalSearchField({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { search, setSearchValue } = useScreenChrome();
  const { openCenter } = useCommandCenter();

  const activeFilter = search?.value ?? '';
  const hasFilter = activeFilter.trim() !== '';

  /** Ce que le déclencheur annonce, selon l'écran et l'état du filtre. */
  const label = hasFilter
    ? activeFilter
    : search?.placeholder ?? t('commandCenter.trigger', 'Rechercher ou commander');

  /** Nom accessible : la valeur seule ne dirait pas ce qu'on ouvre. */
  const ariaLabel = hasFilter
    ? `${t('commandCenter.trigger', 'Rechercher ou commander')} — ${activeFilter}`
    : label;

  // Ouvre la palette pré-remplie du filtre en cours : on affine ce qui est déjà
  // posé plutôt que de le retaper.
  const open = () => openCenter(activeFilter);

  return (
    <>
      {/* Sous 768 px la barre de titre n'a plus la place d'un libellé : loupe
          seule, même action. */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('shrink-0 md:hidden', hasFilter && 'border-primary text-primary')}
        aria-label={ariaLabel}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={open}
      >
        <SearchIcon />
      </Button>

      {/* Filtre inactif : un simple bouton, tout l'objet est cliquable. */}
      {!hasFilter && (
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
          aria-label={ariaLabel}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={open}
        >
          <SearchIcon />
          <span className="truncate">{label}</span>
          <kbd className={cn(SHORTCUT_BADGE, 'ms-auto')}>{openShortcutLabel()}</kbd>
        </Button>
      )}

      {/* Filtre actif : DEUX commandes côte à côte — ouvrir la palette, annuler
          le filtre. Annuler est trop fréquent pour imposer un aller-retour par
          la palette, et un élément focusable dans un `<button>` est interdit
          par le HTML : c'est l'enveloppe qui porte la bordure, pas le bouton.
          Gabarit repris du kit (h-8, rounded-lg, border-border) pour rester
          aligné sur les boutons voisins de la barre de titre. */}
      {hasFilter && (
        <div
          className={cn(
            'hidden h-8 items-center gap-2 rounded-lg border border-border bg-background bg-clip-padding ps-2.5 pe-1 md:flex dark:border-input dark:bg-input/30',
            FIELD_WIDTH,
            className,
          )}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-start text-sm text-foreground outline-none focus-visible:underline"
            aria-label={ariaLabel}
            aria-keyshortcuts="Meta+K Control+K"
            onClick={open}
          >
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('common.clear', 'Effacer')}
            onClick={() => setSearchValue('')}
          >
            <XIcon />
          </Button>
        </div>
      )}
    </>
  );
}
