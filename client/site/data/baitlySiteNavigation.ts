import type { NavMegaItem } from '../components/NavMegaPanel';
import type { SiteLanguage } from '../lib/siteLanguage';
import { LAYOUT_MESSAGES } from '../lib/messages/layout';
import { moduleText } from '../lib/messages/modules';
import { resourceText, solutionText } from '../lib/messages/solutions';
import { MODULES, RESOURCES, SOLUTIONS } from './catalog';
import { MODULE_PHOTO, SOLUTION_PHOTO } from './navVisuals';

export type BaitlySiteNavEntry = {
  key: string;
  label: string;
} & (
  | {
      kind: 'group';
      items: readonly NavMegaItem[];
      footer: { to: string; label: string };
    }
  | { kind: 'link'; to: string }
);

/** One hierarchy, order and set of destinations for every screen size. */
export function buildBaitlySiteNavigation(
  language: SiteLanguage,
): BaitlySiteNavEntry[] {
  const m = LAYOUT_MESSAGES[language].nav;
  const mega = LAYOUT_MESSAGES[language].mega;
  /* Les trois volets partagent la meme piece : seule la matiere change. Les
     points viennent des VRAIES fonctionnalites deja ecrites pour les pages —
     rien n'est redige pour le menu, rien n'est donc a retraduire. */
  const modules: NavMegaItem[] = MODULES.map((module) => {
    const text = moduleText(module.slug, language);
    return {
      key: module.slug,
      to: `/produit/${module.slug}`,
      icon: module.icon,
      title: text.name,
      copy: text.menuCopy,
      points: text.features.map((feature) => feature.title),
      photo: MODULE_PHOTO[module.slug],
    };
  });

  const solutions: NavMegaItem[] = SOLUTIONS.map((solution) => {
    const text = solutionText(solution.slug, language);
    return {
      key: solution.slug,
      to: `/solutions#${solution.slug}`,
      icon: solution.icon,
      title: text.name,
      copy: text.copy,
      points: text.points,
      photo: SOLUTION_PHOTO[solution.slug],
    };
  });

  /* Les ressources sont des documents et des outils, pas des lieux : elles
     n'ont pas de photo, et portent leur etiquette a la place. */
  const resources: NavMegaItem[] = RESOURCES.map((resource) => {
    const text = resourceText(resource.id, language);
    return {
      key: resource.id,
      to: `/ressources/${resource.id}?lang=${language}`,
      icon: resource.icon,
      title: text.name,
      copy: text.copy,
      tag: text.tag,
    };
  });

  return [
    {
      key: 'product',
      label: m.product,
      kind: 'group',
      items: modules,
      footer: { to: '/comparer', label: mega.productAll },
    },
    {
      key: 'solutions',
      label: m.solutions,
      kind: 'group',
      items: solutions,
      footer: { to: '/solutions', label: mega.solutionsAll },
    },
    { key: 'pricing', label: m.pricing, kind: 'link', to: '/tarifs' },
    { key: 'migration', label: m.migration, kind: 'link', to: '/migration' },
    { key: 'providers', label: m.providers, kind: 'link', to: '/prestataires' },
    {
      key: 'resources',
      label: m.resources,
      kind: 'group',
      items: resources,
      footer: { to: '/ressources', label: mega.resourcesAll },
    },
  ];
}

/** Query parameters preserve language; only the destination and anchor mark a page active. */
export function isBaitlyNavCurrent(to: string, pathname: string, hash: string) {
  const [path, anchor] = to.split('#');
  return (
    path.split('?')[0] === pathname && (anchor ? hash === '#' + anchor : !hash)
  );
}
