/**
 * Voix off de la démo du planning (page PMS & channel manager).
 *
 * <p>Chaque phrase est enregistrée en MP3 dans
 * `assets/voice/planning-demo/<langue>/NN.mp3` : voix Paul K (ElevenLabs
 * `ecxPjiGTvAfpGEams6ec`, Eleven v4, stabilité 0,35), celle du premier épisode
 * de Baitly Académie ; « Bètli » pour la prononciation française. Modifier une
 * phrase impose de régénérer son clip et de remesurer ses repères dans
 * `PLANNING_VOICE_CUES` (`AnimatedPlanningMockup.tsx`). L'arabe n'a pas de voix
 * et suit le rythme français.</p>
 */
export const PLANNING_VOICE_TEXT = {
  fr: [
    'Voici le planning Bètli. Un clic sur un logement ouvre sa fiche : capacité, horaires d’arrivée, tarifs et performances… sans quitter le planning.',
    'Besoin d’y voir plus clair ? Je masque Airbnb : il ne reste que les autres réservations. Un second clic, et tous les séjours reviennent.',
    'Je tente de déplacer ce séjour sur des dates déjà prises. Bètli refuse le chevauchement : la réservation reprend sa place.',
    'Sur des dates libres, en revanche, aucun souci. Je glisse le séjour de Mia : il commence deux jours plus tard.',
    'Luca veut rester plus longtemps ? J’étire son séjour de deux nuits. Le ménage suit automatiquement la réservation.',
    'Ce repère signale une information manquante. J’ouvre la fiche de Kenji, j’ajoute son e-mail, j’enregistre : l’alerte disparaît.',
    'Place à une réservation directe. Je sélectionne trois nuits libres sur la ligne du logement.',
    'Les dates et le tarif sont déjà remplis. Je cherche Sarah… je sélectionne sa fiche… et je crée la réservation.',
    'Et voilà ! Le séjour de Sarah apparaît dans le planning, et l’occupation se met à jour. Sans aucune ressaisie.',
  ],
  en: [
    'This is the Baitly calendar. One click on a property opens its details: capacity, check-in times, rates and performance… without leaving the calendar.',
    'Need a clearer view? I hide Airbnb: only the other bookings remain. One more click, and every stay comes back.',
    'I try to move this stay onto dates that are already taken. Baitly blocks the overlap: the booking snaps back into place.',
    'On free dates, though, no problem at all. I drag Mia’s stay: it now starts two days later.',
    'Luca wants to stay longer? I stretch his booking by two nights. Cleaning follows the booking automatically.',
    'This marker flags missing information. I open Kenji’s profile, add his email, save: the alert disappears.',
    'Time for a direct booking. I select three free nights on the property’s row.',
    'Dates and rate are already filled in. I search for Sarah… select her profile… and create the booking.',
    'And there it is! Sarah’s stay appears in the calendar, and occupancy updates. No retyping, at all.',
  ],
} as const;
