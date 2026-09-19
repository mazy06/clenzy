/**
 * Couche de dates dependante de la LANGUE — et du CALENDRIER qui va avec.
 *
 * <p>Jusqu'ici chaque ecran formatait ses dates en dur : {@code format(d, 'MMMM
 * yyyy', { locale: fr })} ou {@code toLocaleDateString('fr-FR')} fige. En arabe,
 * l'interface basculait bien en RTL mais le planning continuait d'afficher
 * « Octobre 2024 » et « JEU 26 » — un calendrier gregorien libelle en francais
 * dans une page arabe.</p>
 *
 * <p>En arabe, Baitly parle donc le calendrier <b>hegirien</b> (variante
 * <i>Umm al-Qura</i>, celle du Royaume d'Arabie saoudite) : l'annee, le mois et
 * le quantieme viennent de ce calendrier, les noms de jours et de mois sont en
 * arabe. Le reste de l'application — bases, API, URL, `Date` JavaScript —
 * continue de raisonner en gregorien : <b>seul l'affichage change</b>. Aucune
 * donnee n'est stockee en hegirien.</p>
 *
 * <h3>Chiffres latins, pas indo-arabes</h3>
 * <p>Les quantiemes sortent en {@code 0-9} et non {@code ٠-٩} : la grille du
 * planning aligne ses colonnes sur des chiffres tabulaires, et les montants
 * (« € 130 ») restent en chiffres latins. Melanger les deux systemes dans une
 * meme rangee casserait l'alignement. L'usage saoudien accepte les deux.</p>
 */
import {
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  format as formatGregorian,
} from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import type { Locale } from 'date-fns';

export type AppLanguage = 'fr' | 'en' | 'ar';

/** Systeme calendaire d'affichage. */
export type CalendarSystem = 'gregory' | 'islamic-umalqura';

/** Quantieme, mois (1-12) et annee dans le calendrier d'affichage. */
export interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

// ─── Normalisation de la langue ─────────────────────────────────────────────

/**
 * Ramene un code i18next (`ar`, `ar-SA`, `fr-FR`…) a l'une des trois langues
 * de l'application. Tout inconnu retombe sur le francais, comme `fallbackLng`.
 */
export function normalizeLanguage(lng: string | undefined | null): AppLanguage {
  const base = (lng ?? '').toLowerCase().split('-')[0];
  if (base === 'ar') return 'ar';
  if (base === 'en') return 'en';
  return 'fr';
}

/** Calendrier d'affichage de la langue. L'arabe seul sort du gregorien. */
export function calendarForLanguage(lng: string | undefined | null): CalendarSystem {
  return normalizeLanguage(lng) === 'ar' ? 'islamic-umalqura' : 'gregory';
}

/** L'arabe est la seule langue de droite a gauche. */
export function isRtlLanguage(lng: string | undefined | null): boolean {
  return normalizeLanguage(lng) === 'ar';
}

/** Locale date-fns correspondante — utilisee pour le rendu gregorien. */
export function dateFnsLocale(lng: string | undefined | null): Locale {
  switch (normalizeLanguage(lng)) {
    case 'ar':
      return arSA;
    case 'en':
      return enUS;
    default:
      return fr;
  }
}

/** Etiquette BCP-47 pour `Intl` — chiffres latins forces cote arabe. */
export function intlLocale(lng: string | undefined | null): string {
  switch (normalizeLanguage(lng)) {
    case 'ar':
      return 'ar-SA-u-ca-islamic-umalqura-nu-latn';
    case 'en':
      return 'en-GB';
    default:
      return 'fr-FR';
  }
}

/**
 * Etiquette `Intl` de la langue, mais TOUJOURS en calendrier gregorien.
 *
 * <p>Pour les series agregees par mois CIVIL cote serveur (analytique,
 * graphiques de revenus, exports comptables) : la langue et les chiffres
 * suivent l'utilisateur, le decoupage reste celui des donnees. Un libelle
 * hegirien y annoncerait un mois que la serie ne suit pas.</p>
 */
export function intlLocaleGregorian(lng: string | undefined | null): string {
  switch (normalizeLanguage(lng)) {
    case 'ar':
      return 'ar-SA-u-ca-gregory-nu-latn';
    case 'en':
      return 'en-GB';
    default:
      return 'fr-FR';
  }
}

