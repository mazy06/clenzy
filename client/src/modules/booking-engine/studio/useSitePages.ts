import { useCallback, useEffect, useMemo, useState } from 'react';
import { sitesApi, type Site, type SitePage } from '../../../services/api/sitesApi';

/**
 * État multi-page du Studio (2.2). Au montage : find-or-create du site rattaché à la config de
 * widget (`ensureForConfig`) puis chargement des pages. La page d'accueil (HOME) est garantie par
 * le backend (migration du `pageLayout` mono-page). Le builder édite la page sélectionnée ; les
 * blocs sont persistés par page (`savePageBlocks`). En cas d'indisponibilité de l'API sites, le
 * builder retombe en mode mono-page (cf. DesignBuilder) — ce hook expose alors `ready=false`.
 */

export interface SitePagesState {
  ready: boolean;
  loading: boolean;
  error: string | null;
  site: Site | null;
  pages: SitePage[];
  selectedPageId: number | null;
  selectedPage: SitePage | null;
  selectPage: (id: number) => void;
  addPage: () => Promise<void>;
  renamePage: (id: number, title: string) => Promise<void>;
  deletePage: (id: number) => Promise<void>;
  savePageBlocks: (id: number, blocks: string) => Promise<void>;
}

function sortPages(list: SitePage[]): SitePage[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function useSitePages(configId: number | undefined): SitePagesState {
  const [site, setSite] = useState<Site | null>(null);
  const [pages, setPages] = useState<SitePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    sitesApi.ensureForConfig(configId)
      .then((s) => {
        if (!alive) return null;
        setSite(s);
        return sitesApi.listPages(s.id);
      })
      .then((list) => {
        if (!alive || !list) return;
        const sorted = sortPages(list);
        setPages(sorted);
        const home = sorted.find((p) => p.type === 'HOME') ?? sorted[0] ?? null;
        setSelectedPageId(home?.id ?? null);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Pages indisponibles'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [configId]);

  const ready = site != null && !loading && error == null;
  const selectedPage = useMemo(
    () => pages.find((p) => p.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  );

  const selectPage = useCallback((id: number) => setSelectedPageId(id), []);

  const addPage = useCallback(async () => {
    if (!site) return;
    const n = pages.length; // la page d'accueil occupe l'index 0
    const created = await sitesApi.createPage(site.id, {
      path: `/page-${n}`,
      type: 'CUSTOM',
      title: `Page ${n}`,
      blocks: '[]',
      status: 'DRAFT',
      sortOrder: n,
    });
    setPages((prev) => sortPages([...prev, created]));
    setSelectedPageId(created.id);
  }, [site, pages.length]);

  const renamePage = useCallback(async (id: number, title: string) => {
    if (!site) return;
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const updated = await sitesApi.updatePage(site.id, id, { ...page, title });
    setPages((prev) => sortPages(prev.map((p) => (p.id === id ? updated : p))));
  }, [site, pages]);

  const deletePage = useCallback(async (id: number) => {
    if (!site) return;
    await sitesApi.deletePage(site.id, id);
    const home = pages.find((p) => p.type === 'HOME');
    setPages((prev) => prev.filter((p) => p.id !== id));
    setSelectedPageId((cur) => (cur === id ? home?.id ?? null : cur));
  }, [site, pages]);

  const savePageBlocks = useCallback(async (id: number, blocks: string) => {
    if (!site) return;
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const updated = await sitesApi.updatePage(site.id, id, { ...page, blocks });
    setPages((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, [site, pages]);

  return {
    ready, loading, error, site, pages, selectedPageId, selectedPage,
    selectPage, addPage, renamePage, deletePage, savePageBlocks,
  };
}
