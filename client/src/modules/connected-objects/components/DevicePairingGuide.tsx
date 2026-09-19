import { Button, Card } from '../../../components/ui';
import { Smartphone, Refresh } from '../../../icons';
import { BAITLY_APP } from '../baitlyApp';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Guidage d'appairage (modèle C) : oriente l'hôte depuis le PMS vers l'app mobile de marque
 * {@link BAITLY_APP} où il appaire physiquement son objet, puis revient rafraîchir la découverte.
 * Affiché quand le compte plateforme est relié mais qu'aucun appareil n'est encore découvert.
 *
 * Tant que l'OEM App n'est pas publiée (`BAITLY_APP.available === false`), on affiche « bientôt
 * disponible » au lieu d'un deep-link mort.
 */

interface DevicePairingGuideProps {
  /** Relance la découverte après que l'hôte a appairé dans l'app. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

const STEP_KEYS = [
  'connectedObjects.pairing.step1',
  'connectedObjects.pairing.step2',
  'connectedObjects.pairing.step3',
];

export default function DevicePairingGuide({ onRefresh, refreshing }: DevicePairingGuideProps) {
  const { t } = useTranslation();
  return (
    // Le panneau du kit plutot qu'un <div> borde a la main : meme surface que les
    // cartes du hub (fond de carte, filet, rayon), sans le redefinir ici.
    <Card className="mt-1.5 gap-0 py-0 p-2">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-primary inline-flex">
          <Smartphone size={16} />
        </span>
        <p className="text-[0.82rem] font-semibold">
          {t('connectedObjects.pairing.title', { app: BAITLY_APP.name })}
        </p>
      </div>
      <p className="text-[0.72rem] text-muted-foreground mb-1.5">
        {t('connectedObjects.pairing.body', { app: BAITLY_APP.name })}
      </p>

      <ol className="m-0 mb-1.5 ps-[13.5px] [&_li]:mb-[1.5px] [&_li]:text-[0.74rem] [&_li]:text-muted-foreground">
        {STEP_KEYS.map((key) => (
          <li key={key}>{t(key, { app: BAITLY_APP.name })}</li>
        ))}
      </ol>

      <div className="flex items-center gap-1.5 flex-wrap">
        {BAITLY_APP.available ? (
          <>
            {BAITLY_APP.pairingDeepLink && (
              <Button size="sm" asChild>
                <a href={BAITLY_APP.pairingDeepLink}>
                  <Smartphone size={15} strokeWidth={2} />
                  {t('connectedObjects.pairing.openApp', { app: BAITLY_APP.name })}
                </a>
              </Button>
            )}
            {BAITLY_APP.iosStoreUrl && (
              <Button size="sm" variant="ghost" asChild>
                <a href={BAITLY_APP.iosStoreUrl} target="_blank" rel="noopener noreferrer">
                  App Store
                </a>
              </Button>
            )}
            {BAITLY_APP.androidStoreUrl && (
              <Button size="sm" variant="ghost" asChild>
                <a href={BAITLY_APP.androidStoreUrl} target="_blank" rel="noopener noreferrer">
                  Play Store
                </a>
              </Button>
            )}
          </>
        ) : (
          <p className="text-[0.72rem] text-warning-ink font-semibold">
            App {BAITLY_APP.name} bientôt disponible — en attendant, contactez le support pour l'appairage.
          </p>
        )}

        {onRefresh && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing}
            className="ms-auto"
          >
            <Refresh size={15} strokeWidth={2} />
            {refreshing ? 'Recherche…' : "J'ai appairé — rafraîchir"}
          </Button>
        )}
      </div>
    </Card>
  );
}
