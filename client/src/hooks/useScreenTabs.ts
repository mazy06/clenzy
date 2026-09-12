import React, { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useTranslation } from './useTranslation';
import { screenTabsFor, type ScreenTabAccess } from '../config/screenTabs';

/**
 * Lecture du registre {@code config/screenTabs.tsx} pour l'utilisateur courant.
 *
 * <p>Deux lecteurs, un seul chemin : la PAGE y prend les onglets qu'elle rend,
 * et la BARRE latérale y prend ceux qu'elle déplie dans son troisième tiroir
 * pour un écran qui n'est pas ouvert. Les deux voient donc exactement la même
 * liste, dans le même ordre, filtrée par les mêmes droits.</p>
 */

export interface ResolvedScreenTab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /**
   * Masqué par les droits de l'utilisateur.
   *
   * <p>La liste renvoyée est COMPLÈTE, masqués compris : {@code useTabKeyParam}
   * attend la liste entière et filtre lui-même pour résoudre l'index visible.
   * Ne pas la pré-filtrer, sous peine de décaler tous les onglets d'un cran pour
   * les rôles auxquels il en manque un.</p>
   */
  hidden: boolean;
}

/** Instantané des droits, tel que les prédicats du registre l'attendent. */
export function useScreenTabAccess(): ScreenTabAccess {
  const { user } = useAuth();
  const permissions = user?.permissions;
  const roles = user?.roles;
  const platformRole = user?.platformRole;

  return useMemo(
    () => ({ permissions: permissions ?? [], roles: roles ?? [], platformRole }),
    [permissions, roles, platformRole],
  );
}

/** Onglets de l'écran `path`, libellés dans la langue courante. */
export function useScreenTabs(path: string): ResolvedScreenTab[] {
  const { t } = useTranslation();
  const access = useScreenTabAccess();

  return useMemo(
    () =>
      screenTabsFor(path).map((tab) => ({
        key: tab.key,
        label: t(tab.translationKey, tab.fallbackLabel),
        icon: tab.icon,
        hidden: tab.isAccessible ? !tab.isAccessible(access) : false,
      })),
    [path, access, t],
  );
}

/** Les seuls onglets réellement affichables — le premier est l'onglet d'entrée. */
export function useVisibleScreenTabs(path: string): ResolvedScreenTab[] {
  const tabs = useScreenTabs(path);
  return useMemo(() => tabs.filter((tab) => !tab.hidden), [tabs]);
}
