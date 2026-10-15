import { planningDemo } from '@/screens/manager/planningModel';
import type { BaitlyDemoProfileKey } from '@/config/baitlyDemoProfileState';

const activities = {
  cleaning: ['Préparation avant arrivée', 'Ménage après départ', 'Contrôle de l’inventaire', 'Nettoyage des espaces communs'],
  maintenance: ['Réparation d’une serrure', 'Contrôle climatisation', 'Recherche de fuite', 'Remplacement d’un luminaire'],
  laundry: ['Collecte du linge', 'Lavage et contrôle qualité', 'Livraison de draps propres', 'Préparation des kits voyageurs'],
  exterior: ['Entretien de la piscine', 'Taille des haies', 'Contrôle de l’arrosage', 'Nettoyage de la terrasse'],
};
export function demoMissionsForProfile(date: string, key?: BaitlyDemoProfileKey | null) {
  const tasks = key && key in activities ? activities[key as keyof typeof activities] : undefined;
  const reviews = key === 'owner' || key === 'concierge' ? [
    { ...planningDemo(date)[0], id: -2001, status: 'AWAITING_VALIDATION', title: 'Ménage terminé', type: 'CLEANING' },
    { ...planningDemo(date)[2], id: -2002, status: 'AWAITING_VALIDATION', title: 'Maintenance terminée' },
  ] : [];
  return [...planningDemo(date), ...reviews].map((mission, index) => tasks ? {
    ...mission, title: tasks[index],
    description: `${tasks[index]} pour ${mission.propertyName}. Consignes et accès disponibles dans la fiche de mission.`,
    assignedTechnicianName: undefined,
    type: key === 'cleaning' ? 'CLEANING' : key === 'laundry' ? 'LAUNDRY' : 'MAINTENANCE',
  } : mission);
}
