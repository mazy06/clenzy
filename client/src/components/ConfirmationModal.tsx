import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  CircularProgress,
} from '@mui/material';
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

  const getIcon = () => {
    if (icon) return icon;
    const wrap = (cssVar: string, child: React.ReactNode) => (
      <Box component="span" sx={{ display: 'inline-flex', color: cssVar }}>{child}</Box>
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      // Peau modale (r18, hairline, ombre profonde, animation) : thème global
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
      }}>
        <Box display="flex" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
          {getIcon()}
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </Box>
        </Box>
        {/* ✕ — pattern .rm-x : 34px r10 hairline, hover --err */}
        <IconButton
          onClick={onClose}
          aria-label="Fermer"
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            border: '1px solid var(--line-2)',
            backgroundColor: 'var(--card)',
            color: 'var(--muted)',
            flexShrink: 0,
            '&:hover': { color: 'var(--err)', borderColor: 'var(--err)', backgroundColor: 'var(--card)' },
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
          }}
        >
          <CloseIcon size={16} strokeWidth={1.75} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '22px !important' }}>
        {/* Alerte pleine largeur — pattern .rm-conflict : -soft + border color-mix 30% */}
        <Box
          sx={{
            backgroundColor: `var(--${severityToken}-soft)`,
            border: `1px solid color-mix(in srgb, var(--${severityToken}) 30%, transparent)`,
            borderRadius: '12px',
            padding: '13px 16px',
          }}
        >
          <Typography sx={{ fontSize: '13px', color: 'var(--body)' }}>
            {message}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
          variant="outlined"
          disabled={loading}
          sx={{ minWidth: 100 }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmColor ?? (severity === 'error' ? 'error' : 'primary')}
          disabled={loading}
          startIcon={
            loading
              ? <CircularProgress size={13} thickness={4} color="inherit" />
              : confirmIcon === null
                ? undefined
                : confirmIcon ?? <DeleteIcon size={13} strokeWidth={1.75} />
          }
          sx={{ minWidth: 100 }}
        >
          {loading ? 'Traitement...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;
