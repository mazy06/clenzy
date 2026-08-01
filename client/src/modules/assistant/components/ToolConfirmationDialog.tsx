import React, { useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Button } from '../../../components/ui';
import { Warning as AlertIcon } from '../../../icons';
import type { PendingToolConfirmation } from '../../../hooks/useAgent';

interface ToolConfirmationDialogProps {
  pending: PendingToolConfirmation | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialog modal qui s'affiche quand l'assistant veut executer un tool d'ecriture.
 *
 * <p>Skin porte par le theme global Signature (MuiDialog r18, Title display,
 * Actions surface-2). Recap les arguments JSON proposes par le LLM en table
 * cle/valeur pour que l'utilisateur valide explicitement avant execution.
 * Pas de "auto-confirm" : les operations d'ecriture passent par confirmation
 * utilisateur, garantie cote backend ET cote UI.</p>
 */
export const ToolConfirmationDialog: React.FC<ToolConfirmationDialogProps> = ({
  pending,
  onConfirm,
  onCancel,
}) => {
  const parsedArgs = useMemo(() => {
    if (!pending) return null;
    try {
      return JSON.parse(pending.toolArgs) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [pending]);

  if (!pending) return null;

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <div className="w-[32px] h-[32px] rounded-[9px] flex items-center justify-center bg-[var(--warn-soft)] text-[var(--warn)] shrink-0">
          <AlertIcon size={16} strokeWidth={2} />
        </div>
        <div>
          <span className="block leading-[1.2]">
            Confirmer l&apos;action
          </span>
          <span className="text-[var(--muted)] font-mono text-[11px] font-medium">
            {pending.toolName}
          </span>
        </div>
      </DialogTitle>

      <DialogContent>
        <p className="cn-text-body1 mb-3 text-[13px] leading-[1.55] text-[var(--muted)]">
          {pending.toolDescription}
        </p>

        {parsedArgs && Object.keys(parsedArgs).length > 0 && (
          <div className="rounded-[10px] overflow-hidden border border-[var(--line)] bg-[var(--field)]">
            {Object.entries(parsedArgs).map(([key, value], index) => (
              <div className="flex gap-[9px] px-[9px] py-1.5" style={{ borderTop: index > 0 ? '1px solid var(--line)' : 'none' }} key={key}>
                <span className="min-w-[100px] font-mono text-[var(--muted)] text-[11.5px] leading-[1.6]">
                  {key}
                </span>
                <span className="text-[12.5px] font-medium text-[var(--body)] break-words flex-1">
                  {formatArgValue(value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!parsedArgs && (
          <p className="cn-text-body1 text-[11.5px] text-[var(--muted)]">
            Pas d&apos;argument structure (le LLM execute sans parametre).
          </p>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="ghost" onClick={onCancel}>
          Refuser
        </Button>
        <Button variant="default" onClick={onConfirm}>
          Executer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function formatArgValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
