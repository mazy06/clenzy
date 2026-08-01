import React from 'react';
import { Button, Spinner } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
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
      onClose={pending ? undefined : onClose}
    >
      <DialogTitle>
        {isActive ? 'Désactiver cette propriété ?' : 'Réactiver cette propriété ?'}
      </DialogTitle>
      <DialogContent>
        <p className="cn-text-body1 text-[13px] text-[var(--body)]">
          {property && <><strong>{property.name}</strong>{' '}</>}
          {isActive
            ? 'ne sera plus visible dans le planning, les recherches et le booking engine. Tu pourras la réactiver à tout moment.'
            : 'réapparaîtra dans le planning, les recherches et le booking engine.'}
        </p>
      </DialogContent>
      <DialogActions>
        {/* « Annuler » passe en ghost pour que l'action de droite reste la seule
            cadree, y compris quand la desactivation la teinte en --warn. */}
        <Button onClick={onClose} size="sm" variant="ghost" disabled={pending}>
          Annuler
        </Button>
        {/* La desactivation est un geste a avertir : outline teinte --warn.
            La reactivation est benigne : encre pleine. */}
        <Button
          onClick={onConfirm}
          variant={isActive ? 'outline' : 'default'}
          size="sm"
          className={isActive ? 'text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]' : undefined}
          disabled={pending}
        >
          {pending ? <Spinner className="size-3.5" /> : null}
          {isActive ? 'Désactiver' : 'Réactiver'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PropertyStatusToggleDialog;
