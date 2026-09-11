import React from 'react';
import { Badge, Skeleton } from '../../components/ui';
import BatteryGauge, { batteryTone, type BatteryTone } from '../../components/baitly/BatteryGauge';
import SmartLockMark from '../../components/baitly/SmartLockMark';
import { smartLockApi, type SmartLockDeviceDto } from '../../services/api/smartLockApi';
import { useTranslation } from '../../hooks/useTranslation';
import type { Notification } from '../../services/api';

/**
 * Gestes de la constellation qui portent sur une SERRURE.
 *
 * <p>Le seul aujourd'hui. La liste existe quand meme, parce que `deviceId`
 * designe « un objet connecte » et pas « une serrure » : le jour ou un scan de
 * capteur de bruit posera le meme fait, la fiche irait chercher une serrure
 * portant ce numero — au mieux une erreur, au pire la mauvaise porte. Un
 * nouveau geste sur serrure s'ajoute ICI.</p>
 */
const LOCK_ACTION_TYPES = new Set(['LOCK_BATTERY_REPLACE']);

/**
 * Serrure designee par une notification, ou `null`.
 *
 * L'identifiant vient des faits, jamais du titre : « Batterie serrure a 12 % —
 * Serrure porte d'entree » est du texte pour l'humain, pas une adresse.
 */
export function deviceIdOf(notification: Notification): number | null {
  const actionType = notification.metadata?.actionType;
  if (typeof actionType !== 'string' || !LOCK_ACTION_TYPES.has(actionType)) return null;

  const raw = notification.metadata?.deviceId;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

/**
 * Charge la serrure. Le niveau de batterie n'existe que dans l'intitule de la
 * carte (« a 12 % ») : le relire dans du texte pour dessiner une jauge serait
 * une promesse fragile. On va donc chercher l'etat, qui a en plus le merite
 * d'etre A JOUR — des piles remplacees hier ne laissent pas une fiche annoncer
 * 12 %.
 *
 * Un echec ne fait rien echouer : `device` reste `null` et la fiche s'en tient
 * a son message.
 */
export function useNotificationDevice(deviceId: number | null) {
  const [device, setDevice] = React.useState<SmartLockDeviceDto | null>(null);
  const [loading, setLoading] = React.useState(deviceId !== null);

  React.useEffect(() => {
    if (deviceId === null) {
      setDevice(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setDevice(null);
    smartLockApi
      .getById(deviceId)
      .then((loaded) => { if (active) setDevice(loaded); })
      .catch(() => { if (active) setDevice(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [deviceId]);

  return { device, loading };
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationDeviceSkeleton() {
  return (
    <div className="flex items-center gap-5 rounded-xl bg-muted px-4 py-4">
      <Skeleton className="h-[126px] w-[78px] shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-52" />
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  );
}

/** Marques de serrures : le nom tel qu'il s'ecrit, pas la constante en base. */
const BRAND_LABEL: Record<string, string> = {
  TUYA: 'Tuya',
  NUKI: 'Nuki',
  TTLOCK: 'TTLock',
  YALE: 'Yale',
  SIMULATION: 'Simulation',
};

const TONE_BADGE: Record<BatteryTone, 'destructive' | 'warning' | 'success'> = {
  critical: 'destructive',
  low: 'warning',
  ok: 'success',
};

/** Teinte de signal de la serrure : celle de l'etat de sa pile. */
const TONE_SIGNAL: Record<BatteryTone, string> = {
  critical: 'var(--bui-destructive)',
  low: 'var(--bui-warning)',
  ok: 'var(--bui-success)',
};

/**
 * L'objet connecte lui-meme, dans la fiche d'une alerte de maintenance.
 *
 * <p>« Batterie serrure a 12 % » se lit, mais ne se VOIT pas : douze pour cent
 * de quoi, sur quelle porte, dans quel logement ? Ici la pile a une silhouette
 * et un niveau, la serrure un visage, et la teinte — diode, arcs, remplissage —
 * dit la gravite une seule fois, partout au meme endroit.</p>
 *
 * <p>Le message de la carte reste affiche en dessous : il nomme le geste
 * (« Planifier » cree l'intervention), ce que ce panneau ne dit pas.</p>
 */
export default function NotificationDevicePanel({ device }: { device: SmartLockDeviceDto }) {
  const { t } = useTranslation();
  const level = device.batteryLevel;
  const tone = level != null ? batteryTone(level) : 'ok';

  const context = [
    BRAND_LABEL[device.brand] ?? device.brand,
    device.propertyName,
    device.roomName,
  ].filter(Boolean).join(' · ');

  const toneLabel = {
    critical: t('notifications.detail.device.batteryCritical', 'Batterie critique'),
    low: t('notifications.detail.device.batteryLow', 'Batterie faible'),
    ok: t('notifications.detail.device.batteryOk', 'Batterie suffisante'),
  }[tone];

  return (
    <section className="flex items-center gap-5 rounded-xl bg-muted px-4 py-4">
      <SmartLockMark signal={TONE_SIGNAL[tone]} width={78} />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-medium text-foreground">{device.name}</p>
          {context && <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{context}</p>}
        </div>

        {level != null ? (
          <BatteryGauge level={level} />
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            {t('notifications.detail.device.batteryUnknown', 'Niveau de batterie inconnu')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {level != null && <Badge variant={TONE_BADGE[tone]}>{toneLabel}</Badge>}
          {/* Une serrure deja injoignable ne se replanifiera pas toute seule :
              c'est un fait qui change l'urgence, pas un detail technique. */}
          {device.online === false && (
            <Badge variant="outline">
              {t('notifications.detail.device.offline', 'Hors ligne')}
            </Badge>
          )}
        </div>
      </div>
    </section>
  );
}
