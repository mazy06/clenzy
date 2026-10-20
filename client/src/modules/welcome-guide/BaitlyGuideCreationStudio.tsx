import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Sparkles } from '../../icons/glyphs';
import { Button, Textarea, NativeSelect, NativeSelectOption, Skeleton } from '../../components/ui';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { PublicUpsell } from '../../services/api/upsellApi';
import type { GuidePreviewData, WelcomeGuide } from '../../services/api/welcomeGuideApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useIconSize } from '../../hooks/useResponsiveSize';
import WelcomeBookView, { type Lang, type WelcomeBookModel } from './WelcomeBookView';
import { BaitlyGuidePreview } from './BaitlyGuidePreview';
import { GUIDE_LABELS } from './guideLabels';
import { StructureArt } from './structureArt';
import { WELCOME_BOOK_THEMES, type WelcomeBookThemeId } from './welcomeBookThemes';
import { BAITLY_GUIDE_STRUCTURES, buildBaitlyPropertyGuideDraft, type BaitlyGuideStructureId } from './baitlyGuideStructures';
import './baitlyGuideCreation.css';

interface Props {
  properties: PropertyListItem[];
  selectedPropertyId: string;
  onPropertyChange: (id: string) => void;
  previewData?: GuidePreviewData;
  sourceGuide?: WelcomeGuide;
  heroImages: string[];
  upsells: PublicUpsell[];
  loadingPreview: boolean;
  previewError: boolean;
  onRetryPreview: () => void;
  structureId: BaitlyGuideStructureId;
  themeId: WelcomeBookThemeId;
  onStructureChange: (id: BaitlyGuideStructureId) => void;
  onThemeChange: (id: WelcomeBookThemeId) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  aiEnabled: boolean;
  generating: boolean;
  onCreate: () => void;
  onBlank: () => void;
}

