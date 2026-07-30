import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchIcon, XIcon } from 'lucide-react';
import {
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

export default function GlobalSearchField({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isAdmin, isManager } = useAuth();
  const { search, setSearchValue } = useScreenChrome();

  const [navQuery, setNavQuery] = useState('');
  const [open, setOpen] = useState(false);

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

  // ── Mode filtre d'écran ───────────────────────────────────────────────────
  if (search) {
    const value = search.value;
    return (
      <InputGroup className={cn('h-9 w-40 md:w-56 lg:w-64', className)}>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={value}
          placeholder={search.placeholder ?? t('common.search', 'Rechercher…')}
          aria-label={search.placeholder ?? t('common.search', 'Rechercher…')}
          onChange={(event) => setSearchValue(event.target.value)}
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
    );
  }

  // ── Mode « aller à l'écran » ──────────────────────────────────────────────
  return (
    <Popover open={open && matches.length > 0} onOpenChange={setOpen}>
      {/* L'ancre enveloppe un <div> (élément hôte) : Radix y pose sa ref de
          positionnement, qu'un composant fonction React 18 ne peut pas recevoir. */}
      <PopoverAnchor asChild>
        <div className={cn('h-9 w-40 md:w-56 lg:w-64', className)}>
        <InputGroup className="h-9 w-full">
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
    </Popover>
  );
}
