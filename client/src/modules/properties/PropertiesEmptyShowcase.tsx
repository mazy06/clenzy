import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeIcon, TrendingUpIcon, TicketPercentIcon, BlocksIcon } from '../../icons/glyphs';
import { Button } from '../../components/ui';
import { NightStage, StageFoot, StageRail, useStageScene, type RailStep } from '../../components/baitly/NightStage';
import { STAGE_IMAGES } from '../../components/baitly/stageImages';
import { useTranslation } from '../../hooks/useTranslation';
import { PropertyDemo, PricingDemo, VoucherDemo, DevicesDemo } from './PropertyOnboardingDemos';
import { ROOM_STORIES } from './ConnectedRoomsDemo';
import './propertiesEmpty.css';

/**
 * Première visite des écrans Propriétés, sur la scène bleu nuit.
 *
 * Chaque onglet = une promesse en une phrase, deux gestes, un aperçu et un rail
 * de quatre étapes en images. Les anciennes listes « par où commencer » et les
 * paragraphes de détail sont remplacés par le rail : l'image porte le sens,
 * l'étape active pilote l'aperçu.
 */

const THUMB = (room: string) => `/images/connected-rooms/baitly-${room}-thumb.webp`;

const PRESENTATIONS = {
  properties: {
    Demo: PropertyDemo, Icon: HomeIcon,
    // Fiche → pièces → arrivées → annonces
    images: [STAGE_IMAGES.photos, STAGE_IMAGES.bedrooms, STAGE_IMAGES.departures, STAGE_IMAGES.channelSync],
  },
  pricing: {
    Demo: PricingDemo, Icon: TrendingUpIcon,
    images: [STAGE_IMAGES.adr, STAGE_IMAGES.pricingSeasons, STAGE_IMAGES.pending, STAGE_IMAGES.distribution],
  },
  vouchers: {
    Demo: VoucherDemo, Icon: TicketPercentIcon,
    images: [STAGE_IMAGES.promotion, STAGE_IMAGES.calendar, STAGE_IMAGES.payment, STAGE_IMAGES.ownerReport],
  },
  // Les étapes sont les vraies pièces de la page Objets connectés.
  'connected-objects': {
    Demo: DevicesDemo, Icon: BlocksIcon,
    images: ROOM_STORIES.map(({ room }) => THUMB(room)),
  },
} as const;
export type PropertyIntroduction = keyof typeof PRESENTATIONS;
export function isPropertyIntroduction(key: string | undefined): key is PropertyIntroduction {
  return key !== undefined && Object.hasOwn(PRESENTATIONS, key);
}
const STEPS = [0, 1, 2, 3] as const;

/** Première visite seulement : le portefeuille réel reste la source de vérité. */
export default function PropertiesEmptyShowcase({ screen, onImport }: {
  screen: PropertyIntroduction;
  onImport: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const id = useId();
  const stage = useStageScene(STEPS.length, 5600);
  const { Demo, Icon, images } = PRESENTATIONS[screen];
  const prefix = `propertiesFirstUse.${screen}`;
  const tabKey = screen === 'connected-objects' ? 'connectedObjects' : screen;

  const steps: RailStep[] = STEPS.map((step) => ({
    key: `${screen}-${step}`,
    image: images[step],
    // Objets connectés : l'étape EST une pièce, dont le nom existe déjà.
    label: screen === 'connected-objects' ? t(`connectedRooms.rooms.${ROOM_STORIES[step].room}`) : t(`${prefix}.scenes.${step}`),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7">
      <NightStage
        headingId={`${id}-title`}
        icon={<Icon aria-hidden />}
        eyebrow={t(`propertiesPage.tabs.${tabKey}`)}
        title={t(`${prefix}.title`)}
        lede={t(`${prefix}.lede`)}
        actions={
          <>
            <Button size="lg" onClick={() => navigate('/properties/new')}>{t('propertiesFirstUse.add')}</Button>
            <Button size="lg" variant="outline" onClick={onImport}>{t('propertiesFirstUse.import')}</Button>
          </>
        }
        visual={
          <div role="group" aria-label={t(`${prefix}.preview`)}>
            <Demo scene={stage.scene} onSelect={stage.select} />
          </div>
        }
        onVisualFocus={stage.takeOver}
        rail={<StageRail steps={steps} scene={stage} label={t(`${prefix}.preview`)} />}
      />
      <StageFoot note={t('propertiesFirstUse.note')} />
    </div>
  );
}
