import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import type { WelcomeGuide } from '../../services/api/welcomeGuideApi';
import { parseActivities, parseHeroPhotoIds, parsePois, parseSections } from '../../services/api/welcomeGuideApi';
import { propertyPhotosApi } from '../../services/api/propertyPhotosApi';
import { Skeleton } from '../../components/ui';
import WelcomeBookView, { type Lang, type WelcomeBookModel } from './WelcomeBookView';
import { GUIDE_LABELS } from './guideLabels';
import { normalizeTheme, WELCOME_BOOK_THEMES } from './welcomeBookThemes';
import './baitlyGuideLibrary.css';

/** Saved guides use the guest renderer, with their own content, theme and property photos. */
export function BaitlyGuideCard({ guide, city, ownerInitials, onEdit, actions }: {
  guide: WelcomeGuide;
  city?: string | null;
  ownerInitials: string;
  onEdit: () => void;
  actions: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = WELCOME_BOOK_THEMES.find(item => item.id === normalizeTheme(guide.theme))!;
  const lang: Lang = guide.language.startsWith('ar') ? 'ar' : guide.language.startsWith('en') ? 'en' : 'fr';
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['property-photos', guide.propertyId],
    queryFn: () => propertyPhotosApi.list(guide.propertyId!),
    enabled: guide.propertyId != null,
    staleTime: 5 * 60_000,
  });
  const priority = parseHeroPhotoIds(guide.heroPhotoIds);
  const orderedPhotos = [...photos].sort((a, b) => {
    const ai = priority.indexOf(a.id), bi = priority.indexOf(b.id);
    return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) || a.sortOrder - b.sortOrder;
  });
  const model: WelcomeBookModel = {
    ...guide,
    property: { name: guide.propertyName, city: city ?? null, address: null, postalCode: null, country: null, latitude: null, longitude: null },
    sections: parseSections(guide.sections), pois: parsePois(guide.pois), activities: parseActivities(guide.curatedActivities),
    practical: null, stay: null, checkIn: null, accessPhotos: [], upsells: [],
  };
  return <article className="baitly-guide-card">
    <div className="baitly-guide-card__preview" aria-hidden="true">
      {isLoading ? <Skeleton className="h-full w-full rounded-none" /> : <svg viewBox="0 0 360 560" preserveAspectRatio="xMidYMin slice" className="baitly-guide-card__snapshot">
        <foreignObject width="360" height="740">
          <div style={{ height: 740 }} ref={(node) => { if (node) node.inert = true; }}>
            <WelcomeBookView model={model} theme={theme.id} lang={lang} labels={GUIDE_LABELS[lang]}
              heroImages={orderedPhotos.map(photo => propertyPhotosApi.getPhotoUrl(guide.propertyId!, photo.id))}
              interactive={false} showMap={false} />
          </div>
        </foreignObject>
      </svg>}
    </div>
    <div className="baitly-guide-card__body">
    <div className="baitly-guide-card__toolbar">
      <span className="baitly-guide-card__status" data-published={guide.published}>
        {guide.published ? t('welcomeGuide.studio.published') : t('welcomeGuide.studio.draft')}
      </span>
      {actions}
    </div>
      <button type="button" className="baitly-guide-card__open" onClick={onEdit}>
        <span>{guide.title}</span><ArrowUpRight size={18} aria-hidden />
      </button>
      <p className="baitly-guide-card__property" title={[guide.propertyName, city].filter(Boolean).join(' · ')}>{guide.propertyName}{city ? ` · ${city}` : ''}</p>
      <div className="baitly-guide-card__meta">
        <span className="baitly-guide-card__theme">{t(`welcomeGuide.themes.${theme.id}.name`, theme.name)}</span>
        <span className="baitly-guide-card__language">{guide.language.toUpperCase()}</span>
        <span className="baitly-guide-card__owner" title={t('welcomeGuide.studio.you')} aria-label={t('welcomeGuide.studio.you')}>{ownerInitials}</span>
      </div>

    </div>
  </article>;
}
