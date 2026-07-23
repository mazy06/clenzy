import * as React from 'react';
import { TriangleAlertIcon, InfoIcon, OctagonXIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  Button,
  Spinner,
} from '../ui';

/**
 * Baitly — remaster de components/ConfirmationModal.tsx (MUI), construit sur
 * AlertDialog (confirmation bloquante : pas de fermeture au clic dehors).
 */
export interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'error' | 'info';
  loading?: boolean;
  /** Icône du média. Par défaut : icône de la sévérité. */
  icon?: React.ReactNode;
}

const SEVERITY_ICON: Record<NonNullable<ConfirmationModalProps['severity']>, React.ReactNode> = {
  warning: <TriangleAlertIcon className="text-warning" />,
  error: <OctagonXIcon className="text-destructive" />,
  info: <InfoIcon className="text-info" />,
};

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  severity = 'warning',
  loading = false,
  icon,
}: ConfirmationModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !loading && onClose()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>{icon ?? SEVERITY_ICON[severity]}</AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" disabled={loading} onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={severity === 'error' ? 'destructive' : 'default'}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading && <Spinner />}
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
