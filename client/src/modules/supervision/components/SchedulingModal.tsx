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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Spinner,
} from '../../../components/ui';
import { Check, UserRound, UserRoundX } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { ar, enUS, fr } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { cn } from '../../../utils/cn';
import { usersApi, type User } from '../../../services/api/usersApi';
import { MANAGER_ROLES, OPERATIONAL_ROLES } from '../../../constants/roles';
import { TRADE_ROLES } from '../../../utils/fieldRoles';
import { useAuth } from '../../../hooks/useAuth';
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
 * <p>La liste était recopiée ici, et elle était fausse : elle citait un
 * `manager` qui n'existe pas dans `UserRole`, et omettait la blanchisserie et
 * le tech. extérieur — deux métiers qui devenaient donc <b>inassignables</b>
 * sans que rien ne le signale. On prend la liste partagée.</p>
 */
const WORKER_ROLES: readonly string[] = OPERATIONAL_ROLES.map((r) => r.toLowerCase());

/**
 * Métiers dont le travail correspond à celui demandé.
 *
 * <p>Les deux cartes qui ouvrent cette modale — batterie de serrure, entretien
 * préventif — relèvent des travaux. `TRADE_ROLES` porte déjà cette frontière,
 * documentée dans {@code utils/fieldRoles}.</p>
 */
const MAINTENANCE_ROLES: readonly string[] = TRADE_ROLES.map((r) => r.toLowerCase());

/**
 * Ceux qui gèrent, et qui peuvent aussi faire.
 *
 * <p>Toutes les missions ne demandent pas un métier. Changer la pile d'une
 * serrure connectée, relever un compteur, déposer un jeu de clés : n'importe
 * qui de l'organisation en est capable, et attendre un technicien pour ça fait
 * traîner une mission de cinq minutes pendant des jours.</p>
 *
 * <p>La liste n'était PAS ouverte à ces rôles : le propriétaire d'un logement
 * ne pouvait pas se donner sa propre intervention.</p>
 */
const ORG_ROLES: readonly string[] = MANAGER_ROLES.map((r) => r.toLowerCase());

/** Heure par défaut : celle qu'appliquait le chemin automatique. */
const DEFAULT_TIME = '10:00';

/**
 * Langue du calendrier.
 *
 * <p>Sans elle, react-day-picker retombe sur l'anglais : « August 2026 » et
 * « Su Mo Tu » au milieu d'une interface française. La langue de l'application
 * ne suffit pas — il faut lui passer la locale date-fns correspondante.</p>
 */
