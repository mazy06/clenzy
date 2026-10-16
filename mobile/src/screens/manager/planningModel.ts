import type { Intervention } from '@/api/endpoints/interventionsApi';

/** Local calendar dates must not shift when the device is ahead of UTC. */
export function planningDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function planningHour(value: string | undefined, locale: string) {
  if (!value) return '···';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '···' : date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
export function planningDemo(date: string): Intervention[] {
  return [
    { title: 'Préparation avant arrivée', propertyName: 'Dar Zellige · Démo', assignedTechnicianName: 'Salma · Démo', startTime: '09:00', status: 'COMPLETED', description: 'Linge remplacé, inventaire vérifié et logement prêt.' },
    { title: 'Entretien piscine', propertyName: 'Villa Ourika · Démo', assignedTechnicianName: 'Youssef · Démo', startTime: '11:30', status: 'IN_PROGRESS', description: 'Nettoyage du bassin et contrôle de la filtration.' },
    { title: 'Contrôle climatisation', propertyName: 'Riad Horizon · Démo', assignedTechnicianName: 'Amine · Démo', startTime: '14:00', status: 'SCHEDULED', description: 'Vérifier les filtres et le fonctionnement avant le prochain séjour.' },
    { title: 'Ménage après départ', propertyName: 'Appartement Majorelle · Démo', startTime: '16:00', status: 'PENDING', description: 'Mission à attribuer à une équipe disponible.' },
  ].map((item, index) => ({ ...item, id: -1001 - index, type: 'MAINTENANCE', priority: 'NORMAL', isUrgent: false, requiresFollowUp: false, scheduledDate: date, createdAt: `${date}T08:00:00`, updatedAt: `${date}T08:00:00` }));
}
