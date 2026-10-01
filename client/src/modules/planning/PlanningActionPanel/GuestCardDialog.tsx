import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateFormat, type DateFormatApi } from '../../../hooks/useDateFormat';
import StatusChip from '../../../components/StatusChip';
import { Badge } from '../../../components/ui';
import { Spinner } from '../../../components/ui';
import {
  Button,
  Dialog,
  Input,
  Separator,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { ActionModalContent, ActionModalHeader, ActionModalBody, ActionModalFooter } from '../../supervision/components/ActionModal';
import {
  Email,
  Phone,
  CalendarMonth,
  Home,
  AttachMoney,
  Edit,
  Check,
} from '../../../icons';
import { Money } from '../../../components/Money';
import type { PlanningEvent } from '../types';
import type { Reservation } from '../../../services/api';
import { RESERVATION_SOURCE_LABELS, isCollectedByChannel } from '../../../services/api/reservationsApi';
import { RESERVATION_STATUS_TOKEN_COLORS } from '../constants';
import type { ReservationStatus, ReservationSource } from '../../../services/api';

/** Couleur Signature du statut (mêmes constantes que les briques du planning). */
const statusTokenColor = (status: string): string =>
  RESERVATION_STATUS_TOKEN_COLORS[status] ?? 'var(--bui-muted-foreground)';

interface GuestCardDialogProps {
  open: boolean;
  onClose: () => void;
  reservation: Reservation;
  allEvents: PlanningEvent[];
  onUpdateGuestInfo?: (reservationId: number, updates: { guestName?: string; guestEmail?: string; guestPhone?: string }) => Promise<{ success: boolean; error: string | null }>;
}

/**
 * Champ d'edition en place : on neutralise le cadre de `.cn-input` pour ne
 * garder qu'un filet sous le texte. C'est l'equivalent du `variant="standard"`
 * de MUI — la valeur se lit comme du texte, le champ ne se signale qu'a
 * l'edition, et la fiche ne se transforme pas en formulaire.
 */
const CHAMP_EN_PLACE =
  'h-auto w-full rounded-none border-0 border-b border-solid border-[var(--bui-border)] bg-transparent px-0 py-0.5 focus-visible:border-[var(--bui-supervision-navy)] focus-visible:ring-0';

const GuestCardDialog: React.FC<GuestCardDialogProps> = ({ open, onClose, reservation, allEvents, onUpdateGuestInfo }) => {
  const { t } = useTranslation();
  // Dates du séjour et de l'historique : calendrier de la langue active.
  const fmt = useDateFormat();
  // Find all reservations from the same guest (by name match)
  const guestReservations = useMemo(() => {
    const name = reservation.guestName.toLowerCase().trim();
    return allEvents
      .flatMap((e) =>
        e.type === 'reservation' &&
        e.reservation &&
        e.reservation.guestName.toLowerCase().trim() === name
          ? [e.reservation]
          : [],
      )
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn)); // most recent first
  }, [reservation.guestName, allEvents]);

  const totalSpent = useMemo(
    () => guestReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0),
    [guestReservations],
  );

  const initials = reservation.guestName
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const isICalSource = isCollectedByChannel(reservation);
  const hasNoPrice = !reservation.totalPrice || reservation.totalPrice === 0;

  // ── Editable fields ──────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<'name' | 'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  // Optimistic local overrides (displayed immediately after save, before query refetch)
  const [localOverrides, setLocalOverrides] = useState<{ guestName?: string; guestEmail?: string; guestPhone?: string }>({});

  // Displayed values = local override > prop
  const displayName = localOverrides.guestName ?? reservation.guestName;
  const displayEmail = localOverrides.guestEmail ?? reservation.guestEmail;
  const displayPhone = localOverrides.guestPhone ?? reservation.guestPhone;

  const startEdit = useCallback((field: 'name' | 'email' | 'phone') => {
    if (!onUpdateGuestInfo) return;
    const current =
      field === 'name' ? (displayName || '') :
      field === 'email' ? (displayEmail || '') :
      (displayPhone || '');
    setEditingField(field);
    setEditValue(current);
    setSaved(null);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [onUpdateGuestInfo, displayName, displayEmail, displayPhone]);

  const commitEdit = useCallback(async () => {
    if (!editingField || !onUpdateGuestInfo) return;
    const trimmed = editValue.trim();

    // Validate name is not empty
    if (editingField === 'name' && !trimmed) {
      setEditingField(null);
      return;
    }

    // Check if value actually changed
    const original =
      editingField === 'name' ? (displayName || '') :
      editingField === 'email' ? (displayEmail || '') :
      (displayPhone || '');

    if (trimmed === original) {
      setEditingField(null);
      return;
    }

    const updates =
      editingField === 'name' ? { guestName: trimmed } :
      editingField === 'email' ? { guestEmail: trimmed } :
      { guestPhone: trimmed };

    setSaving(true);
    const result = await onUpdateGuestInfo(reservation.id, updates);
    setSaving(false);
    if (result.success) {
      // Optimistic update — display new value immediately
      setLocalOverrides((prev) => ({ ...prev, ...updates }));
      setSaved(editingField);
      setTimeout(() => setSaved(null), 2000);
    }
    setEditingField(null);
  }, [editingField, editValue, onUpdateGuestInfo, reservation, displayName, displayEmail, displayPhone]);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <ActionModalContent className="sm:max-w-[640px] baitly-guest-modal">
        <ActionModalHeader title={t('planning.panel.guest.title', 'Fiche client')} description={reservation.propertyName} />
        <ActionModalBody>
          {/* Header — Avatar + Name + Contact */}
          <div className="flex items-start gap-3">
            {/* Avatar initiales : pattern messagerie (carré arrondi r13, accent,
                initiales display) — pas de rond plein */}
            <div className="w-[52px] h-[52px] rounded-[13px] bg-[var(--bui-supervision-navy)] flex items-center justify-center text-[var(--bui-supervision-on-navy)] font-[family-name:var(--font-display)] text-[1.125rem] font-semibold shrink-0 mt-0.5">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              {/* Editable guest name */}
              {editingField === 'name' ? (
                <div className="flex items-center gap-0.5">
                  <Input
                    ref={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    disabled={saving}
                    aria-label={t('planning.panel.guest.nameAria', 'Nom du voyageur')}
                    className={cn(CHAMP_EN_PLACE, 'text-[1rem] font-bold')}
                  />
                  {saving && <Spinner className="size-3.5" />}
                </div>
              ) : (
                <div
                  onClick={() => startEdit('name')}
                    role={onUpdateGuestInfo ? 'button' : undefined}
                    tabIndex={onUpdateGuestInfo ? 0 : undefined}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit('name'); } }}
                  className={cn(
                    'flex items-center gap-[3px] rounded-[4px] px-[3px] mx-[-3px]',
                    // Variante unique '&:hover .edit-hint' : evite toute ambiguite
                    // d'ordre entre les variantes hover: et [&_...]:
                    onUpdateGuestInfo
                      ? 'cursor-pointer hover:bg-[var(--bui-supervision-soft)] [&:hover_.edit-hint]:opacity-100'
                      : 'cursor-default',
                  )}
                >
                  <p className="cn-text-body1 text-[1rem] font-bold">
                    {displayName}
                  </p>
                  {onUpdateGuestInfo && (
                    <span className="edit-hint inline-flex text-[var(--bui-muted-foreground)] ms-auto" style={{ transition: 'opacity 0.15s' }}><Edit size={14} strokeWidth={1.75} /></span>
                  )}
                  {saved === 'name' && <span className="inline-flex text-[var(--bui-success-ink)]"><Check size={14} strokeWidth={1.75} /></span>}
                </div>
              )}

              {/* Editable contact info */}
              <div className="flex flex-col gap-0.5 mt-0.5">
                {/* Email — editable */}
                {editingField === 'email' ? (
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-muted-foreground"><Email size={'0.8rem'} strokeWidth={1.75} /></span>
                    <Input
                      ref={editRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      disabled={saving}
                      placeholder="email@exemple.com"
                      aria-label={t('planning.panel.guest.emailAria', 'Email du voyageur')}
                      className={cn(CHAMP_EN_PLACE, 'text-[0.75rem]')}
                    />
                    {saving ? <Spinner className="size-3" /> : (
                      <Button variant="ghost" size="icon-xs" aria-label={t('planning.panel.guest.emailConfirm', "Valider l'email")} onClick={commitEdit}>
                        <span className="inline-flex text-[var(--bui-success-ink)]"><Check size={14} strokeWidth={1.75} /></span>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit('email')}
                    role={onUpdateGuestInfo ? 'button' : undefined}
                    tabIndex={onUpdateGuestInfo ? 0 : undefined}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit('email'); } }}
                    className={cn(
                      'flex items-center gap-[3px] rounded-[4px] px-[3px] mx-[-3px] py-[1.5px]',
                      onUpdateGuestInfo
                        ? 'cursor-pointer hover:bg-[var(--bui-supervision-soft)] [&:hover_.edit-hint]:opacity-100'
                        : 'cursor-default',
                    )}
                  >
                    <span className="inline-flex text-muted-foreground"><Email size={'0.8rem'} strokeWidth={1.75} /></span>
                    <p className={cn('cn-text-body1 text-[0.75rem]', displayEmail ? 'text-[var(--bui-muted-foreground)]' : 'text-[var(--bui-muted-foreground)]', displayEmail ? 'not-italic' : 'italic')}>
                      {displayEmail || t('planning.panel.guest.addEmail', 'Ajouter un email')}
                    </p>
                    {onUpdateGuestInfo && (
                      <span className="edit-hint inline-flex text-[var(--bui-muted-foreground)] ms-auto" style={{ transition: 'opacity 0.15s' }}><Edit size={12} strokeWidth={1.75} /></span>
                    )}
                    {saved === 'email' && <span className="inline-flex text-[var(--bui-success-ink)]"><Check size={12} strokeWidth={1.75} /></span>}
                  </div>
                )}

                {/* Phone — editable */}
                {editingField === 'phone' ? (
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-muted-foreground"><Phone size={'0.8rem'} strokeWidth={1.75} /></span>
                    <Input
                      ref={editRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      disabled={saving}
                      placeholder="+33 6 12 34 56 78"
                      aria-label={t('planning.panel.guest.phoneAria', 'Téléphone du voyageur')}
                      className={cn(CHAMP_EN_PLACE, 'text-[0.75rem]')}
                    />
                    {saving && <Spinner className="size-3" />}
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit('phone')}
                    role={onUpdateGuestInfo ? 'button' : undefined}
                    tabIndex={onUpdateGuestInfo ? 0 : undefined}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit('phone'); } }}
                    className={cn(
                      'flex items-center gap-[3px] rounded-[4px] px-[3px] mx-[-3px] py-[1.5px]',
                      onUpdateGuestInfo
                        ? 'cursor-pointer hover:bg-[var(--bui-supervision-soft)] [&:hover_.edit-hint]:opacity-100'
                        : 'cursor-default',
                    )}
                  >
                    <span className="inline-flex text-muted-foreground"><Phone size={'0.8rem'} strokeWidth={1.75} /></span>
                    <p className={cn('cn-text-body1 text-[0.75rem]', displayPhone ? 'text-[var(--bui-muted-foreground)]' : 'text-[var(--bui-muted-foreground)]', displayPhone ? 'not-italic' : 'italic')}>
                      {displayPhone || t('planning.panel.guest.addPhone', 'Ajouter un téléphone')}
                    </p>
                    {onUpdateGuestInfo && (
                      <span className="edit-hint inline-flex text-[var(--bui-muted-foreground)] ms-auto" style={{ transition: 'opacity 0.15s' }}><Edit size={12} strokeWidth={1.75} /></span>
                    )}
                    {saved === 'phone' && <span className="inline-flex text-[var(--bui-success-ink)]"><Check size={12} strokeWidth={1.75} /></span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <StatBox label={t('planning.panel.guest.stays', 'Séjours')} value={String(guestReservations.length)} />
            <StatBox
              label={t('planning.panel.guest.totalSpent', 'Total dépensé')}
              value={totalSpent <= 0 && isICalSource ? '—' : <Money value={totalSpent} from="EUR" decimals={0} />}
            />
            <StatBox
              label={t('planning.panel.guest.source', 'Source')}
              value={
                RESERVATION_SOURCE_LABELS[reservation.source as ReservationSource] ||
                reservation.source
              }
            />
            <StatBox
              label={t('planning.panel.guest.guests', 'Voyageurs')}
              value={String(reservation.guestCount)}
            />
          </div>

          <Separator />

          {/* Current reservation */}
          <div>
            <p className="cn-text-body1 text-[0.6875rem] font-semibold uppercase text-muted-foreground mb-1">
              {t('planning.panel.guest.current', 'Réservation actuelle')}
            </p>
            <div className="py-3">
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div>
                  <div className="flex items-center gap-0.5 mb-0.5">
                    <span className="inline-flex text-muted-foreground"><Home size={14} strokeWidth={1.75} /></span>
                    <p className="cn-text-body1 text-[0.8125rem] font-semibold">
                      {reservation.propertyName}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-muted-foreground"><CalendarMonth size={12} strokeWidth={1.75} /></span>
                    <p className="cn-text-body1 text-[0.75rem] text-muted-foreground">
                      {formatDate(reservation.checkIn, fmt)} → {formatDate(reservation.checkOut, fmt)}
                    </p>
                  </div>
                  {(reservation.checkInTime || reservation.checkOutTime) && (
                    <p className="cn-text-body1 text-[0.625rem] text-muted-foreground mt-0.5 ms-3.5">
                      {reservation.checkInTime && t('planning.panel.guest.arrival', { time: reservation.checkInTime })}
                      {reservation.checkInTime && reservation.checkOutTime && ' · '}
                      {reservation.checkOutTime && t('planning.panel.guest.departure', { time: reservation.checkOutTime })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-muted-foreground"><AttachMoney size={14} strokeWidth={1.75} /></span>
                    {hasNoPrice && isICalSource ? (
                      <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground italic">
                        {t('planning.panel.guest.noPrice', 'Non communiqué')}
                      </p>
                    ) : (
                      <p className="cn-text-body1 text-[0.8125rem] font-bold">
                        <Money value={reservation.totalPrice} from="EUR" />
                      </p>
                    )}
                  </div>
                  {/* Statut : texte couleur + fond soft (jamais d'aplat plein) */}
                  <StatusChip tokens={{ color: statusTokenColor(reservation.status), bg: `color-mix(in srgb, ${statusTokenColor(reservation.status)} 14%, transparent)` }} label={t(`planning.legend.status.${reservation.status}`, reservation.status)} className="text-[10.5px] h-[20px]" />
                </div>
              </div>
              {reservation.notes && (
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground italic mt-1 ps-3.5">
                  {reservation.notes}
                </p>
              )}
            </div>
          </div>

          {/* Reservation history */}
          {guestReservations.length > 1 && (
            <>
              <Separator />
              <div>
                <p className="cn-text-body1 text-[0.6875rem] font-semibold uppercase text-muted-foreground mb-1">
                  <span className="inline-flex me-[1.5px] align-[middle]">
                    <CalendarMonth size={12} strokeWidth={1.75} />
                  </span>
                  {t('planning.panel.guest.history', { count: guestReservations.length })}
                </p>
                <div className="flex flex-col gap-0.5">
                  {guestReservations
                    .flatMap((r) => (r.id !== reservation.id ? [(
                      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-[var(--bui-border)] py-3" key={r.id}>
                        <div>
                          <p className="cn-text-body1 text-[0.75rem] font-semibold">
                            {r.propertyName}
                          </p>
                          <p className="cn-text-body1 text-[0.625rem] text-muted-foreground">
                            {formatDate(r.checkIn, fmt)} → {formatDate(r.checkOut, fmt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="cn-text-body1 text-[0.75rem] font-semibold">
                            <Money value={r.totalPrice} from="EUR" decimals={0} />
                          </p>
                          <StatusChip size="sm" tokens={{ color: statusTokenColor(r.status), bg: `color-mix(in srgb, ${statusTokenColor(r.status)} 14%, transparent)` }} label={t(`planning.legend.status.${r.status}`, r.status)} className="text-[10.5px]" />
                        </div>
                      </div>
                    )] : []))}
                </div>
              </div>
            </>
          )}

          {reservation.confirmationCode && (
            <>
              <Separator />
              <div className="flex items-center gap-1.5">
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                  {t('planning.panel.guest.confirmationCode', 'Code de confirmation :')}
                </p>
                <Badge variant="outline" className="text-[0.6875rem] font-semibold">{reservation.confirmationCode}</Badge>
              </div>
            </>
          )}
        </ActionModalBody>
        <ActionModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('planning.panel.guest.close', 'Fermer')}</Button>
          {editingField && <Button onClick={commitEdit} disabled={saving}>
            {saving && <Spinner />}{t('common.save', 'Enregistrer')}
          </Button>}
        </ActionModalFooter>
      </ActionModalContent>
    </Dialog>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * « 12 août 2026 » dans le calendrier AFFICHÉ — hégirien en arabe.
 *
 * <p>Le formateur est injecté plutôt que lu d'un singleton : la fonction reste
 * pure et le composant, lui, s'abonne au changement de langue.</p>
 */
function formatDate(dateStr: string, fmt: DateFormatApi): string {
  try {
    return fmt.formatDayMonthYearShort(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="cn-text-body1 text-xs text-[var(--bui-muted-foreground)]">
        {label}
      </p>
      <p className="cn-text-body1 font-[family-name:var(--font-display)] text-base font-medium mt-1.5 tabular-nums">
        {value}
      </p>
    </div>
  );
}

export default GuestCardDialog;
