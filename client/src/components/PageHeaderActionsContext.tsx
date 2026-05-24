import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Slot DOM partage pour porter les actions tab-specific dans le PageHeader
 * d'une page multi-tabs (Settings, Documents, Properties, Reports, etc.).
 *
 * <h2>Probleme resolu</h2>
 * Chaque tab d'une page multi-tabs a ses propres boutons d'action avec un
 * etat local (loading, disabled conditions, etc.). Plutot que de remonter
 * ce state vers le parent via forwardRef + getters (verbeux, fragile),
 * chaque tab portale ses boutons dans le slot expose par le contexte.
 *
 * <h2>Usage cote provider (parent / page racine)</h2>
 * <pre>
 *   const { slot, portalContainer } = usePageHeaderActionsSlot();
 *   <PageHeaderActionsProvider slot={slot}>
 *     <PageHeader actions={portalContainer} />
 *     <TabContent />
 *   </PageHeaderActionsProvider>
 * </pre>
 *
 * <h2>Usage cote tab (consumer)</h2>
 * <pre>
 *   const headerActions = usePageHeaderActions(
 *     <>
 *       <Button>Refresh</Button>
 *       <Button>Create</Button>
 *     </>
 *   );
 *   return <>{headerActions}{content}</>;
 * </pre>
 *
 * <h2>Lifecycle</h2>
 * Au premier render le slot est null (la div n'est pas encore montee), le
 * portal ne fait rien. Une fois la div montee, le ref callback fire,
 * setSlotEl re-render le provider avec la valeur, les consumers reactualisent
 * leur portal. Pas de flash visible (un seul tick React).
 */

interface PageHeaderActionsApi {
  slot: HTMLElement | null;
}

const PageHeaderActionsContext = createContext<PageHeaderActionsApi>({ slot: null });

interface PageHeaderActionsProviderProps {
  children: ReactNode;
  slot: HTMLElement | null;
}

export function PageHeaderActionsProvider({ children, slot }: PageHeaderActionsProviderProps) {
  const value = useMemo(() => ({ slot }), [slot]);
  return (
    <PageHeaderActionsContext.Provider value={value}>{children}</PageHeaderActionsContext.Provider>
  );
}

/**
 * Hook cote consumer (composant de tab) : portale les `actions` dans le slot
 * actions du PageHeader. Retourne un ReactNode a inclure dans le JSX pour
 * activer le portal. Si le slot est null (premier render), retourne null.
 */
export function usePageHeaderActions(actions: ReactNode): ReactNode {
  const { slot } = useContext(PageHeaderActionsContext);
  if (!slot) return null;
  return createPortal(actions, slot);
}

/**
 * Hook cote provider (page racine) : cree le slot DOM + retourne l'API.
 * `portalContainer` est destine a etre passe dans la prop `actions` de PageHeader.
 *
 * <p><b>/!\ Rules of Hooks</b> : doit etre appele AVANT tout early return de
 * la page parent pour preserver l'ordre des hooks entre renders.</p>
 */
export function usePageHeaderActionsSlot(): {
  slot: HTMLElement | null;
  portalContainer: ReactNode;
} {
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  const portalContainer = (
    <div
      ref={setSlotEl}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    />
  );
  return { slot: slotEl, portalContainer };
}

// ─── Tab meta resolution helper ─────────────────────────────────────────────

export interface TabHeaderMeta {
  /** Sous-titre affiche dans le PageHeader pour ce tab. */
  subtitle: string;
}

interface TabHeaderResolution {
  title: string;
  subtitle: string;
}

/**
 * Calcule {title, subtitle} pour le PageHeader d'une page multi-tabs.
 *
 * @param rootTitle    titre racine (ex: "Paramètres", "Documents & Communications")
 * @param defaultSubtitle subtitle de fallback quand le tab actif n'a pas de meta
 * @param tabLabels    labels des tabs VISIBLES (dans l'ordre, apres filtre role)
 * @param activeIndex  visible-index du tab actif (= valeur de PageTabs)
 * @param tabMeta      mapping label → { subtitle }
 *
 * @returns { title: "Root" ou "Root › Tab", subtitle: tab-specific ou default }
 */
export function resolveTabHeader(
  rootTitle: string,
  defaultSubtitle: string,
  tabLabels: ReadonlyArray<string>,
  activeIndex: number,
  tabMeta: Record<string, TabHeaderMeta>,
): TabHeaderResolution {
  const activeLabel = tabLabels[activeIndex];
  const meta = activeLabel ? tabMeta[activeLabel] : undefined;
  // Tab 0 = racine → on n'ajoute pas de "> Label" pour eviter "Root > Root".
  const title = activeLabel && activeIndex > 0 ? `${rootTitle} › ${activeLabel}` : rootTitle;
  const subtitle = meta?.subtitle ?? defaultSubtitle;
  return { title, subtitle };
}
