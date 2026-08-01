import { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Spinner } from '../../../components/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconButton, Button, Tooltip, Divider, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert } from '@mui/material';
import { VpnKey, ContentCopy, Visibility, VisibilityOff, Refresh } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useLockAccessCode } from '../useLockAccessCode';
import { smartLockApi, type SmartLockAccessCodeMode } from '../../../services/api/smartLockApi';

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
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: code, isLoading } = useLockAccessCode(deviceId, true);
  const [revealed, setRevealed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [savingMode, setSavingMode] = useState(false);

  // Origine du code (PMS pousse / serrure génère) — lue depuis la liste des serrures.
  const { data: lockDevices } = useQuery({ queryKey: ['smart-lock-devices'], queryFn: () => smartLockApi.getAll() });
  const lockDevice = lockDevices?.find((d) => d.id === deviceId);

  const hasCode = !!code?.code;

  const handleModeChange = async (mode: SmartLockAccessCodeMode) => {
    setSavingMode(true);
    try {
      await smartLockApi.updateAccessCodeMode(deviceId, mode);
      await qc.invalidateQueries({ queryKey: ['smart-lock-devices'] });
      setSnack({ msg: t('connectedObjects.codeMode.saved', 'Origine du code mise à jour (appliquée à la prochaine réservation)'), severity: 'success' });
    } catch {
      setSnack({ msg: t('connectedObjects.codeMode.error', 'Échec du changement de mode'), severity: 'error' });
    } finally {
      setSavingMode(false);
    }
  };

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
      <div className="flex items-center gap-0.5 min-w-0">
        <Tooltip title="Code d'accès" arrow>
          <span className="text-muted-foreground opacity-60 inline-flex shrink-0">
            <VpnKey size={14} strokeWidth={1.75} />
          </span>
        </Tooltip>

        {isLoading ? (
          <span className="cn-text-caption text-muted-foreground opacity-60">Code d'accès…</span>
        ) : hasCode ? (
          <>
            {/* Code PIN : display (Space Grotesk) tabular-nums sur fond --field */}
            <p className={cn('cn-text-body1 tabular-nums font-semibold text-[0.875rem] text-[var(--ink)] bg-[var(--field)] rounded-[9px] px-1.5 py-[1.5px] leading-[1.4]', revealed ? 'tracking-[0.06em]' : 'tracking-[0.18em]')} style={{ fontFamily: 'var(--font-display)' }}>
              {revealed ? code!.code : '••••••'}
            </p>
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
                {rotating ? <Spinner className="size-3.5" /> : <Refresh size={14} strokeWidth={1.75} />}
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <span className="cn-text-caption text-muted-foreground">Aucun code actif</span>
            <Button
              size="small"
              variant="text"
              startIcon={rotating ? <Spinner className="size-[13px]" /> : <Refresh size={14} strokeWidth={1.75} />}
              onClick={() => setConfirmOpen(true)}
              disabled={rotating}
              sx={{ ml: 'auto' }}
            >
              Générer
            </Button>
          </>
        )}
      </div>

      {hasCode && code!.validUntil && (
        <span className="cn-text-caption text-muted-foreground opacity-60 ps-3.5 block leading-[1.2]">
          Valide jusqu'au {formatUntil(code!.validUntil)}
        </span>
      )}

      {lockDevice ? (
        <TextField
          select
          fullWidth
          size="small"
          label={t('connectedObjects.codeMode.label', "Origine du code d'accès")}
          value={lockDevice.accessCodeMode || 'PMS_GENERATED'}
          onChange={(e) => { void handleModeChange(e.target.value as SmartLockAccessCodeMode); }}
          disabled={savingMode}
          helperText={t('connectedObjects.codeMode.applied', 'Appliqué aux prochains codes générés (réservations à venir).')}
          sx={{ mt: 1 }}
        >
          <MenuItem value="PMS_GENERATED">{t('connectedObjects.codeMode.pms', 'Le PMS génère et pousse le code')}</MenuItem>
          <MenuItem value="LOCK_GENERATED">{t('connectedObjects.codeMode.lock', 'La serrure génère le code')}</MenuItem>
        </TextField>
      ) : null}

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
            startIcon={rotating ? <Spinner className="size-3.5" /> : undefined}
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
