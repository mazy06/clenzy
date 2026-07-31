import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Chrome d'écran Baitly — état partagé entre le `PageHeader` (qui l'affiche) et
 * les écrans (qui l'alimentent).
 *
 * Il porte deux choses :
 *
 *  1. **La recherche unique.** L'application n'a plus qu'UN champ de recherche,
 *     rendu en permanence dans le `PageHeader`. Un écran qui sait filtrer ses
 *     données s'y branche via `useScreenSearch(value, onChange, placeholder)` —
 *     il ne dessine plus de champ à lui. Quand aucun écran n'est branché, le
 *     champ reste affiché et sert à naviguer entre les écrans.
 *
 *  2. **Le fil d'Ariane interne.** `PageTabs` publie le libellé de l'onglet
 *     actif via `useScreenTrailSegment` : le fil d'Ariane peut alors afficher
 *     « Hub › Écran › Onglet », c'est-à-dire l'endroit exact où l'on est DANS
 *     l'écran.
 *
 * Le provider est monté une seule fois, dans `MainLayoutFull`.
 */

interface SearchRegistration {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Ce que le header a besoin de connaître de la recherche d'écran active. */
export interface ScreenSearchSnapshot {
  id: string;
  value: string;
  placeholder?: string;
}

interface ScreenChromeValue {
  /** Recherche d'écran active, ou `null` si aucun écran n'est branché. */
  search: ScreenSearchSnapshot | null;
  /** Répercute la saisie du header vers l'écran branché. */
  setSearchValue: (value: string) => void;
  mountSearch: (id: string, registration: SearchRegistration) => void;
  unmountSearch: (id: string) => void;
  /**
   * Emplacement où le `PageHeader` accueille les onglets, sur les largeurs qui
   * ne peuvent pas s'offrir une bande dédiée. `null` tant qu'il n'est pas monté,
   * ou au-dessus du seuil : `PageTabs` se rend alors à sa place habituelle.
   */
  tabsSlot: HTMLElement | null;
  setTabsSlot: (element: HTMLElement | null) => void;
  /** Segments internes à l'écran (onglets actifs), du plus externe au plus interne. */
  trail: string[];
  mountTrail: (id: string, label: string) => void;
  unmountTrail: (id: string) => void;
}

const noop = () => {};

const FALLBACK: ScreenChromeValue = {
  search: null,
  setSearchValue: noop,
  mountSearch: noop,
  unmountSearch: noop,
  tabsSlot: null,
  setTabsSlot: noop,
  trail: [],
  mountTrail: noop,
  unmountTrail: noop,
};

const ScreenChromeContext = createContext<ScreenChromeValue>(FALLBACK);

export function useScreenChrome(): ScreenChromeValue {
  return useContext(ScreenChromeContext);
}

export function ScreenChromeProvider({ children }: { children: React.ReactNode }) {
  // Les enregistrements vivent dans une ref : `onChange` est souvent une lambda
  // recréée à chaque rendu de l'écran ; la stocker en state relancerait un rendu
  // du provider à chaque rendu de l'écran (boucle). Seul l'INSTANTANÉ affiché
  // (id/valeur/placeholder) passe par un state, et uniquement s'il change.
  const searchesRef = useRef(new Map<string, SearchRegistration>());
  const searchOrderRef = useRef<string[]>([]);
  const [search, setSearch] = useState<ScreenSearchSnapshot | null>(null);
  const [tabsSlot, setTabsSlot] = useState<HTMLElement | null>(null);

  const syncSearch = useCallback(() => {
    const id = searchOrderRef.current[searchOrderRef.current.length - 1];
    const registration = id ? searchesRef.current.get(id) : undefined;
    const next: ScreenSearchSnapshot | null = registration
      ? { id, value: registration.value, placeholder: registration.placeholder }
      : null;
    setSearch((prev) => {
      if (prev === next) return prev;
      if (
        prev &&
        next &&
        prev.id === next.id &&
        prev.value === next.value &&
        prev.placeholder === next.placeholder
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const mountSearch = useCallback(
    (id: string, registration: SearchRegistration) => {
      searchesRef.current.set(id, registration);
      if (!searchOrderRef.current.includes(id)) searchOrderRef.current.push(id);
      syncSearch();
    },
    [syncSearch],
  );

  const unmountSearch = useCallback(
    (id: string) => {
      searchesRef.current.delete(id);
      searchOrderRef.current = searchOrderRef.current.filter((entry) => entry !== id);
      syncSearch();
    },
    [syncSearch],
  );

  const setSearchValue = useCallback((value: string) => {
    const id = searchOrderRef.current[searchOrderRef.current.length - 1];
    const registration = id ? searchesRef.current.get(id) : undefined;
    registration?.onChange(value);
  }, []);

  // Fil d'Ariane interne. Les effets des composants ENFANTS s'exécutent avant
  // ceux de leurs parents : l'ordre de montage est donc du plus interne au plus
  // externe, on le renverse pour lire le chemin de gauche à droite.
  const [trailEntries, setTrailEntries] = useState<Array<{ id: string; label: string }>>([]);

  const mountTrail = useCallback((id: string, label: string) => {
    setTrailEntries((prev) => {
      const existing = prev.find((entry) => entry.id === id);
      if (existing?.label === label) return prev;
      if (existing) return prev.map((entry) => (entry.id === id ? { id, label } : entry));
      return [...prev, { id, label }];
    });
  }, []);

  const unmountTrail = useCallback((id: string) => {
    setTrailEntries((prev) => (prev.some((entry) => entry.id === id)
      ? prev.filter((entry) => entry.id !== id)
      : prev));
  }, []);

  const trail = useMemo(
    () => [...trailEntries].reverse().map((entry) => entry.label),
    [trailEntries],
  );

  const value = useMemo<ScreenChromeValue>(
    () => ({
      search, setSearchValue, mountSearch, unmountSearch,
      tabsSlot, setTabsSlot,
      trail, mountTrail, unmountTrail,
    }),
    [search, setSearchValue, mountSearch, unmountSearch, tabsSlot, trail, mountTrail, unmountTrail],
  );

  return <ScreenChromeContext.Provider value={value}>{children}</ScreenChromeContext.Provider>;
}

/**
 * Branche la recherche d'un écran sur le champ unique du header.
 *
 * L'écran garde son état (`value` / `onChange`) : seul le rendu du champ est
 * délégué au header. À utiliser à la place de tout champ de recherche local.
 */
export function useScreenSearch(
  value: string,
  onChange: (value: string) => void,
  placeholder?: string,
): void {
  const { mountSearch, unmountSearch } = useScreenChrome();
  const id = useId();

  // `onChange` est lu au moment de la saisie, jamais comparé : une lambda
  // recréée à chaque rendu ne doit pas relancer d'effet.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    mountSearch(id, { value, placeholder, onChange: (next) => onChangeRef.current(next) });
  }, [id, value, placeholder, mountSearch]);

  useEffect(() => () => unmountSearch(id), [id, unmountSearch]);
}

/**
 * Publie un segment de chemin interne à l'écran (onglet actif) pour le fil
 * d'Ariane. `label` vide ou absent = pas de segment.
 */
export function useScreenTrailSegment(label?: string): void {
  const { mountTrail, unmountTrail } = useScreenChrome();
  const id = useId();

  useEffect(() => {
    if (label) mountTrail(id, label);
    else unmountTrail(id);
  }, [id, label, mountTrail, unmountTrail]);

  useEffect(() => () => unmountTrail(id), [id, unmountTrail]);
}
