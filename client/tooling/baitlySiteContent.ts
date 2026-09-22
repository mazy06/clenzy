import { HOME_MESSAGES } from '../site/lib/messages/home';
import { PAGE_MESSAGES } from '../site/lib/messages/pages';
import { PRICING_MESSAGES } from '../site/lib/messages/pricing';
import { PROVIDERS_MESSAGES } from '../site/lib/messages/providers';
import { AGENTS_MESSAGES } from '../site/lib/messages/agents';
import { moduleText } from '../site/lib/messages/modules';
import { resourceText, solutionText } from '../site/lib/messages/solutions';
import { legalDocs } from '../src/modules/legal/corpus';
import type { SiteLanguage } from '../site/lib/siteLanguage';

export const DISCOVERY_LANGUAGES = ['fr', 'en', 'ar'] as const;
export const PRIVATE_SITE_PATHS = ['/prestataires/inscription', '/prestataires/activation'];
export interface DiscoveryCatalog { modules: string[]; solutions: string[]; resources: string[] }

const section = (title: string, ...text: string[]) => `## ${title}\n\n${text.join('\n\n')}`;
const list = (items: readonly string[]) => items.map((item) => `- ${item}`).join('\n');
const faq = (items: ReadonlyArray<{ q: string; a: string }>) =>
  items.map(({ q, a }) => section(q, a)).join('\n\n');
const features = (items: ReadonlyArray<{ title: string; copy: string }>) =>
  items.map(({ title, copy }) => section(title, copy)).join('\n\n');

/** Public editorial content only: no application state, mock reservations or API calls. */
export function siteDocuments(language: SiteLanguage, catalog: DiscoveryCatalog): Map<string, string> {
  const documents = new Map<string, string>();
  const add = (path: string, title: string, ...parts: string[]) => {
    documents.set(path, `# ${title}\n\n${parts.filter(Boolean).join('\n\n')}\n`);
  };
  const home = HOME_MESSAGES[language];
  const pages = PAGE_MESSAGES[language];
  const pricing = PRICING_MESSAGES[language];
  const providers = PROVIDERS_MESSAGES[language];
  const agents = AGENTS_MESSAGES[language];
  add('/', `Baitly · ${home.hero.title1} ${home.hero.title2}`,
    `${home.hero.lead1} ${home.hero.lead2}`, home.hero.description, home.hero.audience,
    section(`${home.platform.title1} ${home.platform.title2}`, home.platform.intro,
      home.platform.planningCopy, home.platform.directCopy),
    section(`${home.local.title1} ${home.local.title2}`, home.local.copy,
      ...home.local.points.map(([title, copy]) => section(title, copy))),
    faq(home.faq.items.map(([q, a]) => ({ q, a }))),
    `[${home.hero.demo}](/demo?lang=${language})`,
    list(catalog.modules.map((slug) => `[${moduleText(slug, language).name}](/produit/${slug}?lang=${language})`)));
  add('/solutions', pages.solutions.title, pages.solutions.intro,
    ...catalog.solutions.map((slug) => {
      const item = solutionText(slug, language);
      return section(item.name, item.copy, list(item.points));
    }));
  add('/ressources', pages.resources.title, pages.resources.intro,
    ...catalog.resources.map((id) => {
      const item = resourceText(id, language);
      return section(item.name, item.copy, item.tag);
    }));
  add('/tarifs', pricing.title, pricing.intro,
    ...pricing.plans.map((plan) => section(plan.name, `${plan.price} ${plan.unit}`, plan.copy, list(plan.features))),
    section(pricing.addonsTitle, pricing.addonsCopy, pricing.addonsPending,
      ...pricing.addons.map((item) => section(item.name, item.copy))), faq(pricing.faq));
  const migration = pages.migration;
  add('/migration', migration.title, migration.intro,
    section(migration.channelsTitle, ...migration.channels.map((item) => section(item.name, item.copy))),
    section(migration.stepsTitle, features(migration.steps)),
    section(migration.guaranteesTitle, list(migration.guarantees)),
    section(migration.limitsTitle, migration.limitsCopy));
  const compare = pages.compare;
  add('/comparer', compare.title, compare.intro, compare.footnote,
    section(compare.matrixTitle, compare.matrixCopy,
      ...compare.competitors.map((item) => section(item.name, item.copy, compare.soon))),
    section(compare.closingTitle, compare.closingCopy));
  add('/demo', pages.demo.title, pages.demo.intro, list(pages.demo.expectations), pages.demo.legal);
  add('/statut', pages.status.title, pages.status.intro,
    list(pages.status.components), section(pages.status.measurementTitle, pages.status.measurementCopy),
    section(pages.status.incidentsTitle, pages.status.noIncidents));
  add('/prestataires', providers.titleBefore + providers.titleAccent, providers.intro,
    providers.statsNote, section(providers.categoriesTitle, providers.categoriesCopy,
      ...providers.categories.map((item) => section(item.name, item.copy, list(item.examples)))),
    `[${providers.ctaJoin}](/prestataires/inscription?lang=${language})`);
  for (const slug of catalog.modules) {
    const text = moduleText(slug, language);
    add(`/produit/${slug}`, text.heroTitle, text.heroCopy, features(text.features), faq(text.faq));
  }
  // This route renders AgentsPage, rather than the generic product page.
  add('/produit/agents-ia', agents.hero.title, agents.hero.copyBefore + agents.hero.copyStrong,
    list(agents.trust), section(agents.agentsTitle, agents.agentsCopy,
      ...agents.agents.map((agent) => section(agent.name,
        `${agents.watchesLabel} : ${agent.watches}`, `${agents.proposesLabel} : ${agent.proposes}`))),
    section(agents.hitl.title, agents.hitl.copy));
  // LegalPage currently renders the French corpus for every language query.
  for (const doc of legalDocs('fr')) {
    add(`/legal/${doc.slug}`, doc.title, doc.updated, doc.intro,
      ...doc.blocks.map((block) => section(block.heading,
        ...(block.paragraphs ?? []), list(block.list ?? []),
        block.table ? [block.table.headers, block.table.headers.map(() => '---'), ...block.table.rows]
          .map((row) => `| ${row.map((cell) => cell.replaceAll('|', '\\|')).join(' | ')} |`).join('\n') : '')));
  }
  return documents;
}
