import { buildDocx, CHECKED, UNCHECKED, type DocxBlock } from './docx/docx';
import {
  articlePath,
  articleSources,
  LEGAL_SOURCES,
  legalSourceLabel,
  type LegalStage,
} from '../data/legal';
import type { LegalArticle } from '../data/legal/types';
import type { LEGAL_MESSAGES } from './messages/baitlyLegal';
import type { SiteLanguage } from './siteLanguage';

const STAGES: LegalStage[] = ['ouvrir', 'accueillir', 'suivre'];
const SITE = 'https://baitly.fr';
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * Le guide des obligations d'un pays, en document Word.
 *
 * <p>Même contenu que la page : les dossiers par étape, leurs repères, les
 * actions à mener et les textes officiels — plus l'état des cases cochées
 * pendant la visite. Le français et l'arabe portent la liste d'actions et les
 * repères ; l'anglais, comme la page, s'en tient au résumé traduit.</p>
 */
export function buildObligationsGuide({
  language,
  country,
  articles,
  checked,
  m,
}: {
  language: SiteLanguage;
  country: { name: Record<SiteLanguage, string>; scope: Record<SiteLanguage, string> };
  articles: LegalArticle[];
  checked: ReadonlySet<string>;
  m: (typeof LEGAL_MESSAGES)[SiteLanguage];
}): Blob {
  const title = (a: LegalArticle) => (language === 'en' ? a.guide.en.title : a.title);
  const summary = (a: LegalArticle) => (language === 'en' ? a.guide.en.copy : a.description);
  const detailed = language !== 'en';
  const today = new Intl.DateTimeFormat(
    { fr: 'fr-FR', en: 'en-GB', ar: 'ar-MA' }[language],
    { day: 'numeric', month: 'long', year: 'numeric' },
  )
    .format(new Date())
    // Typographie française : « 1er octobre », pas « 1 octobre ».
    .replace(/^1 /, language === 'fr' ? '1er ' : '1 ');
  const done = articles.filter((a) => checked.has(a.slug)).length;
  const countryName = country.name[language];

  const blocks: DocxBlock[] = [
    { kind: 'kicker', text: `Baitly · ${m.eyebrow}` },
    { kind: 'title', text: countryName },
    { kind: 'paragraph', style: 'lead', runs: [{ text: country.scope[language] }] },
    {
      kind: 'paragraph',
      style: 'muted',
      runs: [{ text: `${m.reviewed} ${m.date}  ·  ${m.docxExported} ${today}` }],
    },
    {
      kind: 'paragraph',
      runs: [
        { text: `${done} / ${articles.length} `, bold: true, color: '264672', size: 13 },
        { text: m.docxProgress, color: '264672', size: 13 },
      ],
    },
    { kind: 'paragraph', style: 'muted', runs: [{ text: m.docxNote }] },
    { kind: 'rule' },
  ];

  STAGES.forEach((stage, index) => {
    const inStage = articles.filter((a) => a.stage === stage);
    if (inStage.length === 0) return;
    blocks.push(
      { kind: 'heading', level: 1, runs: [{ text: `0${index + 1}  ${m.stages[stage]}` }] },
      { kind: 'paragraph', style: 'muted', runs: [{ text: m.stageCopy[stage] }] },
    );
    for (const article of inStage) {
      blocks.push(
        {
          kind: 'heading',
          level: 2,
          runs: [
            { text: checked.has(article.slug) ? `${CHECKED}  ` : `${UNCHECKED}  `, color: '264672' },
            { text: title(article) },
          ],
        },
        { kind: 'paragraph', runs: [{ text: summary(article) }] },
      );
      if (detailed && article.facts.length > 0) {
        blocks.push({
          kind: 'facts',
          rows: article.facts.map(
            (fact) => [capitalize(fact.label), fact.value] as const,
          ),
        });
      }
      if (detailed && article.checklist.length > 0) {
        blocks.push({
          kind: 'paragraph',
          runs: [{ text: m.actions, bold: true, color: '264672' }],
        });
        for (const item of article.checklist) {
          blocks.push({ kind: 'check', checked: false, runs: [{ text: item }] });
        }
      }
      blocks.push({
        kind: 'paragraph',
        style: 'muted',
        runs: [
          {
            text: language === 'en' ? m.readFr : m.docxOnline,
            link: `${SITE}${articlePath(article)}?lang=${language}`,
          },
        ],
      });
      const sources = articleSources(article);
      if (sources.length > 0) {
        blocks.push({
          kind: 'paragraph',
          style: 'muted',
          runs: [
            { text: `${m.docxSources}${language === 'fr' ? ' : ' : ': '}`, bold: true },
            ...sources.flatMap((id, i) => [
              ...(i > 0 ? [{ text: '  ·  ' }] : []),
              { text: legalSourceLabel(id, language), link: LEGAL_SOURCES[id].url },
            ]),
          ],
        });
      }
    }
  });

  const allSources = [...new Set(articles.flatMap(articleSources))];
  blocks.push(
    { kind: 'heading', level: 1, runs: [{ text: m.allSources }] },
    ...allSources.map(
      (id, i): DocxBlock => ({
        kind: 'numbered',
        index: i + 1,
        runs: [{ text: legalSourceLabel(id, language), link: LEGAL_SOURCES[id].url }],
      }),
    ),
    { kind: 'paragraph', style: 'note', runs: [{ text: m.methodCopy }] },
  );

  return buildDocx({
    title: `${m.eyebrow} — ${countryName}`,
    language,
    blocks,
    footer: `Baitly · ${m.eyebrow} — ${countryName}`,
    pageLabel: m.docxPage,
  });
}
