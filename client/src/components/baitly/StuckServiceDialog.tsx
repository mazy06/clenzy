import { useNavigate } from 'react-router-dom';
import { UserSearchIcon } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — une prestation que personne n'assurera.
 *
 * <p>Le produit cherche une équipe automatiquement, dix fois, toutes les quinze
 * minutes. Passé cela, il envoie une notification et s'arrête : la demande reste
 * en attente jusqu'à ce qu'un humain assigne quelqu'un. Sans cette carte, ce
 * silence ne se voyait nulle part sur le tableau de bord.</p>
 *
 * <p>Assigner demande de choisir parmi les équipes et les intervenants
 * disponibles, ce que l'écran des interventions sait déjà faire. La modale
 * nomme le problème et y conduit, plutôt que d'y reconstruire un sélecteur qui
 * divergerait.</p>
 */

export interface StuckServiceDialogProps {
  /** Prestation à ouvrir. `null` ferme la modale. */
  serviceRequestId: number | null;
  onClose: () => void;
  service?: {
    title?: string | null;
    propertyName?: string | null;
    /** `critical` quand la date souhaitée est déjà passée. */
    severity?: string | null;
  };
}

export default function StuckServiceDialog({
  serviceRequestId,
  onClose,
  service,
}: StuckServiceDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const overdue = service?.severity === 'critical';

  return (
    <Dialog open={serviceRequestId != null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-8">
            {service?.title ?? t('dashboard.stuckService.fallback', 'Prestation en attente')}
          </DialogTitle>
          {service?.propertyName && <DialogDescription>{service.propertyName}</DialogDescription>}
        </DialogHeader>

        <p className="m-0 text-sm text-muted-foreground">
          {overdue
            ? t(
                'dashboard.stuckService.overdue',
                'La date souhaitée est passée et aucun prestataire n’a été trouvé. La prestation n’a pas eu lieu.',
              )
            : t(
                'dashboard.stuckService.searchExhausted',
                'Aucun prestataire disponible n’a été trouvé. La recherche automatique s’est arrêtée : il faut assigner quelqu’un.',
              )}
        </p>

        <DialogFooter className="sm:justify-end">
          <Button
            onClick={() => {
              onClose();
              navigate(`/interventions?tab=service-requests&highlight=${serviceRequestId}`);
            }}
          >
            <UserSearchIcon />
            {t('dashboard.stuckService.assign', 'Assigner un prestataire')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
