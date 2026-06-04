import { Box, Button, Typography } from '@mui/material';
import { Smartphone, RefreshCw } from 'lucide-react';
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

const ACCENT = '#6B8A9A';

export default function DevicePairingGuide({ onRefresh, refreshing }: DevicePairingGuideProps) {
  return (
    <Box
      sx={{
        mt: 1,
        p: 1.5,
        borderRadius: '10px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Smartphone size={16} color={ACCENT} />
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
          Appairez votre appareil dans l'app {BAITLY_APP.name}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1 }}>
        L'appairage d'un objet neuf se fait dans l'app mobile {BAITLY_APP.name} (au plus près de
        l'appareil). Il apparaîtra ensuite ici automatiquement, rattaché au compte de l'organisation.
      </Typography>

      <Box component="ol" sx={{ m: 0, pl: 2.25, mb: 1, '& li': { fontSize: '0.74rem', color: 'text.secondary', mb: 0.25 } }}>
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {BAITLY_APP.available ? (
          <>
            {BAITLY_APP.pairingDeepLink && (
              <Button
                size="small"
                variant="contained"
                component="a"
                href={BAITLY_APP.pairingDeepLink}
                startIcon={<Smartphone size={15} strokeWidth={2} />}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' }}
              >
                Ouvrir l'app {BAITLY_APP.name}
              </Button>
            )}
            {BAITLY_APP.iosStoreUrl && (
              <Button size="small" variant="text" component="a" href={BAITLY_APP.iosStoreUrl} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none', fontSize: '0.72rem', cursor: 'pointer' }}>
                App Store
              </Button>
            )}
            {BAITLY_APP.androidStoreUrl && (
              <Button size="small" variant="text" component="a" href={BAITLY_APP.androidStoreUrl} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none', fontSize: '0.72rem', cursor: 'pointer' }}>
                Play Store
              </Button>
            )}
          </>
        ) : (
          <Typography sx={{ fontSize: '0.72rem', color: '#B98900', fontWeight: 600 }}>
            App {BAITLY_APP.name} bientôt disponible — en attendant, contactez le support pour l'appairage.
          </Typography>
        )}

        {onRefresh && (
          <Button
            size="small"
            variant="outlined"
            onClick={onRefresh}
            disabled={refreshing}
            startIcon={<RefreshCw size={15} strokeWidth={2} />}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.74rem', ml: 'auto', cursor: 'pointer' }}
          >
            {refreshing ? 'Recherche…' : "J'ai appairé — rafraîchir"}
          </Button>
        )}
      </Box>
    </Box>
  );
}
