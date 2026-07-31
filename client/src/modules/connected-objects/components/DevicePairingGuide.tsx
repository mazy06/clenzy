import { Box, Button } from '@mui/material';
import { Smartphone, Refresh } from '../../../icons';
import { BAITLY_APP } from '../baitlyApp';

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

const STEPS = [
  `Ouvrez l'app ${BAITLY_APP.name} sur votre téléphone`,
  'Appairez votre appareil (caméra, serrure, capteur…) à proximité',
  'Revenez ici et rafraîchissez la liste',
];

const ACCENT = 'var(--accent)';

export default function DevicePairingGuide({ onRefresh, refreshing }: DevicePairingGuideProps) {
  return (
    <div className="mt-1.5 p-2 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--card)]">
      <div className="flex items-center gap-1 mb-0.5">
        <Smartphone size={16} color={ACCENT} />
        <p className="cn-text-body1 text-[0.82rem] font-semibold">
          Appairez votre appareil dans l'app {BAITLY_APP.name}
        </p>
      </div>
      <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mb-1.5">
        L'appairage d'un objet neuf se fait dans l'app mobile {BAITLY_APP.name} (au plus près de
        l'appareil). Il apparaîtra ensuite ici automatiquement, rattaché au compte de l'organisation.
      </p>

      <Box component="ol" sx={{ m: 0, pl: 2.25, mb: 1, '& li': { fontSize: '0.74rem', color: 'text.secondary', mb: 0.25 } }}>
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </Box>

      <div className="flex items-center gap-1.5 flex-wrap">
        {BAITLY_APP.available ? (
          <>
            {BAITLY_APP.pairingDeepLink && (
              <Button
                size="small"
                variant="contained"
                component="a"
                href={BAITLY_APP.pairingDeepLink}
                startIcon={<Smartphone size={15} strokeWidth={2} />}
              >
                Ouvrir l'app {BAITLY_APP.name}
              </Button>
            )}
            {BAITLY_APP.iosStoreUrl && (
              <Button size="small" variant="text" component="a" href={BAITLY_APP.iosStoreUrl} target="_blank" rel="noopener noreferrer">
                App Store
              </Button>
            )}
            {BAITLY_APP.androidStoreUrl && (
              <Button size="small" variant="text" component="a" href={BAITLY_APP.androidStoreUrl} target="_blank" rel="noopener noreferrer">
                Play Store
              </Button>
            )}
          </>
        ) : (
          <p className="cn-text-body1 text-[0.72rem] text-[var(--warn)] font-semibold">
            App {BAITLY_APP.name} bientôt disponible — en attendant, contactez le support pour l'appairage.
          </p>
        )}

        {onRefresh && (
          <Button
            size="small"
            variant="outlined"
            onClick={onRefresh}
            disabled={refreshing}
            startIcon={<Refresh size={15} strokeWidth={2} />}
            sx={{ ml: 'auto' }}
          >
            {refreshing ? 'Recherche…' : "J'ai appairé — rafraîchir"}
          </Button>
        )}
      </div>
    </div>
  );
}
