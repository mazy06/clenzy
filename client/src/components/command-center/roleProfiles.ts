/**
 * Profils métier — le « adapté au métier » du centre de commande.
 *
 * <p>Les habitudes (cf. `useCommandHabits`) personnalisent la palette au fil de
 * l'usage, mais elles sont vides au premier lancement : c'est précisément le
 * moment où l'utilisateur a le plus besoin d'être guidé. Ces profils donnent
 * donc un classement de départ par métier, que l'usage réel écrase ensuite.</p>
 *
 * <p>L'ordre compte : c'est l'ordre d'affichage des suggestions. Chaque entrée
 * est un identifiant de commande du catalogue (`buildCommands.ts`) ; une
 * commande inaccessible pour l'utilisateur est simplement ignorée.</p>
 */

/** Rôle → commandes mises en avant, de la plus au moins pertinente. */
export const ROLE_SUGGESTIONS: Record<string, string[]> = {
  // Exploitant : sa journée commence par ce qui arrive et par le planning.
  HOST: [
    'nav:/planning',
    'nav:/reservations',
    'nav:/properties',
    'action:intervention.create',
    'nav:/billing',
  ],
  // Terrain : ses missions, l'agenda, et le signalement d'un problème.
  TECHNICIAN: [
    'nav:/interventions',
    'nav:/planning',
    'action:service-request.create',
    'nav:/properties',
  ],
  HOUSEKEEPER: [
    'nav:/interventions',
    'nav:/planning',
    'action:service-request.create',
    'nav:/properties',
  ],
  LAUNDRY: ['nav:/interventions', 'nav:/planning'],
  EXTERIOR_TECH: ['nav:/interventions', 'nav:/planning', 'action:service-request.create'],
  // Supervision : la vue d'ensemble des équipes et des missions.
  SUPERVISOR: [
    'nav:/planning',
    'nav:/interventions',
    'nav:/directory',
    'nav:/reservations',
    'nav:/reports',
  ],
  // Plateforme : santé du système avant tout.
  SUPER_ADMIN: [
    'nav:/dashboard',
    'nav:/admin/monitoring',
    'nav:/admin/sync',
    'nav:/directory',
    'nav:/reports',
  ],
  SUPER_MANAGER: [
    'nav:/dashboard',
    'nav:/reservations',
    'nav:/directory',
    'nav:/reports',
    'nav:/billing',
  ],
};

/** Repli quand aucun rôle connu ne correspond. */
const FALLBACK_SUGGESTIONS = [
  'nav:/dashboard',
  'nav:/planning',
  'nav:/reservations',
  'nav:/properties',
];

/**
 * Suggestions de départ pour un utilisateur, dédupliquées dans l'ordre de ses
 * rôles (un compte cumulant SUPERVISOR et HOST voit d'abord la supervision,
 * puis ce que HOST ajoute).
 */
export function defaultSuggestionsForRoles(roles: string[]): string[] {
  const ordered = roles.flatMap((role) => ROLE_SUGGESTIONS[role] ?? []);
  const list = ordered.length > 0 ? ordered : FALLBACK_SUGGESTIONS;
  return Array.from(new Set(list));
}
