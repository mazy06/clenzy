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
 * État multi-page + MULTI-LANGUE du Studio. Au montage : find-or-create du site rattaché à la config
 * (`ensureForConfig`) puis chargement de TOUTES les pages (toutes locales). L'éditeur édite les pages de
 * la LANGUE D'ÉDITION courante (`editLocale`).
 *
 * Convention locale (alignée sur la delivery publique `SiteDeliveryService.getPage`) : les pages de la
 * langue PAR DÉFAUT du site portent `locale = null` (rétro-compatible) ; les variantes traduites portent
 * `locale = '<code>'`. `pages` n'expose que la langue d'édition active ; le CRUD estampille la bonne
 * locale. `addLanguage(code)` déclare la langue (`Site.locales`) puis bootstrappe ses pages (copie des
 * pages par défaut, à traduire ensuite — manuellement ou via l'IA).
 *
 * Si l'API sites est indisponible, `ready=false` (l'éditeur retombe sur un état mono-page neutre).
 */

export interface SitePagesState {
  ready: boolean;
  loading: boolean;
  error: string | null;
  site: Site | null;
  pages: SitePage[];
  selectedPageId: number | null;
  selectedPage: SitePage | null;
  /** Langue PAR DÉFAUT du site (les pages de cette langue ont `locale = null`). */
  defaultLocale: string;
  /** Langue d'édition active (= `editLocale` ou la langue par défaut). */
  activeLocale: string;
  /** Langues du site (défaut + variantes déclarées dans `Site.locales`), dédupliquées. */
  availableLocales: string[];
  /** Déclare une langue (`Site.locales`) et bootstrappe ses pages depuis la langue par défaut. */
  addLanguage: (code: string) => Promise<void>;
  /** Page de la langue PAR DÉFAUT (locale null) de même `path` — source pour la traduction IA. */
  defaultPageByPath: (path: string) => SitePage | null;
  selectPage: (id: number) => void;
  addPage: () => Promise<void>;
  renamePage: (id: number, title: string) => Promise<void>;
  deletePage: (id: number) => Promise<void>;
  /** Repart de zéro : supprime toutes les pages de la langue active SAUF l'accueil, et vide l'accueil. */
  resetSite: () => Promise<void>;
  movePage: (id: number, dir: -1 | 1) => Promise<void>;
  updatePageMeta: (id: number, changes: Partial<SitePage>) => Promise<void>;
  savePageBlocks: (id: number, blocks: string) => Promise<void>;
  /** Draft/Live : fige le brouillon courant dans la version publiée (servie au public). */
  publishPage: (id: number) => Promise<void>;
  /** Recharge le site + toutes ses pages depuis le serveur (ex. après une auto-traduction IA). */
  reload: () => Promise<void>;
  /**
   * Import d'un template multi-page (dans la langue PAR DÉFAUT) : met à jour la page existante de même
   * `path` (l'accueil inclus) ou crée les nouvelles ; pages existantes hors-template conservées.
   * Sélectionne l'accueil et renvoie son id + ses blocs (pour ré-hydrater le canvas).
   */
  importPages: (templatePages: ImportPageInput[]) => Promise<{ homeId: number | null; homeBlocks: string } | null>;
}

