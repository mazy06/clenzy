/**
 * Familles de métiers du terrain.
 *
 * <p>`PermissionInitializer` donne exactement les mêmes permissions à
 * TECHNICIAN et HOUSEKEEPER : `interventions:view`, `teams:view`,
 * `contact:view`, `dashboard:view`. Rien ne les distingue à ce niveau — la
 * séparation ne peut donc venir que du <b>rôle</b>, et elle doit être écrite à
 * un seul endroit sous peine de dériver d'un écran à l'autre.</p>
 *
 * <p>Les deux familles n'ont ni le même écran de tarifs, ni le même score, ni
 * le même circuit de paiement :</p>
 * <ul>
 *   <li><b>Ménage</b> — forfaits par logement, score qualité (calculé sur les
 *       seuls types CLEANING / EXPRESS_CLEANING / DEEP_CLEANING) et versements
 *       automatiques via `HousekeeperPayoutService`.</li>
 *   <li><b>Travaux</b> — catalogue de prestations avec ses prix, et devis. Le
 *       score et les versements ménage ne les concernent pas : le service de
 *       payout sort immédiatement sur un type maintenance, et le score ne
 *       compte que des interventions de ménage. Les afficher revenait à
 *       promettre un 0 définitif.</li>
 * </ul>
 */

/** Payés à la mission via le circuit ménage : score, forfaits, versements Stripe. */
export const CLEANING_ROLES = ['HOUSEKEEPER', 'LAUNDRY'] as const;

/** Métiers de travaux : catalogue de prestations et devis. */
export const TRADE_ROLES = ['TECHNICIAN', 'EXTERIOR_TECH'] as const;

/** Tous ceux qui interviennent sur le terrain, quelle que soit la famille. */
export const FIELD_ROLES = [...CLEANING_ROLES, ...TRADE_ROLES] as const;
