import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';
import type { ResourceKind } from '../data/baitlyResources';
import {
  RevenueCalculator,
  MarketBarometer,
  ObligationsGuide,
  BaitlyAcademy,
  BaitlyJournal,
  ResourceGlossary,
} from '../components/BaitlyResourceTools';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import AcademyEpisodeView, { ACADEMY_PRACTICE_ID } from '../components/academy/AcademyEpisodeView';
import AcademyProgram from '../components/academy/AcademyProgram';
import { ACADEMY_EPISODES, academyEpisode } from '../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES } from '../lib/messages/baitlyAcademy';
import NotFoundPage from './NotFoundPage';

const TOOLS = {
  calculateur: RevenueCalculator,
  barometre: MarketBarometer,
  obligations: ObligationsGuide,
  academie: BaitlyAcademy,
  blog: BaitlyJournal,
  glossaire: ResourceGlossary,
};
const RELATED: Record<ResourceKind, ResourceKind[]> = {
  calculateur: ['academie', 'barometre'],
  barometre: ['calculateur', 'glossaire'],
  obligations: ['academie', 'blog'],
  academie: ['calculateur', 'glossaire'],
  blog: ['academie', 'calculateur'],
  glossaire: ['barometre', 'academie'],
};

export default function BaitlyResourcePage({ kind }: { kind: ResourceKind }) {
  const { language } = useSiteLanguage();
  const [params] = useSearchParams();
  const { episode: episodeSlug } = useParams();
  // Arrivée depuis la fin de l'épisode précédent (« À suivre ») : la vidéo démarre seule.
  const autoPlay = (useLocation().state as { academyAutoplay?: boolean } | null)?.academyAutoplay === true;
  const country = params.get('country') ?? 'MA';
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const module = m.modules[kind];
  const Tool = TOOLS[kind];
  const Back = language === 'ar' ? ArrowRight : ArrowLeft;
  // Académie : une page par épisode (/ressources/academie/<épisode>), l'épisode 01 sur la page d'accueil.
  const academy = BAITLY_ACADEMY_MESSAGES[language];
  const episode = kind === 'academie' ? (episodeSlug ? academyEpisode(episodeSlug) : ACADEMY_EPISODES[0]) : undefined;
  if (kind === 'academie' && episodeSlug && !episode) return <NotFoundPage />;
  const episodeText = episodeSlug && episode ? academy.episodes[episode.slug] : undefined;
  const startAt = Number(params.get('t'));
  return (
    <div className={`brs-page brs-tool-page brs-tool-${kind}`}>
      <header className="brs-tool-header site-shell">
        <Link
          className="brs-back"
          to={episodeText ? `/ressources/academie?lang=${language}` : `/ressources?lang=${language}`}
        >
          <Back size={16} />
          {episodeText ? module.name : m.back}
        </Link>
        <span className="brs-eyebrow">
          {module.name} · {episodeText ? `${academy.ui.episode} ${episode!.number}` : module.tag}
        </span>
        <h1>{episodeText ? episodeText.title : module.title}</h1>
        <p>{episodeText ? episodeText.description : module.intro}</p>
      </header>
      <div className="site-shell brs-tool-content">
        {episode ? (
          <div className="bac-page">
            <AcademyEpisodeView
              key={episode.slug}
              episode={episode}
              language={language}
              startAt={Number.isFinite(startAt) && startAt > 0 ? startAt : undefined}
              autoPlay={autoPlay}
            />
            <AcademyProgram language={language} current={episodeSlug ? episode.slug : undefined} />
            <section className="bac-practice" id={ACADEMY_PRACTICE_ID} aria-labelledby="academie-pratique-titre">
              <div className="bac-program-head">
                <h2 id="academie-pratique-titre">{academy.ui.practiceTitle}</h2>
                <p>{academy.ui.practiceCopy}</p>
              </div>
              <BaitlyAcademy language={language} />
            </section>
          </div>
        ) : kind === 'obligations' ? (
          <ObligationsGuide
            key={country}
            language={language}
            initialCountry={country}
          />
        ) : (
          <Tool key={kind} language={language} />
        )}
      </div>
      <section className="site-shell brs-related">
        <span className="brs-eyebrow">{m.related}</span>
        <div>
          {RELATED[kind].map((id) => (
            <Link key={id} to={`/ressources/${id}?lang=${language}`}>
              <span>
                <strong>{m.modules[id].name}</strong>
                <small>{m.modules[id].copy}</small>
              </span>
              <ArrowRight size={22} />
            </Link>
          ))}
        </div>
      </section>
      <section className="brs-cta">
        <div className="site-shell">
          <div>
            <h2>{m.cta.title}</h2>
            <p>{m.cta.copy}</p>
          </div>
          <SiteAcquisitionLink
            className="brs-button"
            to={`/demo?lang=${language}`}
          >
            {m.cta.action}
            <ArrowRight size={18} />
          </SiteAcquisitionLink>
        </div>
      </section>
    </div>
  );
}
