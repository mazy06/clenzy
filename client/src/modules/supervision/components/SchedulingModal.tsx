/* ============================================================
   <SchedulingModal> — quand, et par qui

   Ouverte au clic sur « Planifier » d'une carte HITL de constellation
   (batterie de serrure, entretien préventif). Ces cartes créaient l'intervention
   séance tenante — lendemain 10 h, sans personne dessus — si bien que la date et
   l'intervenant se corrigeaient APRÈS coup, dans un autre écran.

   Le choix de l'intervenant est PRÉ-FILTRÉ, pas restreint : les métiers qui
   correspondent au type d'intervention viennent d'abord, sous leur propre
   intitulé, et les autres restent accessibles en dessous. Assigner un
   technicien à une maintenance est le cas courant ; y envoyer un superviseur
   reste possible, et c'est un choix assumé, pas un accident.
   ============================================================ */

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  AvatarFallback,
  Button,
  Calendar,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  ScrollArea,
  Separator,
  Spinner,
} from '../../../components/ui';
import { Check, UserRound } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { usersApi, type User } from '../../../services/api/usersApi';
import type { PendingAction, PortfolioPendingAction, SchedulingChoice } from '../types';

export interface SchedulingModalProps {
  action: PendingAction | PortfolioPendingAction;
  onClose: () => void;
  /** Confirme : le parent applique la carte avec ce choix. */
  onConfirm: (plan: SchedulingChoice) => void;
}

/**
 * Métiers qui peuvent recevoir une mission.
 *
 * <p>Même ensemble que l'écran d'assignation des demandes de service : ce n'est
 * pas le lieu d'inventer une seconde politique.</p>
 */
const WORKER_ROLES = ['housekeeper', 'technician', 'supervisor', 'manager'];

/** Métiers dont le travail correspond à une maintenance. */
const MAINTENANCE_ROLES = ['technician', 'supervisor'];

/** Heure par défaut : celle qu'appliquait le chemin automatique. */
const DEFAULT_TIME = '10:00';

/**
 * `2026-08-25` + `09:00` → `2026-08-25T09:00:00`, sans décalage de fuseau.
 *
 * <p>`toISOString()` convertit en UTC : à Paris, le 25 à 00 h 30 devient le 24 à
 * 22 h 30, et la mission part la veille. On compose donc les champs locaux à la
 * main — le serveur reçoit une heure locale, comme le reste des dates métier.</p>
 */
export function toLocalIso(day: Date, time: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  return `${date}T${time.length === 5 ? time : DEFAULT_TIME}:00`;
}

function initials(user: User): string {
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function SchedulingModal({ action, onClose, onConfirm }: SchedulingModalProps) {
  const { t } = useTranslation();

  const [day, setDay] = useState<Date | undefined>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [time, setTime] = useState(DEFAULT_TIME);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getAll()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      // Une liste indisponible n'empêche pas de planifier : on garde la date, et
      // la mission part sans attributaire — exactement l'ancien comportement.
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { matching, others } = useMemo(() => {
    const workers = (users ?? []).filter((u) => WORKER_ROLES.includes(u.role?.toLowerCase() ?? ''));
    return {
      matching: workers.filter((u) => MAINTENANCE_ROLES.includes(u.role?.toLowerCase() ?? '')),
      others: workers.filter((u) => !MAINTENANCE_ROLES.includes(u.role?.toLowerCase() ?? '')),
    };
  }, [users]);

  const confirm = () => {
    if (!day) return;
    setSubmitting(true);
    onConfirm({ scheduledAt: toLocalIso(day, time), assigneeId });
  };

  const renderAssignee = (user: User) => {
    const selected = assigneeId === user.id;
    return (
      <Item
        key={user.id}
        asChild
        variant={selected ? 'outline' : 'default'}
        size="sm"
        className={cn(
          'cursor-pointer transition-colors duration-200',
          selected && 'bg-[var(--bui-accent)]',
        )}
      >
        <button
          type="button"
          onClick={() => setAssigneeId(selected ? null : user.id)}
          aria-pressed={selected}
        >
          <ItemMedia>
            <Avatar className="size-7">
              <AvatarFallback className="text-[11px]">{initials(user)}</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {user.firstName} {user.lastName}
            </ItemTitle>
            <ItemDescription>
              {t(`roles.${user.role?.toLowerCase()}`, user.role)}
            </ItemDescription>
          </ItemContent>
          {selected && <Check size={15} className="text-[var(--bui-primary)]" />}
        </button>
      </Item>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="text-balance">
            {t('supervision.schedule.title', 'Planifier l’intervention')}
          </DialogTitle>
          <DialogDescription className="text-balance">{action.title}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          {/* ── Quand ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <Calendar
              mode="single"
              selected={day}
              onSelect={setDay}
              disabled={{ before: new Date() }}
              className="rounded-md border p-2"
            />
            <Field>
              <FieldLabel htmlFor="scheduling-time">
                {t('supervision.schedule.time', 'Heure')}
              </FieldLabel>
              <Input
                id="scheduling-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>

          {/* ── Par qui ───────────────────────────────────────────── */}
          <div className="flex min-h-0 flex-col">
            <FieldLabel className="mb-2">
              {t('supervision.schedule.assignee', 'Intervenant')}
            </FieldLabel>

            {users === null ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <Spinner className="size-4" />
              </div>
            ) : matching.length + others.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--bui-muted-foreground)]">
                {t(
                  'supervision.schedule.noWorker',
                  'Aucun intervenant dans cette organisation. La mission sera créée sans attributaire.',
                )}
              </p>
            ) : (
              <ScrollArea className="h-[300px] pe-3">
                <ItemGroup className="gap-1">
                  {matching.length > 0 && (
                    <>
                      <p className="px-1 pb-1 text-xs text-[var(--bui-muted-foreground)]">
                        {t('supervision.schedule.matchingRoles', 'Métier correspondant')}
                      </p>
                      {matching.map(renderAssignee)}
                    </>
                  )}
                  {others.length > 0 && (
                    <>
                      {matching.length > 0 && <Separator className="my-2" />}
                      <p className="px-1 pb-1 text-xs text-[var(--bui-muted-foreground)]">
                        {t('supervision.schedule.otherRoles', 'Autres intervenants')}
                      </p>
                      {others.map(renderAssignee)}
                    </>
                  )}
                </ItemGroup>
              </ScrollArea>
            )}

            <p className="pt-2 text-xs text-[var(--bui-muted-foreground)]">
              {assigneeId === null
                ? t(
                    'supervision.schedule.unassignedHint',
                    'Sans intervenant, la mission reste à assigner.',
                  )
                : t(
                    'supervision.schedule.proposalHint',
                    'La mission lui sera proposée : il peut l’accepter ou la refuser.',
                  )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button onClick={confirm} disabled={!day || submitting}>
            {submitting ? <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} /> : <UserRound size={15} />}
            {t('supervision.verbs.schedule', 'Planifier')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SchedulingModal;
