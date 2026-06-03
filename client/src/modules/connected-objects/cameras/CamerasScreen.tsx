import { useMemo } from 'react';
import { Box, Typography, Paper, Chip, alpha, useTheme } from '@mui/material';
import { PhotoCamera, Home } from '../../../icons';
import PageHeader from '../../../components/PageHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import CameraTile from './CameraTile';
import { MOCK_CAMERAS, type MockCamera } from './mockCameras';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.25 } as const;
const ACCENT = '#C97A7A';

/**
 * Écran d'APERÇU caméras (Phase 2, UI-first). Affiche des caméras simulées
 * groupées par logement avec le composant signature `CameraTile`. Sert à valider
 * l'UX avant de brancher la passerelle média + l'entité Camera backend.
 */
export default function CamerasScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  const groups = useMemo(() => {
    const map = new Map<string, MockCamera[]>();
    for (const c of MOCK_CAMERAS) {
      if (!map.has(c.propertyName)) map.set(c.propertyName, []);
      map.get(c.propertyName)!.push(c);
    }
    return [...map.entries()];
  }, []);

  return (
    <Box>
      <PageHeader
        title="Caméras"
        subtitle="Supervision vidéo des logements — aperçu de l'expérience à venir."
        iconBadge={<PhotoCamera />}
        backPath="/connected-objects"
        backLabel={t('navigation.connectedObjects', 'Objets connectés')}
      />

      {/* Bandeau aperçu : données simulées */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.25, mb: 1.5, borderRadius: 1.5, borderStyle: 'dashed',
          borderColor: alpha(ACCENT, 0.4),
          bgcolor: alpha(ACCENT, theme.palette.mode === 'dark' ? 0.08 : 0.04),
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
        }}
      >
        <Chip size="small" label="Aperçu" sx={{ height: 22, bgcolor: ACCENT, color: '#fff', fontWeight: 700, fontSize: '0.65rem' }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, minWidth: 220 }}>
          Données simulées — le streaming en direct, les instantanés et l'enregistrement arriveront en <strong>Phase&nbsp;2</strong> via une passerelle média (RTSP/ONVIF → WebRTC).
        </Typography>
      </Paper>

      {groups.map(([propertyName, cams]) => (
        <Box key={propertyName} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.875 }}>
            <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}>
              <Home size={15} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'text.primary' }}>{propertyName}</Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>· {cams.length} caméra{cams.length > 1 ? 's' : ''}</Typography>
          </Box>
          <Box sx={GRID}>
            {cams.map((c) => <CameraTile key={c.id} camera={c} />)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
