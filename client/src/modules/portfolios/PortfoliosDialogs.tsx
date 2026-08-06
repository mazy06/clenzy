import React, { useState } from 'react';
import { Button, Spinner, Field, FieldLabel, Textarea } from '../../components/ui';
import {
  Avatar,
  AvatarFallback,
  Dialog,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui';
import {
  SwapHoriz as SwapHorizIcon,
  Close as CloseIcon,
  Person,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { PortfolioClient, Manager } from './usePortfoliosPage';

// ─── ReassignmentDialog ──────────────────────────────────────────────────────

interface ReassignmentDialogProps {
  open: boolean;
  onClose: () => void;
  client: PortfolioClient | null;
  onReassign: (clientId: number, newManagerId: number, notes: string) => void;
  managers: Manager[];
  loading: boolean;
}

export const ReassignmentDialog: React.FC<ReassignmentDialogProps> = ({
  open,
  onClose,
  client,
  onReassign,
  managers,
  loading,
}) => {
  const { t } = useTranslation();
  const [selectedManagerId, setSelectedManagerId] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (selectedManagerId && client) {
      onReassign(client.id, selectedManagerId, notes);
    }
  };

  const handleClose = () => {
    setSelectedManagerId(0);
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl" showCloseButton={false}>
        <DialogHeader className="border-b border-solid border-border pb-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-primary">
                <SwapHorizIcon size={22} strokeWidth={1.75} />
              </span>
              <DialogTitle className="text-[1rem] font-semibold">
                {t('portfolios.fields.reassignClient')}
              </DialogTitle>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={t('common.close', 'Fermer')} onClick={handleClose}>
              <CloseIcon size={16} strokeWidth={2} />
            </Button>
          </div>
        </DialogHeader>

        <div className="pt-3 pb-2">
          {client && (
            <Item variant="muted" size="sm" className="mb-3.5">
              <ItemMedia>
                <Avatar className="size-8 rounded-[10px]">
                  <AvatarFallback className="rounded-[10px] bg-primary text-primary-foreground font-[family-name:var(--font-display)] font-semibold text-[0.78rem]">
                    {client.firstName?.[0]}{client.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="text-[0.85rem] font-semibold">
                  {client.firstName} {client.lastName}
                </ItemTitle>
                <ItemDescription className="text-[0.72rem]">
                  {client.email}
                </ItemDescription>
              </ItemContent>
            </Item>
          )}

          {/* Liste riche (icone + nom + email) : le Select du kit, pas le select
              natif qui ne sait rendre que du texte. */}
          <Field className="mb-3">
            <FieldLabel htmlFor="reassign-manager">{t('portfolios.fields.newManager')}</FieldLabel>
            {/* Chaine vide et non `undefined` en valeur : `undefined` ferait
                basculer le Select en NON controle, et la remise a zero a la
                fermeture n'effacerait plus la selection affichee. */}
            <Select
              value={selectedManagerId ? String(selectedManagerId) : ''}
              onValueChange={(value) => setSelectedManagerId(Number(value))}
            >
              <SelectTrigger id="reassign-manager" className="w-full text-[0.85rem]">
                <SelectValue placeholder={t('portfolios.fields.newManager')} />
              </SelectTrigger>
              <SelectContent>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={String(manager.id)}>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-flex text-muted-foreground"><Person size={16} strokeWidth={1.75} /></span>
                      <span className="text-[0.85rem]">
                        {manager.firstName} {manager.lastName}
                      </span>
                      <span className="text-muted-foreground text-[0.72rem]">
                        {manager.email}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Notes */}
          <Field>
            <FieldLabel htmlFor="reassign-notes">{t('portfolios.dialogs.notesOptional')}</FieldLabel>
            <Textarea
              id="reassign-notes"
              rows={3}
              className="text-[0.85rem]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('portfolios.dialogs.notesPlaceholder')}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            onClick={handleClose}
            variant="outline"
            size="sm"
            disabled={loading}
            className="min-w-[90px]"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            size="sm"
            disabled={!selectedManagerId || loading}
            className="min-w-[120px]"
          >
            {loading ? <Spinner className="size-3.5" /> : <SwapHorizIcon size={16} strokeWidth={1.75} />}
            {loading ? t('portfolios.dialogs.reassigning') : t('portfolios.dialogs.reassign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
