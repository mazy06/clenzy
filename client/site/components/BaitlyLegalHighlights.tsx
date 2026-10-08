import { ArrowRight } from '../../src/icons/glyphs';
import { Link } from 'react-router-dom';
import { legalArticleImage } from '../data/legal/articleImages';
import { LEGAL_MESSAGES } from '../lib/messages/baitlyLegal';
import type { SiteLanguage } from '../lib/siteLanguage';

// Curated teaser copy keeps the homepage independent of the full article corpus.
const HIGHLIGHTS = [
  {
    slug: 'maroc-autorisation-hebergement-chez-habitant',
    country: { fr: 'Maroc', en: 'Morocco', ar: 'المغرب' },
    title: {
      fr: 'Accueillir chez soi, avec le bon dossier.',
      en: 'Prepare the right paperwork for your homestay.',
      ar: 'استقبل ضيوفك بملف مكتمل.',
    },
    copy: {
      fr: 'Autorisation, assurance, pièces à réunir : comprendre le cadre de l’hébergement chez l’habitant.',
      en: 'Permits, insurance and supporting documents: understand the homestay framework.',
      ar: 'الترخيص والتأمين والوثائق المطلوبة: فهم إطار الإيواء لدى الساكن.',
    },
  },
  {
    slug: 'france-changement-usage-dpe-meuble-tourisme',
    country: { fr: 'France', en: 'France', ar: 'فرنسا' },
    title: {
      fr: 'Changement d’usage et DPE : les règles à connaître.',
      en: 'Change of use and EPC: know the requirements.',
      ar: 'تغيير الاستعمال وتشخيص الطاقة: القواعد الأساسية.',
    },
    copy: {
      fr: 'Le logement, la commune et le calendrier énergétique.',
      en: 'The property, municipality and energy timetable.',
      ar: 'العقار والبلدية والجدول الزمني للطاقة.',
    },
  },
  {
    slug: 'arabie-saoudite-reservation-paiement-unite-privee',
    country: { fr: 'Arabie saoudite', en: 'Saudi Arabia', ar: 'السعودية' },
    title: {
      fr: 'Réserver et encaisser par les bons canaux.',
      en: 'Use the right booking and payment channels.',
      ar: 'الحجز والتحصيل عبر القنوات المناسبة.',
    },
    copy: {
      fr: 'Ce que prévoit le règlement de septembre 2026.',
      en: 'What the September 2026 regulation requires.',
      ar: 'ما تنص عليه لائحة سبتمبر 2026.',
    },
  },
] as const;

export default function BaitlyLegalHighlights({
  language,
}: {
  language: SiteLanguage;
}) {
  const m = LEGAL_MESSAGES[language];
  return (
    <section className="blg-home-editorial" aria-labelledby="home-legal-title">
      <header>
        <div>
          <p className="blg-kicker">{m.journal}</p>
          <h2 id="home-legal-title">{m.homeTitle}</h2>
        </div>
        <div>
          <p>{m.homeCopy}</p>
          <Link to={`/ressources/blog?lang=${language}`}>
            {m.open}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <div className="blg-home-stories">
        {HIGHLIGHTS.map((a, index) => (
          <Link
            key={a.slug}
            to={`/ressources/blog/${a.slug}?lang=${language}`}
            className={index === 0 ? 'blg-home-lead' : 'blg-home-story'}
          >
            <img
              src={legalArticleImage(a.slug).thumbnail}
              srcSet={`${legalArticleImage(a.slug).thumbnail} 480w, ${legalArticleImage(a.slug).src} 1200w`}
              sizes={
                index === 0
                  ? '(max-width: 767px) calc(100vw - 40px), 50vw'
                  : '(max-width: 767px) 100px, 140px'
              }
              alt=""
              loading="lazy"
              decoding="async"
              width="1200"
              height="800"
            />
            <div>
              <span className="blg-kicker">
                {a.country[language]}
                {language === 'en' && ' · FR'}
              </span>
              <h3>{a.title[language]}</h3>
              <p>{a.copy[language]}</p>
              <span className="blg-text-link">
                {language === 'en' ? m.readFr : m.read}
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