// ─── Arithmetique hegirienne ────────────────────────────────────────────────
//
// `Intl` sait CONVERTIR une date mais pas CALCULER : il n'existe pas de
// `startOfMonth` hegirien dans la plateforme. On le reconstruit a partir du
// quantieme, en s'appuyant sur le seul invariant qui compte : un jour hegirien
// et un jour gregorien couvrent la MEME journee civile (Umm al-Qura est un
// calendrier tabule, pas une observation lunaire). Retirer `day - 1` jours
// tombe donc exactement sur le 1er du mois.

/** Formateur numerique mis en cache — instancier `Intl` est couteux. */
const HIJRI_PARTS_FORMAT = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

/** Decoupe une date en quantieme / mois / annee hegiriens. */
export function toHijri(date: Date): CalendarParts {
  const parts = HIJRI_PARTS_FORMAT.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    return found ? parseInt(found.value, 10) : NaN;
  };
  return { year: read('year'), month: read('month'), day: read('day') };
}

/** Premier jour du mois hegirien qui contient `date`. */
export function startOfHijriMonth(date: Date): Date {
  return subDays(date, toHijri(date).day - 1);
}

/**
 * Nombre de jours du mois hegirien qui contient `date` — 29 ou 30.
 *
 * <p>On teste le 30e jour : s'il appartient encore au meme mois, le mois est
 * plein. Aucune table de mois n'est codee en dur, c'est ICU qui tranche.</p>
 */
export function daysInHijriMonth(date: Date): number {
  const start = startOfHijriMonth(date);
  const thirtieth = addDays(start, 29);
  return toHijri(thirtieth).month === toHijri(start).month ? 30 : 29;
}

/** Dernier jour du mois hegirien qui contient `date`. */
export function endOfHijriMonth(date: Date): Date {
  return addDays(startOfHijriMonth(date), daysInHijriMonth(date) - 1);
}

/**
 * Avance (ou recule) de `amount` mois hegiriens, quantieme preserve.
 *
 * <p>Un quantieme qui n'existe pas dans le mois d'arrivee est ramene au dernier
 * jour de celui-ci — un 30 qui atterrit sur un mois de 29 jours donne le 29,
 * comme le fait `addMonths` de date-fns entre le 31 et un mois de 30.</p>
 */
export function addHijriMonths(date: Date, amount: number): Date {
  if (amount === 0) return date;
  const { day } = toHijri(date);
  let monthStart = startOfHijriMonth(date);

  for (let i = 0; i < Math.abs(amount); i++) {
    monthStart =
      amount > 0
        ? addDays(endOfHijriMonth(monthStart), 1)
        : startOfHijriMonth(subDays(monthStart, 1));
  }

  return addDays(monthStart, Math.min(day, daysInHijriMonth(monthStart)) - 1);
}

// ─── Bornes de mois, calendrier courant ─────────────────────────────────────

/** Premier jour du mois AFFICHE (hegirien en arabe, gregorien ailleurs). */
export function startOfDisplayMonth(date: Date, lng: string | undefined | null): Date {
  return calendarForLanguage(lng) === 'islamic-umalqura'
    ? startOfHijriMonth(date)
    : startOfMonth(date);
}

/** Dernier jour du mois AFFICHE. */
export function endOfDisplayMonth(date: Date, lng: string | undefined | null): Date {
  return calendarForLanguage(lng) === 'islamic-umalqura'
    ? endOfHijriMonth(date)
    : endOfMonth(date);
}

/** Avance de `amount` mois dans le calendrier AFFICHE. */
export function addDisplayMonths(date: Date, amount: number, lng: string | undefined | null): Date {
  return calendarForLanguage(lng) === 'islamic-umalqura'
    ? addHijriMonths(date, amount)
    : addMonths(date, amount);
}

