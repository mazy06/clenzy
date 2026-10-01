import { HOME_MESSAGES } from '../site/lib/messages/home';
import { PAGE_MESSAGES } from '../site/lib/messages/pages';
import { PRICING_MESSAGES } from '../site/lib/messages/pricing';
import { BAITLY_LOYALTY_MESSAGES } from '../site/lib/messages/baitlyLoyalty';
import {
  BAITLY_LOYALTY_STAGES,
  BAITLY_VOLUME_TIERS,
  DEFAULT_PRICING_MARKET,
  formatLoyaltyPrice,
  loyaltyUnitPrice,
} from '../site/data/baitlyLoyaltyPricing';
import { PROVIDERS_MESSAGES } from '../site/lib/messages/providers';
import { AGENTS_MESSAGES } from '../site/lib/messages/agents';
import { BAITLY_PRODUCT_MESSAGES } from '../site/lib/messages/baitlyProducts';
import { productStoryKind } from '../site/data/baitlyProductStories';
import { PRELAUNCH_MESSAGES } from '../site/lib/messages/prelaunch';
import {
  BAITLY_READINESS_MESSAGES,
  BAITLY_COMPARISON_ROUTES,
} from '../site/lib/messages/baitlyReadiness';
import { moduleText } from '../site/lib/messages/modules';
import { resourceText } from '../site/lib/messages/solutions';
import { BAITLY_JOURNEY_MESSAGES } from '../site/lib/messages/baitlyJourneys';
import { BAITLY_CONTACT_MESSAGES } from '../site/lib/messages/baitlyContact';
import { BAITLY_RESOURCE_MESSAGES } from '../site/lib/messages/baitlyResources';
import {
  MARKET_CITIES,
  MARKET_SOURCE,
  type ResourceKind,
} from '../site/data/baitlyResources';
import { RESOURCE_GLOSSARY } from '../site/data/baitlyResourceGlossary';
import { ACADEMY_EPISODES } from '../site/data/baitlyAcademyVideos';
import { ACADEMY_TRANSCRIPTS } from '../site/data/baitlyAcademyTranscripts';
import { BAITLY_ACADEMY_MESSAGES } from '../site/lib/messages/baitlyAcademy';
import { legalDocs } from '../src/modules/legal/corpus';
import type { SiteLanguage } from '../site/lib/siteLanguage';
import { legalDocuments } from '../site/data/legal/publication';

export const DISCOVERY_LANGUAGES = ['fr', 'en', 'ar'] as const;
export const PRIVATE_SITE_PATHS = [
  '/prestataires/inscription',
  '/prestataires/activation',
  '/inscription',
  '/register',
];
export interface DiscoveryCatalog {
  modules: string[];
  solutions: string[];
  resources: string[];
}

const section = (title: string, ...text: string[]) =>
  `## ${title.replace(/\s+/g, ' ')}\n\n${text.join('\n\n')}`;
