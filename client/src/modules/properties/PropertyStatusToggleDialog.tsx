import React from 'react';
import {
  Button,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui';
import type { PropertyListItem } from '../../hooks/usePropertiesList';

interface PropertyStatusToggleDialogProps {
  /** Propriété ciblée (null = dialog fermé). */
  property: PropertyListItem | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation d'activation / désactivation d'une propriété depuis la liste.
 * Le sens (activer vs désactiver) découle du statut courant de la propriété.
 */
const PropertyStatusToggleDialog: React.FC<PropertyStatusToggleDialogProps> = ({
  property, pending = false, onClose, onConfirm,
}) => {
  const isActive = property?.status === 'active';

  return (
    <Dialog
      open={!!property}
      onOpenChange={(next) => { if (!next && !pending) onClose(); }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isActive ? 'Désactiver cette propriété ?' : 'Réactiver cette propriété ?'}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground">
          {property && <><strong>{property.name}</strong>{' '}</>}
          {isActive
            ? 'ne sera plus visible dans le planning, les recherches et le booking engine. Tu pourras la réactiver à tout moment.'
            : 'réapparaîtra dans le planning, les recherches et le booking engine.'}
        </p>
        <DialogFooter>
          {/* « Annuler » passe en ghost pour que l'action de droite reste la seule
              cadree, y compris quand la desactivation la teinte en avertissement. */}
          <Button onClick={onClose} size="sm" variant="ghost" disabled={pending}>
            Annuler
          </Button>
          {/* La desactivation est un geste a avertir : outline teinte avertissement
              (encre `-ink` pour le texte, teinte vive pour le filet — cf. contrat §2.4).
              La reactivation est benigne : encre pleine. */}
          <Button
            onClick={onConfirm}
            variant={isActive ? 'outline' : 'default'}
            size="sm"
            className={isActive ? 'text-warning-ink border-warning hover:bg-warning-soft' : undefined}
            disabled={pending}
          >
            {pending ? <Spinner className="size-3.5" /> : null}
            {isActive ? 'Désactiver' : 'Réactiver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyStatusToggleDialog;
