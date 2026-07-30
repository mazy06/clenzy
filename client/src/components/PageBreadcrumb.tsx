import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDownIcon } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import {
  STANDALONE_SCREENS,
  accessibleHubTabs,
  findHubForPath,
  tabMatchesPath,
  tabRoutePrefixes,
  type HubAccess,
} from '../config/navigationHubs';
import { HUB_ICON, SCREEN_ICON, sizedIcon } from '../config/navigationIcons';
import { useScreenChrome } from './ScreenChrome';
import { cn } from '../utils/cn';

/**
 * Fil d'Ariane Baitly — « où suis-je ? », dérivé de la route puis complété par
 * l'onglet actif de l'écran :
 *
 *   Exploitation ▾ › Propriétés › Villa Amal › Tarification
 *   └ hub (menu des    └ écran     └ fiche      └ onglet interne
 *      écrans frères)                (titre)      (via PageTabs)
 *
 * Le segment de hub est un menu déroulant : il remplace le switcher segmenté
 * historique (HubScreenSwitcher) sans perdre la navigation de niveau 1.
 */

export interface BreadcrumbSegment {
  label: string;
  icon?: React.ReactNode;
  /** Route de destination au clic. Absent = segment non navigable. */
  href?: string;
  /** Écrans frères proposés dans un menu déroulant (segment de hub). */
  siblings?: Array<{ label: string; path: string; icon?: React.ReactNode }>;
}

/**
 * Élague les maillons redondants d'un chemin :
 *
 *  - deux maillons CONSÉCUTIFS de même libellé (un hub à un seul écran porte le
 *    nom de son écran) → un seul, en gardant celui qui porte le menu des écrans
 *    frères, sinon celui qui porte la destination ;
 *  - le DERNIER maillon quand il répète le titre h1 affiché juste en dessous —
 *    le fil d'Ariane ne dit que le chemin, jamais la page courante.
 */
export function pruneRedundantSegments(
  segments: BreadcrumbSegment[],
  currentLabel?: string,
): BreadcrumbSegment[] {
  const result = [...segments];

  for (let index = result.length - 1; index > 0; index -= 1) {
    if (result[index].label.trim() !== result[index - 1].label.trim()) continue;
    const keepPrevious = !!result[index - 1].siblings || !result[index].siblings;
    result.splice(keepPrevious ? index : index - 1, 1);
  }

  const last = result[result.length - 1];
  if (last && !last.siblings && currentLabel && last.label.trim() === currentLabel.trim()) {
    result.pop();
  }

  return result;
}

interface PageBreadcrumbProps {
  /** Titre de la page courante, utilisé comme segment sur les pages de détail. */
  currentLabel?: string;
  className?: string;
}

export default function PageBreadcrumb({ currentLabel, className }: PageBreadcrumbProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAdmin, isManager } = useAuth();
  const { trail } = useScreenChrome();

  const segments = useMemo<BreadcrumbSegment[]>(() => {
    const access: HubAccess = {
      permissions: user?.permissions ?? [],
      isAdmin: isAdmin(),
      isManager: isManager(),
    };

    const result: BreadcrumbSegment[] = [];
    let isDetail = false;

    const hub = findHubForPath(pathname);
    if (hub) {
      const tabs = accessibleHubTabs(hub, access);
      const activeTab = tabs.find((tab) => tabMatchesPath(tab, pathname));
      result.push({
        label: t(hub.translationKey, hub.fallbackLabel),
        icon: HUB_ICON[hub.id],
        siblings: tabs.map((tab) => ({
          label: t(tab.translationKey, tab.fallbackLabel),
          path: tab.path,
          icon: SCREEN_ICON[tab.path],
        })),
      });
      if (activeTab) {
        result.push({
          label: t(activeTab.translationKey, activeTab.fallbackLabel),
          icon: SCREEN_ICON[activeTab.path],
          href: activeTab.path,
        });
        isDetail = !tabRoutePrefixes(activeTab).includes(pathname);
      }
    } else {
      const screen = STANDALONE_SCREENS.find(
        (entry) => pathname === entry.path || pathname.startsWith(`${entry.path}/`),
      );
      if (screen) {
        result.push({
          label: t(screen.translationKey, screen.fallbackLabel),
          icon: SCREEN_ICON[screen.path],
          href: screen.path,
        });
        isDetail = pathname !== screen.path;
      }
    }

    // Page de détail (/properties/123…) : le titre de la page tient lieu de
    // dernier segment de route.
    if (isDetail && currentLabel) result.push({ label: currentLabel });

    // Chemin INTERNE à l'écran : onglets actifs publiés par PageTabs.
    trail.forEach((label) => result.push({ label }));

    return pruneRedundantSegments(result, currentLabel);
  }, [pathname, currentLabel, trail, user?.permissions, isAdmin, isManager, t]);

  // Un seul segment sans destination ni frères = redite du titre, on n'affiche rien.
  if (segments.length === 0) return null;
  if (segments.length === 1 && !segments[0].siblings) return null;

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList className="flex-nowrap overflow-hidden text-xs">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <React.Fragment key={`${segment.label}-${index}`}>
              <BreadcrumbItem className="min-w-0">
                {segment.siblings && segment.siblings.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
                      {segment.icon && (
                        <span className="shrink-0 text-muted-foreground">
                          {sizedIcon(segment.icon, 13)}
                        </span>
                      )}
                      <span className="truncate">{segment.label}</span>
                      <ChevronDownIcon className="size-3 shrink-0 opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-44">
                      {segment.siblings.map((sibling) => (
                        <DropdownMenuItem
                          key={sibling.path}
                          onSelect={() => {
                            if (!pathname.startsWith(sibling.path)) navigate(sibling.path);
                          }}
                        >
                          {sizedIcon(sibling.icon, 14)}
                          {sibling.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : isLast || !segment.href ? (
                  <BreadcrumbPage className="inline-flex min-w-0 items-center gap-1 truncate">
                    {segment.icon && (
                      <span className="shrink-0 text-muted-foreground">
                        {sizedIcon(segment.icon, 13)}
                      </span>
                    )}
                    <span className="truncate">{segment.label}</span>
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={segment.href}
                    className="inline-flex min-w-0 items-center gap-1 truncate"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(segment.href as string);
                    }}
                  >
                    {segment.icon && (
                      <span className="shrink-0 text-muted-foreground">
                        {sizedIcon(segment.icon, 13)}
                      </span>
                    )}
                    <span className="truncate">{segment.label}</span>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