function sortPages(list: SitePage[]): SitePage[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** Parse `Site.locales` (CSV) en liste de codes propres. */
function parseLocales(csv: string | null | undefined): string[] {
  return (csv || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function useSitePages(configId: number | undefined, editLocale?: string): SitePagesState {
  const [site, setSite] = useState<Site | null>(null);
  const [allPages, setAllPages] = useState<SitePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLocale = (site?.defaultLocale || 'fr').toLowerCase();
  // Langue d'édition : `editLocale` s'il est fourni et ≠ défaut, sinon la langue par défaut.
  const activeLocale = editLocale && editLocale.toLowerCase() !== defaultLocale ? editLocale.toLowerCase() : defaultLocale;
  // Clé de persistance : `null` pour la langue par défaut, le code sinon.
  const localeKey = activeLocale === defaultLocale ? null : activeLocale;

  const availableLocales = useMemo(() => {
    const set = new Set<string>([defaultLocale, ...parseLocales(site?.locales)]);
    return Array.from(set);
  }, [defaultLocale, site?.locales]);

  // Pages de la langue d'édition active (locale `null` = langue par défaut).
  const pages = useMemo(
    () => sortPages(allPages.filter((p) => (p.locale ?? defaultLocale) === activeLocale)),
    [allPages, activeLocale, defaultLocale],
  );

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
        setAllPages(sortPages(list));
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Pages indisponibles'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [configId]);

  // Recharge le site (langues à jour) + toutes ses pages. Utilisé après une auto-traduction IA, qui crée
  // des variantes côté serveur sans passer par le state local du hook. `ensureForConfig` est idempotent
  // (find-or-create) et renvoie le site à jour (dont `locales`).
  const reload = useCallback(async () => {
    if (!configId) return;
    const fresh = await sitesApi.ensureForConfig(configId);
    const list = await sitesApi.listPages(fresh.id);
    setSite(fresh);
    setAllPages(sortPages(list));
  }, [configId]);

  // (Re)sélectionne l'accueil de la langue d'édition quand elle change (ou au 1er chargement).
  useEffect(() => {
    if (!site) return;
    const home = pages.find((p) => p.type === 'HOME') ?? pages[0] ?? null;
    setSelectedPageId((cur) => (cur != null && pages.some((p) => p.id === cur) ? cur : home?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocale, allPages, site]);

  const ready = site != null && !loading && error == null;
  const selectedPage = useMemo(
    () => allPages.find((p) => p.id === selectedPageId) ?? null,
    [allPages, selectedPageId],
  );

  const upsertLocal = useCallback((page: SitePage) => {
    setAllPages((prev) => {
      const exists = prev.some((p) => p.id === page.id);
      return sortPages(exists ? prev.map((p) => (p.id === page.id ? page : p)) : [...prev, page]);
    });
  }, []);

  const selectPage = useCallback((id: number) => setSelectedPageId(id), []);

  const defaultPageByPath = useCallback(
    (path: string) => allPages.find((p) => p.locale == null && p.path === path) ?? null,
    [allPages],
  );

  const addPage = useCallback(async () => {
    if (!site) return;
    const n = pages.length; // l'accueil de la langue occupe l'index 0
    const created = await sitesApi.createPage(site.id, {
      path: `/page-${n}`,
      type: 'CUSTOM',
      title: `Page ${n}`,
      blocks: '[]',
      status: 'DRAFT',
      sortOrder: n,
      locale: localeKey,
    });
    upsertLocal(created);
    setSelectedPageId(created.id);
  }, [site, pages.length, localeKey, upsertLocal]);

  const renamePage = useCallback(async (id: number, title: string) => {
    if (!site) return;
    const page = allPages.find((p) => p.id === id);
    if (!page) return;
    const updated = await sitesApi.updatePage(site.id, id, { ...page, title });
    upsertLocal(updated);
  }, [site, allPages, upsertLocal]);

  const deletePage = useCallback(async (id: number) => {
    if (!site) return;
    await sitesApi.deletePage(site.id, id);
    const home = pages.find((p) => p.type === 'HOME');
    setAllPages((prev) => prev.filter((p) => p.id !== id));
    setSelectedPageId((cur) => (cur === id ? home?.id ?? null : cur));
  }, [site, pages]);

  const resetSite = useCallback(async () => {
    if (!site) return;
    // Scopé à la langue d'édition active (les autres langues sont conservées).
    const home = pages.find((p) => p.type === 'HOME') ?? pages[0] ?? null;
    for (const p of pages) {
      if (home && p.id === home.id) continue;
      await sitesApi.deletePage(site.id, p.id);
    }
    let blankHome: SitePage | null = home;
    if (home) {
      blankHome = await sitesApi.updatePage(site.id, home.id, { ...home, blocks: '' });
    }
    const removedIds = new Set(pages.filter((p) => !home || p.id !== home.id).map((p) => p.id));
    setAllPages((prev) => {
      const kept = prev.filter((p) => !removedIds.has(p.id));
      return blankHome ? kept.map((p) => (p.id === blankHome!.id ? blankHome! : p)) : kept;
    });
    setSelectedPageId(blankHome?.id ?? null);
  }, [site, pages]);

  const updatePageMeta = useCallback(async (id: number, changes: Partial<SitePage>) => {
    if (!site) return;
    const page = allPages.find((p) => p.id === id);
    if (!page) return;
    const updated = await sitesApi.updatePage(site.id, id, { ...page, ...changes });
    upsertLocal(updated);
  }, [site, allPages, upsertLocal]);

  // Réordonne par échange adjacent (au sein de la langue active) puis renumérote 0..n. L'accueil reste
  // épinglé en tête (on refuse de déplacer/dépasser HOME).
  const movePage = useCallback(async (id: number, dir: -1 | 1) => {
    if (!site) return;
    const ordered = pages;
    const i = ordered.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    if (ordered[i].type === 'HOME' || ordered[j].type === 'HOME') return;
    const next = [...ordered];
    [next[i], next[j]] = [next[j], next[i]];
    const updated = await Promise.all(
      next.map((p, idx) => (p.sortOrder !== idx ? sitesApi.updatePage(site.id, p.id, { ...p, sortOrder: idx }) : Promise.resolve(p))),
    );
    setAllPages((prev) => {
      const byId = new Map(updated.map((p) => [p.id, p]));
      return sortPages(prev.map((p) => byId.get(p.id) ?? p));
    });
  }, [site, pages]);

  const savePageBlocks = useCallback(async (id: number, blocks: string) => {
    if (!site) return;
    const page = allPages.find((p) => p.id === id);
    if (!page) return;
    const updated = await sitesApi.updatePage(site.id, id, { ...page, blocks });
    upsertLocal(updated);
  }, [site, allPages, upsertLocal]);

  const publishPage = useCallback(async (id: number) => {
    if (!site) return;
    const updated = await sitesApi.publishPage(site.id, id);
    upsertLocal(updated);
  }, [site, upsertLocal]);

  const addLanguage = useCallback(async (codeRaw: string) => {
    if (!site) return;
    const code = codeRaw.trim().toLowerCase();
    if (!code || code === defaultLocale || availableLocales.includes(code)) return;
    // 1. Déclare la langue sur le site (CSV des variantes, hors langue par défaut).
    const nextLocales = Array.from(new Set([...parseLocales(site.locales), code]));
    const updatedSite = await sitesApi.updateSite(site.id, { ...site, locales: nextLocales.join(',') });
    setSite(updatedSite);
    // 2. Bootstrappe : copie chaque page de la langue par défaut (locale null) en variante `code`.
    const defaults = sortPages(allPages.filter((p) => p.locale == null));
    const created: SitePage[] = [];
    for (const p of defaults) {
      const copy = await sitesApi.createPage(site.id, {
        path: p.path,
        type: p.type,
        title: p.title,
        blocks: p.blocks ?? '',
        seoTitle: p.seoTitle ?? null,
        seoDescription: p.seoDescription ?? null,
        status: 'DRAFT',
        sortOrder: p.sortOrder,
        locale: code,
      });
      created.push(copy);
    }
    setAllPages((prev) => sortPages([...prev, ...created]));
  }, [site, allPages, defaultLocale, availableLocales]);

  const importPages = useCallback(async (templatePages: ImportPageInput[]) => {
    if (!site || templatePages.length === 0) return null;
    // Import dans la langue PAR DÉFAUT (locale null) : on cible les pages par défaut existantes.
    const defaults = allPages.filter((p) => p.locale == null);
    const byPath = new Map(defaults.map((p) => [p.path, p]));
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
        locale: null,
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
    // Non destructif : conserve les pages dont le path n'est pas dans le template (toutes locales).
    const importedPaths = new Set(saved.map((p) => p.path));
    setAllPages((prev) => {
      const kept = prev.filter((p) => !(p.locale == null && importedPaths.has(p.path)));
      return sortPages([...kept, ...saved]);
    });
    const home = saved.find((p) => p.type === 'HOME') ?? saved[0] ?? null;
    setSelectedPageId(home?.id ?? null);
    return { homeId: homeId ?? home?.id ?? null, homeBlocks: homeBlocks || (home?.blocks ?? '') };
  }, [site, allPages]);

  return {
    ready, loading, error, site, pages, selectedPageId, selectedPage,
    defaultLocale, activeLocale, availableLocales, addLanguage, defaultPageByPath,
    selectPage, addPage, renamePage, deletePage, resetSite, movePage, updatePageMeta, savePageBlocks, publishPage, reload, importPages,
  };
}
