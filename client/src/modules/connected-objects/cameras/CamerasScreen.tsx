import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Button, Paper, alpha, useTheme, Skeleton } from '@mui/material';
import { PhotoCamera, Add, Home } from '../../../icons';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { useTranslation } from '../../../hooks/useTranslation';
import { camerasApi, type CameraDto } from '../../../services/api/camerasApi';
import AddDeviceWizard from '../components/AddDeviceWizard';
import CameraTile from './CameraTile';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.25 } as const;
const ACCENT = '#C97A7A';

/**
 * Écran de gestion des caméras — CRUD branché sur le backend. La lecture vidéo
 * en direct arrivera avec la passerelle media go2rtc (bandeau d'info).
 */
export default function CamerasScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => camerasApi.getAll(),
    refetchInterval: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cameras'] });

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer cette caméra ?')) return;
    setActingId(id);
    try { await camerasApi.delete(id); await invalidate(); } finally { setActingId(null); }
  };

  const groups = useMemo(() => {
    const map = new Map<string, CameraDto[]>();
    for (const c of cameras) {
      const key = c.propertyName || 'Sans logement';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()];
  }, [cameras]);

  const addButton = (
    <Button variant="contained" size="small" startIcon={<Add size={16} strokeWidth={2} />} onClick={() => setWizardOpen(true)}>
      Ajouter une caméra
    </Button>
  );

  return (
    <Box>
      <PageHeader
        title={t('connectedObjects.cameras.title', 'Caméras')}
        subtitle={t('connectedObjects.cameras.subtitle', 'Supervision vidéo des logements.')}
        iconBadge={<PhotoCamera />}
        backPath="/connected-objects"
        backLabel={t('navigation.connectedObjects', 'Objets connectés')}
        actions={addButton}
      />

      {/* Bandeau : streaming live via go2rtc à venir */}
      <Paper
        variant="outlined"
        sx={{ p: 1.25, mb: 1.5, borderRadius: 1.5, borderStyle: 'dashed', borderColor: alpha(ACCENT, 0.4),
          bgcolor: alpha(ACCENT, theme.palette.mode === 'dark' ? 0.08 : 0.04), display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, minWidth: 220 }}>
          Gestion des caméras disponible. La <strong>lecture vidéo en direct</strong> sera activée une fois la passerelle média (go2rtc) déployée.
        </Typography>
      </Paper>

      {isLoading ? (
        <Box sx={GRID}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 1.5 }} />)}
        </Box>
      ) : cameras.length === 0 ? (
        <EmptyState
          icon={<PhotoCamera />}
          title="Aucune caméra pour l'instant"
          description="Ajoutez une caméra IP (flux RTSP) pour superviser vos logements. La lecture en direct sera activée avec la passerelle média."
          action={addButton}
        />
      ) : (
        groups.map(([propertyName, items]) => (
          <Box key={propertyName} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.875 }}>
              <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><Home size={15} strokeWidth={1.75} /></Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'text.primary' }}>{propertyName}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>· {items.length} caméra{items.length > 1 ? 's' : ''}</Typography>
            </Box>
            <Box sx={GRID}>
              {items.map((c) => <CameraTile key={c.id} camera={c} onDelete={handleDelete} acting={actingId === c.id} />)}
            </Box>
          </Box>
        ))
      )}

      <AddDeviceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onAdded={invalidate} defaultKind="camera" />
    </Box>
  );
}
