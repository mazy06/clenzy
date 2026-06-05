import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Navigation par onglet resoluble par <b>CLE stable</b> (`?tab=<key>`) au lieu d'un index numerique
 * fragile (`?tab=7`). Probleme resolu : l'index VISIBLE des onglets shifte selon le role de
 * l'utilisateur (onglets masques via `hidden`), donc une URL `?tab=7` pointe vers un onglet
 * different selon le role. La cle, elle, est stable.
 *
 * S'appuie sur les primitives existantes : chaque onglet (`PageTabItem`) porte une `key` ; le param
 * URL = cette key ; le hook resout key ↔ index visible. Cote en-tete, `resolveTabHeader`
 * (PageHeaderActionsContext) continue d'indexer par label visible — inchange.
 */

/** Sous-ensemble structurel d'un onglet suffisant pour la resolution par cle. */
export interface TabKeyed {
  key?: string;
  hidden?: boolean;
}

/**
 * Index VISIBLE (dans la liste filtree par role) de l'onglet portant `key`.
 *
 * @param tabs liste COMPLETE des onglets (avec leurs flags `hidden`) — filtree en interne.
 * @param key  cle recherchee (ex. valeur de `?tab=`).
 * @returns l'index visible, ou 0 si la cle est absente/introuvable (fallback robuste 1er onglet).
 */
export function tabIndexFromKey(tabs: ReadonlyArray<TabKeyed>, key: string | null | undefined): number {
  if (!key) return 0;
  const idx = tabs.filter((t) => !t.hidden).findIndex((t) => t.key === key);
  return idx >= 0 ? idx : 0;
}

/**
 * Cle stable de l'onglet a l'index VISIBLE `index` (liste filtree par role).
 *
 * @returns la cle, ou `undefined` si l'index est hors bornes / l'onglet n'a pas de cle.
 */
export function tabKeyFromIndex(tabs: ReadonlyArray<TabKeyed>, index: number): string | undefined {
  return tabs.filter((t) => !t.hidden)[index]?.key;
}

interface UseTabKeyParamOptions {
  /** Nom du parametre d'URL. Defaut `tab`. */
  param?: string;
  /** `replace` plutot que `push` dans l'historique au changement d'onglet. Defaut `true`. */
  replace?: boolean;
  /**
   * Cle de l'onglet actif quand l'URL n'a pas de param. Defaut : 1er onglet visible.
   * Utile quand le defaut depend du contexte (ex. roles operationnels = onglet Interventions).
   * C'est aussi l'onglet qui beneficie de l'URL propre (sans param).
   */
  defaultKey?: string;
}

/**
 * Synchronise l'onglet actif d'une page multi-tabs avec l'URL via une CLE stable (`?tab=<key>`).
 * Source de verite = l'URL (pas de `useState` separe). L'onglet par defaut (`defaultKey`, sinon le
 * 1er onglet visible) donne une URL propre (pas de param). Les autres parametres d'URL sont preserves.
 *
 * @param tabs liste COMPLETE des onglets (avec `key` + `hidden`).
 * @returns `[activeIndex, setActiveIndex]` ou `activeIndex` est l'index VISIBLE (a passer a
 *          `PageTabs.value` et `resolveTabHeader`), et `setActiveIndex` l'a brancher sur `onChange`.
 */
export function useTabKeyParam(
  tabs: ReadonlyArray<TabKeyed>,
  options?: UseTabKeyParamOptions,
): [number, (index: number) => void] {
  const param = options?.param ?? 'tab';
  const replace = options?.replace ?? true;
  const defaultKey = options?.defaultKey;
  const [searchParams, setSearchParams] = useSearchParams();

  // Onglet par defaut (URL sans param) : `defaultKey` s'il resout vers un onglet visible, sinon le 1er.
  const defaultIndex = defaultKey ? tabIndexFromKey(tabs, defaultKey) : 0;
  const raw = searchParams.get(param);
  const activeIndex = raw != null ? tabIndexFromKey(tabs, raw) : defaultIndex;

  const setActiveIndex = useCallback(
    (index: number) => {
      const key = tabKeyFromIndex(tabs, index);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          // Onglet par defaut → URL propre ; sinon on ecrit la cle stable.
          if (index === defaultIndex || !key) next.delete(param);
          else next.set(param, key);
          return next;
        },
        { replace },
      );
    },
    [tabs, setSearchParams, param, replace, defaultIndex],
  );

  return [activeIndex, setActiveIndex];
}

/**
 * Variante de {@link useTabKeyParam} pour les pages dont l'onglet actif EST deja une valeur string
 * stable (un filtre/enum), et non un index. La valeur sert directement de cle d'URL (`?tab=<value>`).
 * La `defaultValue` donne une URL propre (sans param) et sert de repli si le param est absent/invalide.
 *
 * @param values        valeurs autorisees (sert a valider le param d'URL ; l'ordre n'importe pas).
 * @param defaultValue  valeur par defaut (URL propre).
 * @returns `[active, setActive]` — `active` est garanti dans `values`.
 */
export function useTabValueParam<T extends string>(
  values: ReadonlyArray<T>,
  defaultValue: T,
  options?: { param?: string; replace?: boolean },
): [T, (value: T) => void] {
  const param = options?.param ?? 'tab';
  const replace = options?.replace ?? true;
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get(param) as T | null;
  const active = raw != null && values.includes(raw) ? raw : defaultValue;

  const setActive = useCallback(
    (value: T) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          // Valeur par defaut → URL propre ; sinon on ecrit la valeur (= cle).
          if (value === defaultValue) next.delete(param);
          else next.set(param, value);
          return next;
        },
        { replace },
      );
    },
    [setSearchParams, param, replace, defaultValue],
  );

  return [active, setActive];
}