/** Quantieme / mois / annee dans le calendrier AFFICHE. */
export function toDisplayParts(date: Date, lng: string | undefined | null): CalendarParts {
  if (calendarForLanguage(lng) === 'islamic-umalqura') return toHijri(date);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

// ─── Formatage ──────────────────────────────────────────────────────────────
//
// Un `Intl.DateTimeFormat` coute cher a construire ; les fonctions ci-dessous
// sont appelees une fois par cellule de grille (plusieurs centaines par rendu).
// On memorise donc chaque formateur par (locale, jeu d'options).

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function intlFormatter(lng: string | undefined | null, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = intlLocale(lng);
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Premier jour de la semaine — 0 = dimanche, 1 = lundi.
 *
 * <p><b>Lundi partout, dimanche en arabe seulement.</b> C'est une decision
 * produit, et non le reflet des locales : `enUS` ouvre sa semaine le dimanche,
 * et s'en remettre a `dateFnsLocale(lng).options.weekStartsOn` faisait basculer
 * l'anglais avec l'arabe. Les grilles restent donc identiques en francais et en
 * anglais ; seul l'arabe se decale, parce que la semaine ouvree y va du
 * dimanche au jeudi et que son week-end doit FERMER la rangee.</p>
 *
 * <p>Source unique : toute grille de sept colonnes passe par ici — le planning
 * (`computeDateRange`) comme la grille mensuelle des tarifs.</p>
 */
export function weekStartsOnForLanguage(lng: string | undefined | null): 0 | 1 {
  return normalizeLanguage(lng) === 'ar' ? 0 : 1;
}

/**
 * Le jour tombe-t-il sur le WEEK-END de la langue active ?
 *
 * <p>La grille du planning teinte ses colonnes de fin de semaine. `isWeekend`
 * de date-fns repond sur le calendrier gregorien et ne connait qu'un seul
 * week-end, samedi-dimanche, quelle que soit la locale passee ailleurs. En
 * arabe la semaine ouvree va du DIMANCHE au JEUDI — c'est deja le cas du debut
 * de semaine de la grille, cale sur dimanche (cf. `computeDateRange`) — et le
 * week-end est donc <b>vendredi et samedi</b>. Les colonnes teintees tombaient
 * sur samedi-dimanche : un dimanche ouvre la semaine en Arabie saoudite, et le
 * vendredi, le jour de la priere collective, passait pour un jour ouvre.</p>
 *
 * <p>Le calendrier hegirien ne change rien ici : il renumerote les jours, il
 * ne change pas leur rang dans la semaine. `getDay()` reste donc la source —
 * un vendredi gregorien est un vendredi hegirien.</p>
 */
export function isDisplayWeekend(date: Date, lng: string | undefined | null): boolean {
  const day = date.getDay();
  // 5 = vendredi, 6 = samedi, 0 = dimanche.
  return normalizeLanguage(lng) === 'ar' ? day === 5 || day === 6 : day === 6 || day === 0;
}

/** Quantieme seul — « 26 » en gregorien, « 23 » en hegirien. */
export function formatDayNumber(date: Date, lng: string | undefined | null): string {
  return String(toDisplayParts(date, lng).day);
}

/**
 * Jour de la semaine abrege pour l'en-tete de grille — « jeu », « Thu », « خ ».
 *
 * <p>L'arabe n'abrege pas ses jours : `short` rend « الخميس » en entier, six
 * fois trop large pour une colonne de 34 px. On prend donc la forme `narrow`,
 * la lettre unique qu'utilisent les calendriers arabes.</p>
 */
export function formatWeekdayShort(date: Date, lng: string | undefined | null): string {
  const isArabic = normalizeLanguage(lng) === 'ar';
  return intlFormatter(lng, { weekday: isArabic ? 'narrow' : 'short' })
    .format(date)
    .replace('.', '');
}

/** Un en-tete de colonne d'une grille de sept jours. */
export interface WeekdayHeader {
  /** Libelle abrege — « lun », « Mon », « ح ». */
  label: string;
  /** La colonne tombe-t-elle sur le week-end de cette langue ? */
  weekend: boolean;
}

/**
 * Les sept en-tetes d'une grille mensuelle, DANS L'ORDRE des colonnes.
 *
 * <p>Chaque grille ecrivait ses initiales a la main, en deux tableaux figes
 * `fr` et `en` : une interface arabe affichait « MON TUE WED » au-dessus de ses
 * colonnes, et le jour de la troisieme colonne dependait d'un debut de semaine
 * ecrit ailleurs. Ici les deux viennent ensemble — l'ordre suit
 * `weekStartsOnForLanguage`, les libelles viennent d'`Intl`.</p>
 *
 * <p>L'ancre est un DIMANCHE connu, le 7 janvier 2024 : `+ i` parcourt alors la
 * semaine sans dependre de la date du jour.</p>
 */
export function weekdayHeaders(
  lng: string | undefined | null,
  width: 'narrow' | 'short' = 'short',
): WeekdayHeader[] {
  const start = weekStartsOnForLanguage(lng);
  // L'arabe n'abrege pas ses jours : `short` y rend « الخميس » en entier, six
  // fois trop large pour une colonne. Meme arbitrage que formatWeekdayShort.
  const effective = normalizeLanguage(lng) === 'ar' ? 'narrow' : width;
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(2024, 0, 7 + ((start + i) % 7), 12);
    return {
      label: intlFormatter(lng, { weekday: effective }).format(date).replace('.', ''),
      weekend: isDisplayWeekend(date, lng),
    };
  });
}

