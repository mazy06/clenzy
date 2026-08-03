import React, { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchIcon, XIcon } from 'lucide-react';
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from './ui';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import {
  NAVIGATION_HUBS,
  STANDALONE_SCREENS,
  accessibleHubTabs,
  type HubAccess,
} from '../config/navigationHubs';
import { SCREEN_ICON, sizedIcon } from '../config/navigationIcons';
import { useScreenChrome } from './ScreenChrome';
import { cn } from '../utils/cn';

/**
 * Champ de recherche UNIQUE de l'application (Baitly UI).
 *
 * Il est rendu en permanence dans le `PageHeader` et a deux modes :
 *   - **filtre d'écran** — un écran s'est branché via `useScreenSearch` : la
 *     saisie filtre ses données (plus aucun champ local dans les toolbars) ;
 *   - **aller à l'écran** — aucun écran branché : la saisie propose les écrans
 *     accessibles et navigue, pour que le champ reste utile partout.
 */

interface ScreenTarget {
  label: string;
  path: string;
  group: string;
  icon?: React.ReactNode;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Exception locale au kit, assumee : les champs portent normalement la hairline
 * `--bui-input`, plus marquee que le `--bui-border` des boutons, pour signaler
 * une zone de saisie. Dans la barre de titre, ce champ n'a pour voisins QUE des
 * boutons \u2014 la nuance ne distinguait plus rien, elle se lisait comme un defaut
 * d'alignement. Ailleurs dans l'app, les champs gardent leur bordure de champ.
 */
const HEADER_FIELD_BORDER = 'border-border';

export default function GlobalSearchField({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isAdmin, isManager } = useAuth();
  const { search, setSearchValue, submitSearch } = useScreenChrome();

  const [navQuery, setNavQuery] = useState('');
  const [open, setOpen] = useState(false);
  /**
   * Le champ est REPLIÉ en loupe par défaut, à toutes les largeurs : il
   * occupait une place permanente pour un geste occasionnel. Déployé au clic
   * (focus immédiat), replié quand on le quitte vide — jamais quand un filtre
   * est encore actif, sinon on l'effacerait de vue.
   */
  const [expanded, setExpanded] = useState(false);
  const fieldWrapRef = useRef<HTMLDivElement | null>(null);

  const screens = useMemo<ScreenTarget[]>(() => {
    const access: HubAccess = {
      permissions: user?.permissions ?? [],
      isAdmin: isAdmin(),
      isManager: isManager(),
    };
    const targets: ScreenTarget[] = [];
    NAVIGATION_HUBS.forEach((hub) => {
      accessibleHubTabs(hub, access).forEach((tab) => {
        targets.push({
          label: t(tab.translationKey, tab.fallbackLabel),
          path: tab.path,
          group: t(hub.translationKey, hub.fallbackLabel),
          icon: SCREEN_ICON[tab.path],
        });
      });
    });
    STANDALONE_SCREENS.forEach((screen) => {
      targets.push({
        label: t(screen.translationKey, screen.fallbackLabel),
        path: screen.path,
        group: t('navigation.screens', 'Écrans'),
        icon: SCREEN_ICON[screen.path],
      });
    });
    return targets;
  }, [user?.permissions, isAdmin, isManager, t]);

  const matches = useMemo(() => {
    const query = normalize(navQuery.trim());
    if (!query) return [];
    return screens.filter((screen) => normalize(screen.label).includes(query)).slice(0, 6);
  }, [navQuery, screens]);

  const goTo = (path: string) => {
    setNavQuery('');
    setOpen(false);
    if (path !== pathname) navigate(path);
  };

  /** Déplie le champ ET y pose le focus — sinon le repli au blur ne peut
   *  jamais s'engager et la loupe demanderait deux clics. */
  const expandField = () => {
    setExpanded(true);
    requestAnimationFrame(() => fieldWrapRef.current?.querySelector('input')?.focus());
  };

  /** Icone de repli — champ fermé. */
  const collapsedTrigger = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      /* Pas de taille forcee : `size="icon"` porte le gabarit du kit (32 px,
         rayon 10). Un `size-9` maison desalignait ce bouton de ses voisins. */
      className="shrink-0"
      aria-label={t('common.search', 'Rechercher…')}
      aria-expanded={false}
      onClick={expandField}
    >
      <SearchIcon />
    </Button>
  );

  /**
   * Enveloppe le champ : masqué tant qu'il n'est pas déployé. Le repli se fait
   * à la sortie du champ, et seulement s'il est vide — sinon on effacerait de
   * vue un filtre encore actif.
   */
  const withCollapse = (field: React.ReactNode, isEmpty: boolean) => (
    <>
      {!expanded && collapsedTrigger}
      <div
        ref={fieldWrapRef}
        className={cn('items-center', expanded ? 'flex' : 'hidden')}
        onBlur={(event) => {
          if (isEmpty && !event.currentTarget.contains(event.relatedTarget as Node)) {
            setExpanded(false);
          }
        }}
      >
        {field}
      </div>
    </>
  );

  // Aucune hauteur imposee sur les champs : `cn-input-group` pose deja 32 px,
  // la meme que les boutons de la barre. Un `h-9` maison les faisait depasser
  // de 4 px leurs voisins et cassait l'alignement du header.
  // ── Mode filtre d'écran ───────────────────────────────────────────────────
  if (search) {
    const value = search.value;
    return withCollapse(
      <InputGroup className={cn(HEADER_FIELD_BORDER, 'w-44 md:w-56 lg:w-64', className)}>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={value}
          placeholder={search.placeholder ?? t('common.search', 'Rechercher…')}
          aria-label={search.placeholder ?? t('common.search', 'Rechercher…')}
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
      </InputGroup>,
      value === '',
    );
  }

  // ── Mode « aller à l'écran » ──────────────────────────────────────────────
  return withCollapse(
    <Popover open={open && matches.length > 0} onOpenChange={setOpen}>
      {/* L'ancre enveloppe un <div> (élément hôte) : Radix y pose sa ref de
          positionnement, qu'un composant fonction React 18 ne peut pas recevoir. */}
      <PopoverAnchor asChild>
        <div className={cn('w-40 md:w-56 lg:w-64', className)}>
        <InputGroup className={cn(HEADER_FIELD_BORDER, 'w-full')}>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={navQuery}
            placeholder={t('search.goToScreen', 'Aller à un écran…')}
            aria-label={t('search.goToScreen', 'Aller à un écran…')}
            onChange={(event) => {
              setNavQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                setNavQuery('');
              }
              if (event.key === 'Enter' && matches[0]) goTo(matches[0].path);
            }}
          />
          {navQuery !== '' && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={t('common.clear', 'Effacer')}
                size="icon-xs"
                onClick={() => {
                  setNavQuery('');
                  setOpen(false);
                }}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        className="w-64 p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {matches.map((match) => (
            <li key={match.path}>
              <button
                type="button"
                onClick={() => goTo(match.path)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm text-foreground transition-colors hover:bg-accent"
              >
                <span className="shrink-0 text-muted-foreground">{sizedIcon(match.icon, 14)}</span>
                <span className="truncate">{match.label}</span>
                <span className="ms-auto shrink-0 text-2xs text-muted-foreground">{match.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>,
    navQuery === '',
  );
}
