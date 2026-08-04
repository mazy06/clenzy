import React, { useMemo } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui';
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
    <Dialog open onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-w-[600px]">
      <DialogHeader>
        <div className="flex items-center gap-1.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-ink">
            <AlertIcon size={16} strokeWidth={2} />
          </span>
          <div>
            <DialogTitle className="block leading-tight">
              Confirmer l&apos;action
            </DialogTitle>
            <DialogDescription className="font-mono text-2xs font-medium text-muted-foreground">
              {pending.toolName}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div>
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          {pending.toolDescription}
        </p>

        {parsedArgs && Object.keys(parsedArgs).length > 0 && (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-muted">
            {Object.entries(parsedArgs).map(([key, value]) => (
              <div className="flex gap-2 px-2 py-1.5" key={key}>
                <span className="min-w-[100px] font-mono text-xs text-muted-foreground">
                  {key}
                </span>
                <span className="flex-1 break-words text-xs font-medium text-foreground">
                  {formatArgValue(value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!parsedArgs && (
          <p className="text-xs text-muted-foreground">
            Pas d&apos;argument structure (le LLM execute sans parametre).
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Refuser
        </Button>
        <Button variant="default" onClick={onConfirm}>
          Executer
        </Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function formatArgValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
