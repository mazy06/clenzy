import React from 'react';
import {
  Button,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from './ui';
import {
  Warning as WarningIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '../icons';

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'error' | 'info';
  loading?: boolean;
  /** Icone affichee en titre. Par defaut : icone de la severite. */
  icon?: React.ReactNode;
  /**
   * Icone affichee dans le bouton Confirmer. Par defaut : icone Delete
   * (heritage des cas d'usage suppression). Passer null pour ne pas
   * afficher d'icone. Idee : passer un Upload, Save, etc. selon l'action.
   */
  confirmIcon?: React.ReactNode | null;
  /** Couleur du bouton Confirmer. Par defaut : 'error' si severity=error, sinon 'primary'. */
  confirmColor?: 'primary' | 'error' | 'warning' | 'success' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
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
  confirmIcon,
  confirmColor,
}) => {
  // Token sémantique de la sévérité (désaturé — baseline §1)
  const severityToken = severity === 'error' ? 'err' : severity === 'info' ? 'info' : 'warn';

  // Le kit n'a pas de variante par teinte : `error` prend `destructive`, `primary` reste
  // l'action principale (`default`), et les severites restantes se posent en classes sur
  // `outline`. Branches litterales : une classe Tailwind ne peut pas naitre d'une variable.
  const confirmTone = confirmColor ?? (severity === 'error' ? 'error' : 'primary');
  const confirmVariant =
    confirmTone === 'error' ? 'destructive' : confirmTone === 'primary' ? 'default' : 'outline';
  const confirmToneClass =
    confirmTone === 'warning'
      ? 'text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]'
      : confirmTone === 'success'
        ? 'text-[var(--ok)] border-[var(--ok)] hover:bg-[var(--ok-soft)]'
        : confirmTone === 'info'
          ? 'text-[var(--info)] border-[var(--info)] hover:bg-[var(--info-soft)]'
          : '';

  const getIcon = () => {
    if (icon) return icon;
    const wrap = (cssVar: string, child: React.ReactNode) => (
      <span className="inline-flex" style={{ color: cssVar }}>{child}</span>
    );
    switch (severity) {
      case 'error':
        return wrap('var(--err)', <DeleteIcon size={18} strokeWidth={1.75} />);
      case 'info':
        return wrap('var(--info)', <WarningIcon size={18} strokeWidth={1.75} />);
      default:
        return wrap('var(--warn)', <WarningIcon size={18} strokeWidth={1.75} />);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* Peau modale (r18, hairline, ombre profonde, animation) : primitif du kit.
          `sm` MUI = 600px, hors echelle Tailwind → largeur litterale. */}
      <DialogContent className="sm:max-w-[600px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between gap-[9px]">
          <DialogTitle className="flex items-center gap-[7.5px] min-w-0">
            {getIcon()}
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
              {title}
            </span>
          </DialogTitle>
          {/* ✕ — pattern .rm-x : 34px r10 hairline, hover --err */}
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Fermer"
              className="inline-flex items-center justify-center size-[34px] shrink-0 rounded-[10px] border border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)] cursor-pointer transition-colors duration-200 hover:text-[var(--err)] hover:border-[var(--err)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <CloseIcon size={16} strokeWidth={1.75} />
            </button>
          </DialogClose>
        </DialogHeader>

        {/* Alerte pleine largeur — pattern .rm-conflict : -soft + border color-mix 30% */}
        {/* Tokens derives de `severityToken` a l'execution : ils restent en style inline,
            une classe Tailwind ne peut pas naitre d'une variable. */}
        <div
          className="rounded-[12px] border border-solid px-4 py-[13px]"
          style={{
            backgroundColor: `var(--${severityToken}-soft)`,
            borderColor: `color-mix(in srgb, var(--${severityToken}) 30%, transparent)`,
          }}
        >
          <p className="cn-text-body1 text-[13px] text-[var(--body)]">
            {message}
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={loading}
            className="min-w-[100px]"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            variant={confirmVariant}
            disabled={loading}
            className={`min-w-[100px] ${confirmToneClass}`}
          >
            {loading
              ? <Spinner className="size-[13px]" />
              : confirmIcon === null
                ? null
                : confirmIcon ?? <DeleteIcon size={13} strokeWidth={1.75} />}
            {loading ? 'Traitement...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationModal;