/** Mois + annee — « octobre 2024 », « ربيع الآخر 1446 هـ ». */
export function formatMonthYear(date: Date, lng: string | undefined | null): string {
  return intlFormatter(lng, { month: 'long', year: 'numeric' }).format(date);
}

/**
 * Mois + annee en forme courte — « oct. 2024 ».
 *
 * <p>Le libelle du mois vit dans une boite de largeur fixe : « Septembre 2026 »
 * reclamait une quarantaine de pixels de plus que « Aout 2026 », la barre
 * debordait et la grille perdait une ligne. Le mois ne decide pas du nombre de
 * logements affiches.</p>
 *
 * <p>L'arabe ne raccourcit pas ses mois : `short` et `long` y rendent le meme
 * texte. La boite est dimensionnee pour le plus large des deux.</p>
 */
export function formatMonthYearShort(date: Date, lng: string | undefined | null): string {
  return intlFormatter(lng, { month: 'short', year: 'numeric' }).format(date);
}

/** Date complete pour infobulle — « lundi 18 mai 2026 ». */
export function formatFullDate(date: Date, lng: string | undefined | null): string {
  return intlFormatter(lng, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Jour + mois abrege + annee — « 15 juin 2025 », « 12 اوت 1446 هـ ».
 *
 * <p>La forme longue des entetes et des recapitulatifs de sejour, la ou
 * `formatShortDate` (tout en chiffres) serait illisible.</p>
 */
export function formatDayMonthYearShort(date: Date, lng: string | undefined | null): string {
  return intlFormatter(lng, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** Date courte — « 18/05/2026 ». */
export function formatShortDate(date: Date, lng: string | undefined | null): string {
  return intlFormatter(lng, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

/** Jour + mois, sans annee — « 18 mai ». */
export function formatDayMonth(date: Date, lng: string | undefined | null): string {
  return intlFormatter(lng, { day: 'numeric', month: 'long' }).format(date);
}

/**
 * Jour + mois abrege — « 18 sept. », « 1 janv. ».
 *
 * <p>Pour les jalons et les etiquettes serrees, ou « 1 septembre » prendrait
 * deux fois la place. L'arabe n'abrege pas ses mois : `short` y rend le meme
 * texte que `long`.</p>
 */
export function formatDayMonthShort(date: Date, lng: string | undefined | null): string {
  return intlFormatter(lng, { day: 'numeric', month: 'short' }).format(date);
}

/**
 * Motif date-fns libre, localise — pour les formats sans equivalent `Intl`
 * (« EEEE » seul, « HH:mm », motifs composes).
 *
 * <p><b>Gregorien uniquement.</b> En arabe, les jetons d'annee, de mois et de
 * quantieme sortiraient en gregorien : n'employer cette fonction que pour des
 * motifs d'HEURE, ou passer par les fonctions ci-dessus.</p>
 */
export function formatPattern(date: Date, pattern: string, lng: string | undefined | null): string {
  return formatGregorian(date, pattern, { locale: dateFnsLocale(lng) });
}
