import { useCallback, useEffect, useMemo, useState } from 'react';
import { sitesApi, type Site, type SitePage, type SitePageType } from '../../../services/api/sitesApi';

/** Page d'un template importé (blocs déjà sérialisés en JSON, normalisés par l'appelant). */
export interface ImportPageInput {
  path: string;
  type: SitePageType;
  title?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  blocks: string;
}

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
  movePage: (id: number, dir: -1 | 1) => Promise<void>;
  updatePageMeta: (id: number, changes: Partial<SitePage>) => Promise<void>;
  savePageBlocks: (id: number, blocks: string) => Promise<void>;
  /** Draft/Live (2.7) : fige le brouillon courant dans la version publiée (servie au public). */
  publishPage: (id: number) => Promise<void>;
  /**
   * Import d'un template multi-page : met à jour la page existante de même `path` (l'accueil inclus)
   * ou crée les nouvelles ; les pages existantes hors-template sont conservées (non destructif).
   * Sélectionne l'accueil et renvoie son id + ses blocs (pour ré-hydrater le canvas + miroir pageLayout).
   */
  importPages: (templatePages: ImportPageInput[]) => Promise<{ homeId: number | null; homeBlocks: string } | null>;
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

  const updatePageMeta = useCallback(async (id: number, changes: Partial<SitePage>) => {
    if (!site) return;
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const updated = await sitesApi.updatePage(site.id, id, { ...page, ...changes });
    setPages((prev) => sortPages(prev.map((p) => (p.id === id ? updated : p))));
  }, [site, pages]);

  // Réordonne par échange adjacent puis renumérote séquentiellement (0..n). La page d'accueil reste
  // épinglée en tête (on refuse de déplacer/dépasser HOME).
  const movePage = useCallback(async (id: number, dir: -1 | 1) => {
    if (!site) return;
    const ordered = sortPages(pages);
    const i = ordered.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    if (ordered[i].type === 'HOME' || ordered[j].type === 'HOME') return;
    const next = [...ordered];
    [next[i], next[j]] = [next[j], next[i]];
    const updated = await Promise.all(
      next.map((p, idx) => (p.sortOrder !== idx ? sitesApi.updatePage(site.id, p.id, { ...p, sortOrder: idx }) : Promise.resolve(p))),
    );
    setPages(sortPages(updated));
  }, [site, pages]);

  const savePageBlocks = useCallback(async (id: number, blocks: string) => {
    if (!site) return;
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const updated = await sitesApi.updatePage(site.id, id, { ...page, blocks });
    setPages((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, [site, pages]);

  const publishPage = useCallback(async (id: number) => {
    if (!site) return;
    const updated = await sitesApi.publishPage(site.id, id);
    setPages((prev) => sortPages(prev.map((p) => (p.id === id ? updated : p))));
  }, [site]);

  const importPages = useCallback(async (templatePages: ImportPageInput[]) => {
    if (!site || templatePages.length === 0) return null;
    const byPath = new Map(pages.map((p) => [p.path, p]));
    const saved: SitePage[] = [];
    let order = 0;
    let homeId: number | null = null;
    let homeBlocks = '';
    for (const tpl of templatePages) {
      const existing = byPath.get(tpl.path);
      const body = {
        path: tpl.path,
        type: tpl.type,
        title: tpl.title ?? null,
        blocks: tpl.blocks,
        seoTitle: tpl.seoTitle ?? null,
        seoDescription: tpl.seoDescription ?? null,
        status: 'DRAFT',
        sortOrder: order++,
      };
      const page = existing
        ? await sitesApi.updatePage(site.id, existing.id, { ...existing, ...body })
        : await sitesApi.createPage(site.id, body);
      saved.push(page);
      if (page.type === 'HOME') {
        homeId = page.id;
        homeBlocks = page.blocks ?? tpl.blocks;
      }
    }
    // Non destructif : on garde les pages existantes dont le path n'est pas dans le template.
    const importedPaths = new Set(saved.map((p) => p.path));
    const kept = pages.filter((p) => !importedPaths.has(p.path));
    const merged = sortPages([...saved, ...kept]);
    setPages(merged);
    const home = merged.find((p) => p.type === 'HOME') ?? merged[0] ?? null;
    setSelectedPageId(home?.id ?? null);
    return { homeId: homeId ?? home?.id ?? null, homeBlocks: homeBlocks || (home?.blocks ?? '') };
  }, [site, pages]);

  return {
    ready, loading, error, site, pages, selectedPageId, selectedPage,
    selectPage, addPage, renamePage, deletePage, movePage, updatePageMeta, savePageBlocks, publishPage, importPages,
  };
}
