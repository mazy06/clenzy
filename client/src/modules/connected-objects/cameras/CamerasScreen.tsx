import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Skeleton } from '../../../components/ui';
import { PhotoCamera, Add, Home, Info } from '../../../icons';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { useTranslation } from '../../../hooks/useTranslation';
import { camerasApi, type CameraDto } from '../../../services/api/camerasApi';
import AddDeviceWizard from '../components/AddDeviceWizard';
import CameraTile from './CameraTile';
import ConfirmationModal from '../../../components/ConfirmationModal';

// gap: 1.25 avec theme.spacing = 6 => 7,5 px (hors echelle Tailwind).
const GRID_CLS = 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[7.5px]';

/**
 * Écran de gestion des caméras — CRUD branché sur le backend. La lecture vidéo
 * en direct arrivera avec la passerelle media go2rtc (bandeau d'info).
 */
export default function CamerasScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  // Suppression : caméra en attente de confirmation (modal réutilisable) + état en cours.
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Single active player : une seule caméra lit à la fois (perf + scalabilité multi-tenant —
  // chaque lecture = une connexion WebRTC + une source go2rtc maintenue active côté serveur).
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => camerasApi.getAll(),
    refetchInterval: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cameras'] });

  const toggleActive = useCallback((id: number) => {
    setActiveId((prev) => (prev === id ? null : id));
  }, []);

  const requestDelete = useCallback((id: number) => setPendingDeleteId(id), []);

  const pendingCamera = useMemo(
    () => cameras.find((c) => c.id === pendingDeleteId) ?? null,
    [cameras, pendingDeleteId],
  );

  const confirmDelete = useCallback(async () => {
    if (pendingDeleteId == null) return;
    setActiveId((prev) => (prev === pendingDeleteId ? null : prev)); // libère le flux si la cam active est supprimée
    setDeleting(true);
    try {
      await camerasApi.delete(pendingDeleteId);
      await qc.invalidateQueries({ queryKey: ['cameras'] });
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId, qc]);

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
    <Button size="sm" onClick={() => setWizardOpen(true)}>
      <Add size={16} strokeWidth={2} />
      Ajouter une caméra
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={t('connectedObjects.cameras.title', 'Caméras')}
        subtitle={t('connectedObjects.cameras.subtitle', 'Supervision vidéo des logements.')}
        iconBadge={<PhotoCamera />}
        backPath="/connected-objects"
        backLabel={t('navigation.connectedObjects', 'Objets connectés')}
        actions={addButton}
      />

      {/* Bandeau d'aide : lecture à la demande. Encart bricolé remplacé par la
          primitive Alert (ton `info` — c'est une consigne d'usage, pas une
          alerte), qui porte déjà le couple `-soft` / `-ink` conforme AA. */}
      <Alert variant="info" className="mb-[9px]">
        <Info size={16} strokeWidth={1.75} />
        <AlertDescription className="text-xs">
          Cliquez sur une caméra pour lancer la <strong>lecture en direct</strong>. Une seule lecture à la fois
          (performances) : ouvrir une autre caméra arrête la précédente. <strong>RTSP recommandé</strong> pour une lecture fluide.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className={GRID_CLS}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[200px] w-full rounded-xl" />)}
        </div>
      ) : cameras.length === 0 ? (
        <EmptyState
          icon={<PhotoCamera />}
          title="Aucune caméra pour l'instant"
          description="Ajoutez une caméra via son flux RTSP (caméra IP) ou une URL HTTP/HLS pour superviser vos logements en direct."
          action={addButton}
        />
      ) : (
        groups.map(([propertyName, items]) => (
          <div className="mb-3" key={propertyName}>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-muted-foreground inline-flex"><Home size={15} strokeWidth={1.75} /></span>
              <p className="text-sm font-semibold tracking-tight text-foreground">{propertyName}</p>
              <span className="text-xs text-muted-foreground opacity-60 tabular-nums">· {items.length} caméra{items.length > 1 ? 's' : ''}</span>
            </div>
            <div className={GRID_CLS}>
              {items.map((c) => (
                <CameraTile
                  key={c.id}
                  camera={c}
                  active={activeId === c.id}
                  onToggle={toggleActive}
                  onDelete={requestDelete}
                  acting={deleting && pendingDeleteId === c.id}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <AddDeviceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onAdded={invalidate} defaultKind="camera" />

      <ConfirmationModal
        open={pendingDeleteId != null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        title="Supprimer la caméra"
        message={pendingCamera
          ? `Supprimer définitivement la caméra « ${pendingCamera.name} » ? Cette action est irréversible.`
          : 'Supprimer définitivement cette caméra ? Cette action est irréversible.'}
        confirmText="Supprimer"
        severity="error"
        loading={deleting}
      />
    </div>
  );
}