/** Baitly creation workspace: the selected preset drives both the preview and the saved draft. */
export default function BaitlyGuideCreationStudio({
  structureId, themeId, onStructureChange, onThemeChange, prompt, onPromptChange,
  aiEnabled, generating, onCreate, onBlank,
  properties, selectedPropertyId, onPropertyChange, previewData, sourceGuide, heroImages,
  loadingPreview, previewError, onRetryPreview, upsells,
}: Props) {
  const { t, currentLanguage } = useTranslation();
  const iconSize = useIconSize('action');
  const [previewFocus, setPreviewFocus] = useState<'home' | 'content'>('home');
  const lang: Lang = currentLanguage.startsWith('ar') ? 'ar' : currentLanguage.startsWith('en') ? 'en' : 'fr';
  const property = properties.find((item) => item.id === selectedPropertyId);
  const draft = useMemo(() => buildBaitlyPropertyGuideDraft(lang, structureId, {
    description: property?.description, sourceGuide, practical: previewData?.practical,
  }), [lang, structureId, property?.description, sourceGuide, previewData?.practical]);
  const selectedStructure = BAITLY_GUIDE_STRUCTURES.find((item) => item.id === structureId)!;
  const structureName = t(`welcomeGuide.structures.${structureId}.name`);
  const themeName = t(`welcomeGuide.themes.${themeId}.name`, WELCOME_BOOK_THEMES.find((item) => item.id === themeId)!.name);
  const photos = heroImages.length ? heroImages : property?.photoUrls?.length ? property.photoUrls : property?.imageUrl ? [property.imageUrl] : [];
  const model: WelcomeBookModel = useMemo(() => ({
    ...draft,
    structure: structureId,
    title: property?.name ?? t('welcomeGuide.creation.chooseProperty'),
    property: previewData?.property ?? (property ? {
      name: property.name, address: property.address, city: property.city,
      postalCode: property.postalCode ?? null, country: property.country ?? null,
      latitude: property.latitude ?? null, longitude: property.longitude ?? null,
    } : null),
    practical: previewData?.practical ?? null,
    stay: previewData?.stay ?? null, checkIn: null,
    accessPhotos: [], upsells: draft.upsellsEnabled ? upsells : [],
  }), [draft, structureId, property, previewData, upsells, t]);

  return (
    <section className="baitly-guide-studio" aria-label={t('welcomeGuide.creation.eyebrow')}>
      <div className="baitly-guide-studio__workspace baitly-guide-editor-layout">
        <div className="baitly-guide-studio__choices">
          <div className="baitly-guide-studio__toolbar">
          <div className="baitly-guide-studio__property">
            <label htmlFor="baitly-guide-property">{t('welcomeGuide.creation.propertyLabel')}</label>
            <NativeSelect id="baitly-guide-property" className="w-full min-w-0" value={selectedPropertyId} disabled={generating || !properties.length}
              onChange={(event) => onPropertyChange(event.target.value)}>
              <NativeSelectOption value="" disabled>{t('welcomeGuide.creation.chooseProperty')}</NativeSelectOption>
              {properties.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}{item.city ? ` · ${item.city}` : ''}</NativeSelectOption>)}
            </NativeSelect>
          </div>

          <div className="baitly-guide-studio__preview-heading">
            <div><h3>{t('welcomeGuide.creation.previewTitle')}</h3><p aria-live="polite">{structureName} · {themeName}</p></div>
            <div className="baitly-guide-preview-tabs" role="group" aria-label={t('welcomeGuide.creation.previewNavigation')}>
              {(['home', 'content'] as const).map((focus) => (
                <button key={focus} type="button" aria-pressed={previewFocus === focus} onClick={() => setPreviewFocus(focus)}>
                  {t(`welcomeGuide.creation.preview${focus === 'home' ? 'Home' : 'Content'}`)}
                </button>
              ))}
            </div>
          </div>
          </div>
          <fieldset className="baitly-guide-studio__structures" disabled={generating}>
            <legend><span className="baitly-guide-studio__step">01</span>{t('welcomeGuide.creation.structureTitle')}</legend>
            <div className="baitly-guide-structures">
            {BAITLY_GUIDE_STRUCTURES.map((structure) => (
              <label key={structure.id} className="baitly-guide-structure" data-selected={structureId === structure.id}>
                <input type="radio" name="baitly-guide-structure" value={structure.id}
                  checked={structureId === structure.id} onChange={() => onStructureChange(structure.id)} />
                <span className="baitly-guide-structure__art"><StructureArt id={structure.id} /></span>
                <span className="baitly-guide-structure__name">{t(`welcomeGuide.structures.${structure.id}.name`)}</span>
                <span className="baitly-guide-structure__check" aria-hidden="true">{structureId === structure.id ? <Check size={iconSize} /> : null}</span>
              </label>
            ))}
            </div>
          </fieldset>

          <fieldset className="baitly-guide-studio__themes" disabled={generating}>
            <legend><span className="baitly-guide-studio__step">02</span>{t('welcomeGuide.creation.themeTitle')}</legend>
            <div className="baitly-guide-themes">
              {WELCOME_BOOK_THEMES.map((theme) => (
                <label key={theme.id} className="baitly-guide-theme" data-selected={theme.id === themeId}>
                  <input type="radio" name="baitly-guide-theme" value={theme.id}
                    checked={theme.id === themeId} onChange={() => onThemeChange(theme.id)} />
                  <span className="baitly-guide-theme__sample" data-theme={theme.id} aria-hidden="true">
                    <svg viewBox="0 0 360 470" className="baitly-guide-theme__snapshot" aria-hidden="true">
                      <foreignObject width="360" height="740">
                        <div style={{ height: 740 }} ref={(node) => { if (node) node.inert = true; }}>
                          <WelcomeBookView model={model} theme={theme.id} lang={lang} labels={GUIDE_LABELS[lang]}
                            heroImages={photos.slice(0, 3)} interactive={false} showMap={false} />
                        </div>
                      </foreignObject>
                    </svg>
                    {theme.id === themeId ? <span className="baitly-guide-theme__selected"><Check size={14} /></span> : null}
                  </span>
                  <span className="baitly-guide-theme__name">{t(`welcomeGuide.themes.${theme.id}.name`, theme.name)}</span>
                  {theme.id === selectedStructure.recommendedTheme ? <span className="baitly-guide-theme__recommendation">{t('welcomeGuide.creation.recommended')}</span> : null}
                </label>
              ))}
            </div>
          </fieldset>

          {aiEnabled ? (
            <details className="baitly-guide-assist">
              <summary><Sparkles size={iconSize} /><span>{t('welcomeGuide.creation.aiTitle')}</span><ChevronDown size={iconSize} /></summary>
              <label htmlFor="baitly-guide-prompt">{t('welcomeGuide.creation.aiHint')}</label>
              <Textarea id="baitly-guide-prompt" value={prompt} disabled={generating}
                onChange={(event) => onPromptChange(event.target.value)} placeholder={t('welcomeGuide.studio.promptPlaceholderAi')}
                onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !generating) { event.preventDefault(); onCreate(); } }} />
            </details>
          ) : null}

          <div className="baitly-guide-studio__actions">
            <Button onClick={onCreate} disabled={generating}>
              {generating ? t('welcomeGuide.creation.generating') : prompt.trim() && aiEnabled ? t('welcomeGuide.studio.generateGuide') : t('welcomeGuide.creation.continue')}
              <ArrowRight size={iconSize} className="rtl:rotate-180" />
            </Button>
            <Button variant="ghost" onClick={onBlank} disabled={generating}>{t('welcomeGuide.studio.blankGuide')}</Button>
          </div>
        </div>

        <BaitlyGuidePreview label={t('welcomeGuide.creation.previewTitle')} phoneClassName="baitly-guide-studio__device">
            {loadingPreview ? <div className="baitly-guide-studio__preview-loading"><Skeleton className="h-64 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>
              : previewError ? <div className="baitly-guide-studio__preview-loading" role="alert"><p>{t('welcomeGuide.creation.propertyError')}</p><Button variant="outline" onClick={onRetryPreview}>{t('welcomeGuide.creation.retry')}</Button></div>
              : !property ? <div className="baitly-guide-studio__preview-loading"><p>{t('welcomeGuide.creation.chooseProperty')}</p></div>
              : <WelcomeBookView key={`${structureId}-${lang}-${selectedPropertyId}`} model={model} theme={themeId} lang={lang} labels={GUIDE_LABELS[lang]}
                  heroImages={photos} interactive={false} previewFocus={previewFocus} />}
        </BaitlyGuidePreview>
      </div>
    </section>
  );
}