const clock = (seconds: number) => {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
const list = (items: readonly string[]) =>
  items.map((item) => `- ${item}`).join('\n');
const faq = (items: ReadonlyArray<{ q: string; a: string }>) =>
  items.map(({ q, a }) => section(q, a)).join('\n\n');
const features = (items: ReadonlyArray<{ title: string; copy: string }>) =>
  items.map(({ title, copy }) => section(title, copy)).join('\n\n');

/** Public editorial content only: no application state, mock reservations or API calls. */
export function siteDocuments(
  language: SiteLanguage,
  catalog: DiscoveryCatalog,
): Map<string, string> {
  const documents = new Map<string, string>();
  const add = (path: string, title: string, ...parts: string[]) => {
    documents.set(
      path,
      `# ${title.replace(/\s+/g, ' ')}\n\n${parts.filter(Boolean).join('\n\n')}\n`,
    );
  };
  const home = HOME_MESSAGES[language];
  const pages = PAGE_MESSAGES[language];
  const pricing = PRICING_MESSAGES[language];
  const loyalty = BAITLY_LOYALTY_MESSAGES[language];
  const pricingMarket = DEFAULT_PRICING_MARKET[language];
  const providers = PROVIDERS_MESSAGES[language];
  const agents = AGENTS_MESSAGES[language];
  add(
    '/',
    `Baitly · ${home.hero.title1} ${home.hero.title2}`,
    `${home.hero.lead1} ${home.hero.lead2}`,
    home.hero.description,
    home.hero.audience,
    section(
      `${home.platform.title1} ${home.platform.title2}`,
      home.platform.intro,
      home.platform.planningCopy,
      home.platform.directCopy,
    ),
    section(
      `${home.local.title1} ${home.local.title2}`,
      home.local.copy,
      ...home.local.points.map(([title, copy]) => section(title, copy)),
    ),
    faq(home.faq.items.map(([q, a]) => ({ q, a }))),
    `[${home.hero.demo}](/demo?lang=${language})`,
    list(
      catalog.modules.map(
        (slug) =>
          `[${moduleText(slug, language).name}](/produit/${slug}?lang=${language})`,
      ),
    ),
  );
  const journeys = BAITLY_JOURNEY_MESSAGES[language];
  add(
    '/solutions',
    journeys.solutions.title,
    journeys.solutions.intro,
    ...journeys.solutions.stories.map((item) =>
      section(
        item.name,
        item.title,
        item.copy,
        features(item.steps),
        section(item.question, item.answer),
      ),
    ),
    section(
      journeys.solutions.countriesTitle,
      journeys.solutions.countriesCopy,
      ...journeys.solutions.countries.map((item) =>
        section(item.name, item.copy),
      ),
    ),
  );
  const resources = BAITLY_RESOURCE_MESSAGES[language];
  const academy = BAITLY_ACADEMY_MESSAGES[language];
  add(
    '/ressources',
    `${resources.hero.title} ${resources.hero.accent}`,
    resources.hero.intro,
    ...catalog.resources.map((id) => {
      const item = resourceText(id, language);
      return section(
        item.name,
        item.copy,
        `[${resources.open}](/ressources/${id}?lang=${language})`,
      );
    }),
  );
  for (const id of catalog.resources as ResourceKind[]) {
    const module = resources.modules[id];
    const content: string[] = [];
    if (id === 'calculateur')
      content.push(
        resources.calc.note,
        section(resources.calc.method, list(resources.calc.formulas)),
      );
    if (id === 'barometre')
      content.push(
        resources.market.scope,
        resources.market.period,
        resources.market.published,
        list(
          MARKET_CITIES.map(
            (city) =>
              `${language === 'ar' ? city.ar : city.name} : +${city.growth} %`,
          ),
        ),
        resources.market.methodCopy,
        resources.market.useCopy,
        resources.market.unavailable,
        `[${resources.market.sourceName}](${MARKET_SOURCE})`,
      );
    if (id === 'academie')
      content.push(
        section(
          academy.ui.series,
          list(
            ACADEMY_EPISODES.map(
              (episode) =>
                `[${academy.ui.episode} ${episode.number} · ${academy.episodes[episode.slug].title}](/ressources/academie/${episode.slug}?lang=${language}) · ${clock(episode.duration)}`,
            ),
          ),
        ),
        section(
          academy.ui.practiceTitle,
          academy.ui.practiceCopy,
          ...resources.academy.lessons.map((lesson) =>
            section(
              lesson.title,
              lesson.intro,
              features(lesson.sections),
              lesson.takeaway,
            ),
          ),
        ),
      );
    if (id === 'blog')
      content.push(
        ...resources.blog.articles.map((article) =>
          section(
            article.title,
            article.intro,
            features(article.sections),
            article.takeaway,
          ),
        ),
      );
    if (id === 'glossaire')
      content.push(
        ...RESOURCE_GLOSSARY.map((entry) =>
          section(entry[language].term, entry[language].definition),
        ),
      );
    add(`/ressources/${id}`, module.title, module.intro, ...content);
  }
  // Une page par épisode vidéo : ce qu'on apprend, les chapitres horodatés et la transcription complète.
  for (const episode of ACADEMY_EPISODES) {
    const text = academy.episodes[episode.slug];
    add(
      `/ressources/academie/${episode.slug}`,
      text.title,
      text.description,
      `${resources.modules.academie.name} · ${academy.ui.episode} ${episode.number} · ${academy.themes[episode.theme]} · ${clock(episode.duration)}`,
      !episode.languages.includes(language) && academy.ui.languageNote
        ? academy.ui.languageNote
        : '',
      section(academy.ui.learn, list(text.learn)),
      section(
        academy.ui.chapters,
        list(
          episode.chapters.map(
            (start, index) => `${clock(start)} ${text.chapters[index]}`,
          ),
        ),
      ),
      section(
        academy.ui.transcript,
        ACADEMY_TRANSCRIPTS[episode.slug]?.[language] ??
          ACADEMY_TRANSCRIPTS[episode.slug]?.fr ??
          '',
      ),
      `[${resources.modules.academie.name}](/ressources/academie?lang=${language})`,
    );
  }
  add(
    '/tarifs',
    pricing.title,
    pricing.intro,
    loyalty.proposal,
    loyalty.simulationNote,
    ...pricing.plans.map((plan) =>
      section(
        plan.name,
        `${plan.price} ${plan.unit}`,
        plan.copy,
        list(plan.features),
      ),
    ),
    section(
      loyalty.volumeTitle,
      loyalty.volumeHint,
      list(
        BAITLY_VOLUME_TIERS.map(
          (tier) =>
            `${tier.start}–${tier.end} ${loyalty.propertyWords[1]} : ${tier.discount ? '−' : ''}${tier.discount} %`,
        ),
      ),
    ),
    section(
      loyalty.simulator,
      `1 ${loyalty.propertyWords[0]}`,
      ...(['essential', 'pro'] as const).map((plan, index) =>
        section(
          pricing.plans[index].name,
          list(
            BAITLY_LOYALTY_STAGES.map(
              (stage, i) =>
                `${loyalty.periods[i]} : ${formatLoyaltyPrice(loyaltyUnitPrice(pricingMarket, plan, stage.start), pricingMarket, language)} ${loyalty.unit}`,
            ),
          ),
        ),
      ),
    ),
    section(
      pricing.addonsTitle,
      pricing.addonsCopy,
      pricing.addonsPending,
      ...pricing.addons.map((item) => section(item.name, item.copy)),
    ),
    faq(pricing.faq),
  );
  const migration = pages.migration;
  add(
    '/migration',
    `${migration.title} ${migration.titleAccent}`,
    migration.intro,
    section(
      migration.channelsTitle,
      migration.channelsIntro,
      ...migration.channels.map((item) =>
        section(item.name, item.copy, list(item.points)),
      ),
      migration.sourceNote,
    ),
    section(migration.stepsTitle, features(migration.steps)),
    section(migration.dataTitle, migration.dataIntro, features(migration.data)),
    section(migration.guaranteesTitle, list(migration.guarantees)),
    section(migration.limitsTitle, migration.limitsCopy),
    section(
      migration.supportTitle,
      migration.supportCopy,
      list(migration.checklist),
    ),
  );
  const compare = pages.compare;
  add(
    '/comparer',
    compare.title.replace('\n', ' '),
    compare.intro,
    compare.note,
    section(
      compare.criteriaTitle,
      compare.criteriaCopy,
      ...compare.criteria.map((item, index) =>
        section(
          item.title,
          item.question,
          item.copy,
          `[${item.action}](${BAITLY_COMPARISON_ROUTES[index]}?lang=${language})`,
        ),
      ),
    ),
    section(compare.closingTitle, compare.closingCopy),
  );
  const contact = BAITLY_CONTACT_MESSAGES[language];
  add(
    '/contact',
    contact.title.replace('\n', ' '),
    contact.intro,
    list(contact.steps),
    `Sinatech · ${contact.location}`,
    contact.privacy,
  );
  add(
    '/demo',
    contact.demoTitle.replace('\n', ' '),
    contact.demoIntro,
    list(contact.steps),
    contact.noAppointment,
  );
  // The launch date and registration status are server state, never build-time content.
  const prelaunch = PRELAUNCH_MESSAGES[language];
  const next = BAITLY_READINESS_MESSAGES[language].next;
  for (const path of ['/bientot-disponible', '/pre-lancement']) {
    add(
      path,
      prelaunch.title,
      prelaunch.intro,
      section(next.title, features(next.steps), next.note),
      section(
        next.explore,
        next.copy,
        `[${next.planning}](/produit/pms-channel-manager?lang=${language})`,
        `[${next.booking}](/produit/booking-engine?lang=${language})`,
      ),
      `[${prelaunch.cta}](/bientot-disponible?lang=${language})`,
      `[${prelaunch.privacy}](/legal/confidentialite?lang=${language})`,
    );
  }
  add(
    '/statut',
    pages.status.unknownTitle.replace('\n', ' '),
    pages.status.contextCopy,
    list(
      pages.status.components.map(
        (component) => `${component} : ${pages.status.unmeasured}`,
      ),
    ),
    section(pages.status.measurementTitle, pages.status.measurementCopy),
    section(pages.status.incidentsTitle, pages.status.noIncidents),
  );
  add(
    '/prestataires',
    providers.titleBefore + providers.titleAccent,
    providers.intro,
    providers.openingNote,
    section(
      providers.categoriesTitle,
      providers.categoriesCopy,
      ...providers.categories.map((item) =>
        section(item.name, item.copy, list(item.examples)),
      ),
    ),
    `[${providers.ctaJoin}](/prestataires/inscription?lang=${language})`,
  );
  for (const slug of catalog.modules) {
    const text = moduleText(slug, language);
    const kind = productStoryKind(slug);
    if (kind) {
      const story = BAITLY_PRODUCT_MESSAGES[language].pages[kind];
      add(
        `/produit/${slug}`,
        story.title.join(' '),
        story.intro,
        list(story.promises),
        section(
          story.featuresTitle,
          story.featuresIntro,
          features(kind === 'agents' ? agents.tabs : text.features),
        ),
        section(story.workflowTitle, features(story.steps)),
        ...(kind === 'agents'
          ? [
              section(
                agents.agentsTitle,
                ...agents.agents.map((agent) =>
                  section(
                    agent.name,
                    `${agents.watchesLabel} : ${agent.watches}`,
                    `${agents.proposesLabel} : ${agent.proposes}`,
                  ),
                ),
              ),
              section(agents.pricingTitle, agents.pricingCopy),
            ]
          : []),
        faq(kind === 'agents' ? agents.faq : text.faq),
      );
    } else if (slug === 'livret-accueil') {
      const welcome = journeys.welcome;
      add(
        `/produit/${slug}`,
        welcome.title,
        welcome.intro,
        section(welcome.journeyTitle, features(welcome.journey)),
        section(welcome.hostTitle, welcome.hostCopy, welcome.note),
        section(welcome.catalogTitle, welcome.catalogCopy, welcome.catalogNote),
        faq(welcome.faq),
      );
    } else {
      add(
        `/produit/${slug}`,
        text.heroTitle,
        text.heroCopy,
        features(text.features),
        faq(text.faq),
      );
    }
  }
  for (const doc of legalDocs(language)) {
    add(
      `/legal/${doc.slug}`,
      doc.title,
      doc.updated,
      contact.legalDraft,
      doc.intro,
      ...doc.blocks.map((block) =>
        section(
          block.heading,
          ...(block.paragraphs ?? []),
          list(block.list ?? []),
          block.table
            ? [
                block.table.headers,
                block.table.headers.map(() => '---'),
                ...block.table.rows,
              ]
                .map(
                  (row) =>
                    `| ${row.map((cell) => cell.replaceAll('|', '\\|')).join(' | ')} |`,
                )
                .join('\n')
            : '',
        ),
      ),
    );
  }
  for (const [path, content] of legalDocuments(language))
    documents.set(path, content);
  return documents;
}
