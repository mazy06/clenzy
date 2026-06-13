/**
 * Échéance opérationnelle relative pour les cartes interventions / demandes de
 * service : « En retard de N j », « Aujourd'hui », « Demain », « Dans N j » ou
 * date courte. Le `tone` pilote la couleur (retard → err, proche → warn).
 */
export type DueTone = 'overdue' | 'soon' | 'normal';

type Translate = (key: string, options?: { count?: number }) => string;

export function getDueMeta(
  iso: string | undefined | null,
  t: Translate,
): { label: string; tone: DueTone } {
  if (!iso) return { label: '—', tone: 'normal' };
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return { label: '—', tone: 'normal' };
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return { label: t('interventions.due.overdue', { count: -days }), tone: 'overdue' };
  if (days === 0) return { label: t('interventions.due.today'), tone: 'soon' };
  if (days === 1) return { label: t('interventions.due.tomorrow'), tone: 'soon' };
  if (days <= 7) return { label: t('interventions.due.inDays', { count: days }), tone: 'normal' };
  return { label: target.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), tone: 'normal' };
}

/** Couleur (token) associée au `tone` d'échéance. */
export function dueToneColor(tone: DueTone): string {
  return tone === 'overdue' ? 'var(--err)' : tone === 'soon' ? 'var(--warn)' : 'var(--ink)';
}
