import { Skeleton } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { useLockAccessCodeHistory } from '../useLockAccessCodeHistory';
import type { SmartLockAccessCodeEventDto } from '../../../services/api/smartLockApi';

/**
 * Journal des codes d'accès d'une serrure.
 *
 * <p>Un code de séjour naît à la réservation, part au voyageur, puis est révoqué
 * au départ — et l'écran n'en gardait aucune trace. Entre deux séjours, « Aucun
 * code » était donc toute l'information disponible, qu'il s'agisse d'un état
 * normal ou d'un échec répété depuis des mois. Le journal existait déjà en base
 * (`smart_lock_access_code_event`) ; rien ne le lisait.</p>
 *
 * <p>C'est le JOURNAL qui est rendu, pas la liste des codes : lui seul porte les
 * échecs de génération, qui n'ont aucun code rattaché — précisément le cas qu'on
 * ne voyait pas.</p>
 *
 * <p>Aucun PIN n'y figure : le backend ne transporte la valeur que du code en
 * vigueur, et les `notes` d'évènement n'en contiennent jamais.</p>
 */

const EVENT_LABELS: Record<string, string> = {
  CODE_GENERATED: 'Code généré',
  CODE_DELIVERED: 'Code envoyé au voyageur',
  DELIVERY_FAILED: 'Envoi au voyageur en échec',
  CODE_REVOKED: 'Code révoqué',
  CODE_EXPIRED: 'Code expiré',
  GENERATION_FAILED: 'Génération en échec',
};

const FAILURES = new Set(['DELIVERY_FAILED', 'GENERATION_FAILED']);

function formatMoment(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function EventRow({ event }: { event: SmartLockAccessCodeEventDto }) {
  const failed = FAILURES.has(event.eventType);
  return (
    <li className="flex items-start gap-2 py-1">
      {/* Pastille : le seul marqueur de gravité — pas de bande latérale colorée. */}
      <span
        className={cn(
          'mt-1.5 size-1.5 shrink-0 rounded-full',
          failed ? 'bg-warning' : 'bg-border',
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-xs font-medium', failed ? 'text-warning-ink' : 'text-foreground')}>
          {EVENT_LABELS[event.eventType] ?? event.eventType}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatMoment(event.createdAt)}
          {event.source === 'MANUAL' && ' · manuel'}
          {event.actorName && ` · ${event.actorName}`}
        </span>
        {event.notes && (
          <span className="block text-xs text-muted-foreground">{event.notes}</span>
        )}
      </span>
    </li>
  );
}

export default function LockAccessCodeHistory({ deviceId }: { deviceId: number }) {
  const { data, isLoading } = useLockAccessCodeHistory(deviceId, true);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const events = data?.events ?? [];

  if (events.length === 0) {
    return (
      <p className="m-0 text-xs text-muted-foreground">
        Aucun évènement pour l'instant. Le premier code sera généré à la prochaine
        réservation sur ce logement.
      </p>
    );
  }

  return (
    <ol className="m-0 flex list-none flex-col divide-y divide-border p-0">
      {events.map((event) => <EventRow key={event.id} event={event} />)}
    </ol>
  );
}