function calendarLocale(language: string): Locale {
  if (language.startsWith('en')) return enUS;
  if (language.startsWith('ar')) return ar;
  return fr;
}

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
  const { t, currentLanguage } = useTranslation();

  const [day, setDay] = useState<Date | undefined>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [time, setTime] = useState(DEFAULT_TIME);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // `databaseId` et non `id` : ce dernier porte le sujet Keycloak, alors que
  // l'assignation raisonne sur l'identifiant en base.
  const myId = useAuth().user?.databaseId ?? null;

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

  const { matching, others, orgTeam, me } = useMemo(() => {
    const all = users ?? [];
    const workers = all.filter((u) => WORKER_ROLES.includes(u.role?.toLowerCase() ?? ''));
    const team = all.filter((u) => ORG_ROLES.includes(u.role?.toLowerCase() ?? ''));
    // Soi-même sort de l'équipe pour être proposé à part : c'est le choix le
    // plus fréquent des trois, et le chercher dans une liste de noms dont un
    // est le sien se fait mal.
    const self = myId != null ? team.find((u) => u.id === myId) ?? null : null;
    return {
      matching: workers.filter((u) => MAINTENANCE_ROLES.includes(u.role?.toLowerCase() ?? '')),
      others: workers.filter((u) => !MAINTENANCE_ROLES.includes(u.role?.toLowerCase() ?? '')),
      orgTeam: team.filter((u) => u.id !== self?.id),
      me: self,
    };
  }, [users, myId]);

  /**
   * « Mardi 26 août à 10:00, Karim B. »
   *
   * <p>La date vient du calendrier, l'heure d'un champ, l'intervenant d'une
   * liste : trois gestes distants, qu'on valide sans les avoir vus ensemble.</p>
   */
  const readback = useMemo(() => {
    if (!day) return '';
    const when = day.toLocaleDateString(currentLanguage, {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const who = [...matching, ...others, ...orgTeam, ...(me ? [me] : [])]
      .find((u) => u.id === assigneeId);
    const at = `${when} ${t('supervision.schedule.at', 'à')} ${time}`;
    return who ? `${at}, ${who.firstName} ${who.lastName}` : at;
  }, [day, time, assigneeId, matching, others, orgTeam, me, currentLanguage, t]);

  const confirm = () => {
    if (!day) return;
    setSubmitting(true);
    onConfirm({ scheduledAt: toLocalIso(day, time), assigneeId });
  };

  /** `overrideName` : « Moi-même » plutôt que son propre nom, qu'on ne cherche pas. */
  const renderAssignee = (user: User, overrideName?: string) => {
    const selected = assigneeId === user.id;
    const name = overrideName ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return (
      <CommandItem
        key={user.id}
        // Ce que la frappe filtre : le nom ET le métier, puisque « technicien »
        // est le mot qui vient d'abord quand on cherche qui envoyer.
        value={`${name} ${t(`roles.${user.role?.toLowerCase()}`, user.role ?? '')}`}
        onSelect={() => setAssigneeId(user.id)}
        className={cn('cursor-pointer', selected && 'bg-[var(--bui-accent)]')}
      >
        <Avatar className="size-7">
          <AvatarFallback className="text-[11px]">{initials(user)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="shrink-0 text-xs text-[var(--bui-muted-foreground)]">
          {t(`roles.${user.role?.toLowerCase()}`, user.role)}
        </span>
        {selected && <Check size={15} className="shrink-0 text-[var(--bui-primary)]" />}
      </CommandItem>
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
              // Sans locale, react-day-picker retombe sur l'anglais : « August
              // 2026 » et « Su Mo Tu » au milieu d'une interface française.
              locale={calendarLocale(currentLanguage)}
              mode="single"
              selected={day}
              onSelect={setDay}
              disabled={{ before: new Date() }}
              // La cellule vaut 1,75 rem par défaut : à cette taille, choisir un
              // jour demande de viser. C'est la décision principale de l'écran,
              // elle doit se prendre du pouce. En style en ligne plutôt qu'en
              // classe utilitaire : la variable est lue au rendu, aucun risque
              // qu'une classe arbitraire ne soit pas émise dans la feuille.
              style={{ '--cell-size': '2.4rem' } as React.CSSProperties}
              className="rounded-[var(--radius-md)] border border-[var(--bui-border)] p-3"
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
            ) : matching.length + others.length + orgTeam.length + (me ? 1 : 0) === 0 ? (
              <p className="py-8 text-center text-sm text-pretty text-[var(--bui-muted-foreground)]">
                {t(
                  'supervision.schedule.noWorker',
                  'Aucun intervenant dans cette organisation. La mission sera créée sans attributaire.',
                )}
              </p>
            ) : (
              /* Une liste qu'on parcourt à la molette convient à cinq noms, pas
                 à trente. Ici on tape les premières lettres — du nom ou du
                 métier — et les groupes se réduisent d'eux-mêmes. */
              <Command className="flex-1 rounded-[var(--radius-md)] border border-[var(--bui-border)] bg-transparent">
                <CommandInput
                  placeholder={t('supervision.schedule.searchWorker', 'Rechercher un intervenant…')}
                />
                <CommandList className="max-h-[268px]">
                  <CommandEmpty>
                    {t('supervision.schedule.noMatch', 'Aucun intervenant à ce nom.')}
                  </CommandEmpty>

                  {matching.length > 0 && (
                    <CommandGroup
                      heading={t('supervision.schedule.matchingRoles', 'Métier correspondant')}
                    >
                      {matching.map((user) => renderAssignee(user))}
                    </CommandGroup>
                  )}
                  {matching.length > 0 && others.length > 0 && <CommandSeparator />}
                  {others.length > 0 && (
                    <CommandGroup
                      heading={t('supervision.schedule.otherRoles', 'Autres intervenants')}
                    >
                      {others.map((user) => renderAssignee(user))}
                    </CommandGroup>
                  )}

                  {/* Une mission ne demande pas toujours un métier : changer la
                      pile d'une serrure, relever un compteur, déposer des clés.
                      Attendre un technicien pour cinq minutes de travail fait
                      traîner la mission pendant des jours. */}
                  {(me || orgTeam.length > 0) && (
                    <>
                      {(matching.length > 0 || others.length > 0) && <CommandSeparator />}
                      <CommandGroup
                        heading={t('supervision.schedule.orgTeam', 'Conciergerie')}
                      >
                        {me && renderAssignee(me, t('supervision.schedule.myself', 'Moi-même'))}
                        {orgTeam.map((user) => renderAssignee(user))}
                      </CommandGroup>
                    </>
                  )}

                  {/* Se raviser doit être un geste explicite. Reposer le doigt
                      sur la ligne déjà choisie pour la désélectionner ne
                      s'invente pas, et personne ne le trouvait. */}
                  {assigneeId !== null && (
                    <>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem
                          value={t('supervision.schedule.clearAssignee', 'Laisser sans intervenant')}
                          onSelect={() => setAssigneeId(null)}
                          className="cursor-pointer text-[var(--bui-muted-foreground)]"
                        >
                          <UserRoundX size={15} />
                          {t('supervision.schedule.clearAssignee', 'Laisser sans intervenant')}
                        </CommandItem>
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            )}

            {/* La décision, relue d'un trait avant de l'engager : deux champs
                séparés se confirment sans jamais avoir été lus ensemble. */}
            <p className="pt-3 text-xs text-pretty text-[var(--bui-muted-foreground)]">
              <span className="text-[var(--bui-foreground)]">{readback}</span>
              {' — '}
              {assigneeId === null
                ? t(
                    'supervision.schedule.unassignedHint',
                    'sans intervenant, la mission reste à assigner.',
                  )
                : assigneeId === myId
                  ? // On ne se propose pas une mission : on se la donne.
                    t('supervision.schedule.selfHint', 'la mission vous revient, déjà acceptée.')
                  : t(
                      'supervision.schedule.proposalHint',
                      'la mission lui sera proposée : il peut l’accepter ou la refuser.',
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
