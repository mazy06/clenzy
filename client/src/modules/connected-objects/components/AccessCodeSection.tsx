import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, IconButton, Button, Tooltip, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert,
} from '@mui/material';
import { VpnKey, ContentCopy, Visibility, VisibilityOff, Refresh } from '../../../icons';
import { useLockAccessCode } from '../useLockAccessCode';
import { smartLockApi } from '../../../services/api/smartLockApi';

interface AccessCodeSectionProps {
  deviceId: number;
}

function formatUntil(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Section « Code d'accès » d'une carte serrure : affiche le code courant (masqué
 * par défaut), copie, validité, et régénération (avec confirmation → déclenche un
 * event côté backend). Rendu inline dans la carte (pas de carte-dans-carte) ;
 * icônes lucide, code en tabular-nums.
 */
export default function AccessCodeSection({ deviceId }: AccessCodeSectionProps) {
  const qc = useQueryClient();
  const { data: code, isLoading } = useLockAccessCode(deviceId, true);
  const [revealed, setRevealed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const hasCode = !!code?.code;

  const handleCopy = async () => {
    if (!code?.code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setSnack({ msg: 'Code copié', severity: 'success' });
    } catch {
      setSnack({ msg: 'Copie impossible', severity: 'error' });
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      await smartLockApi.rotateAccessCode(deviceId);
      await qc.invalidateQueries({ queryKey: ['lock-access-code', deviceId] });
      setConfirmOpen(false);
      setSnack({ msg: 'Nouveau code généré', severity: 'success' });
    } catch (e) {
      setSnack({ msg: e instanceof Error ? e.message : 'Échec de la génération', severity: 'error' });
    } finally {
      setRotating(false);
    }
  };

  return (
    <>
      <Divider sx={{ mt: 0.25 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Tooltip title="Code d'accès" arrow>
          <Box component="span" sx={{ color: 'text.disabled', display: 'inline-flex', flexShrink: 0 }}>
            <VpnKey size={14} strokeWidth={1.75} />
          </Box>
        </Tooltip>

        {isLoading ? (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>Code d'accès…</Typography>
        ) : hasCode ? (
          <>
            <Typography
              sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '0.875rem', letterSpacing: revealed ? '0.06em' : '0.18em', color: 'text.primary' }}
            >
              {revealed ? code!.code : '••••••'}
            </Typography>
            <Tooltip title={revealed ? 'Masquer' : 'Afficher'} arrow>
              <IconButton size="small" onClick={() => setRevealed((v) => !v)} sx={{ cursor: 'pointer', p: 0.25 }}>
                {revealed ? <VisibilityOff size={14} strokeWidth={1.75} /> : <Visibility size={14} strokeWidth={1.75} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Copier" arrow>
              <IconButton size="small" onClick={handleCopy} sx={{ cursor: 'pointer', p: 0.25 }}>
                <ContentCopy size={14} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Régénérer le code" arrow>
              <IconButton size="small" onClick={() => setConfirmOpen(true)} disabled={rotating} sx={{ cursor: 'pointer', p: 0.25, ml: 'auto', color: 'text.secondary' }}>
                {rotating ? <CircularProgress size={14} /> : <Refresh size={14} strokeWidth={1.75} />}
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Aucun code actif</Typography>
            <Button
              size="small"
              variant="text"
              startIcon={rotating ? <CircularProgress size={13} /> : <Refresh size={14} strokeWidth={1.75} />}
              onClick={() => setConfirmOpen(true)}
              disabled={rotating}
              sx={{ ml: 'auto', textTransform: 'none' }}
            >
              Générer
            </Button>
          </>
        )}
      </Box>

      {hasCode && code!.validUntil && (
        <Typography variant="caption" sx={{ color: 'text.disabled', pl: 2.5, display: 'block', lineHeight: 1.2 }}>
          Valide jusqu'au {formatUntil(code!.validUntil)}
        </Typography>
      )}

      <Dialog open={confirmOpen} onClose={() => { if (!rotating) setConfirmOpen(false); }} maxWidth="xs" fullWidth>
        <DialogTitle>{hasCode ? 'Régénérer le code ?' : 'Générer un code ?'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {hasCode
              ? "L'ancien code sera révoqué sur la serrure et un nouveau code prendra effet. Un évènement est enregistré."
              : 'Un nouveau code d\'accès sera programmé sur la serrure. Un évènement est enregistré.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={rotating}>Annuler</Button>
          <Button
            onClick={() => { void handleRotate(); }}
            variant="contained"
            disabled={rotating}
            startIcon={rotating ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {hasCode ? 'Régénérer' : 'Générer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)} sx={{ width: '100%' }}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
