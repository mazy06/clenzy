import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { reservationsApi, guestsApi, propertiesApi, calendarPricingApi } from '../../services/api';
import { touristTaxApi } from '../../services/api/touristTaxApi';
import type {
  Reservation,
  ReservationStatus,
  CreateReservationData,
  UpdateReservationData,
  GuestDto,
  CreateGuestData,
  Property,
} from '../../services/api';
import { planningKeys } from '../../modules/planning/hooks/usePlanningData';
import { reservationsKeys } from '../../hooks/useReservations';
import type { PlanningEvent } from '../../modules/planning/types';

// ─── Types publics ────────────────────────────────────────────────────────────

/** Propriété imposée (contexte Planning). */
export interface LockedProperty {
  id: number;
  name: string;
  nightlyPrice?: number;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  cleaningBasePrice?: number;
  cleaningFrequency?: string;
}

export interface ReservationDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** Propriété imposée (Planning). Absente en création → sélecteur de propriété. */
  lockedProperty?: LockedProperty;
  /** Dates présélectionnées (Planning : clic Gantt). */
  initialDates?: { checkIn: string; checkOut: string };
  /** Édition : la réservation à modifier. */
  reservation?: Reservation | null;
  /** Détection de conflits (Planning). */
  events?: PlanningEvent[];
  onCreated?: (r: Reservation) => void;
  onUpdated?: (r: Reservation) => void;
}

export type PricingMode = 'custom' | 'discount_euro' | 'discount_percent';

/**
 * Intention à la création (source directe) — remplace le toggle brut pending/confirmed.
 * `confirm_now` → statut `confirmed` : bloque le calendrier, génère les codes, notifie.
 * `request_payment` → statut `pending` + envoi d'un lien de paiement Stripe au voyageur ;
 * les dates ne se bloquent qu'une fois le paiement reçu (passage auto en confirmed).
 */
export type PaymentIntent = 'confirm_now' | 'request_payment';

/** Voyageur unifié : GuestDto lié (id) OU affichage prérempli depuis la résa (sans id). */
export interface GuestLike {
  id?: number;
  fullName: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  language?: string;
  notes?: string;
}

const CREATE_STATUSES: ReservationStatus[] = ['pending', 'confirmed'];
const EDIT_STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random confirmation code for direct reservations */
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `DIR-${code}`;
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Dates des nuits facturées : [checkIn .. checkOut-1] (le départ n'est pas facturé). */
function enumerateNights(checkIn: string, checkOut: string): string[] {
  if (!checkIn || !checkOut) return [];
  const out: string[] = [];
  const cur = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  while (cur < end) {
    out.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ─── Résultat du hook ─────────────────────────────────────────────────────────

export interface UseReservationFormResult {
  // Flags
  isEdit: boolean;
  isExternalSource: boolean;
  showPropertySelector: boolean;
  isPlatformStaff: boolean;
  fieldsLocked: boolean;

  // Dates & heures
  startDate: string;
  endDate: string;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
  checkInTime: string;
  checkOutTime: string;
  setCheckInTime: (v: string) => void;
  setCheckOutTime: (v: string) => void;
  numberOfNights: number;
  nightsText: string;
  locale: string;
  weekdayLabels: string[];

  // Propriété
  propertyId: number | '';
  setPropertyId: (id: number) => void;
  properties: Property[];
  propertiesLoading: boolean;
  propertyName: string;
  effectivePropertyId: number | undefined;

  // Voyageur
  selectedGuest: GuestLike | null;
  setSelectedGuest: (g: GuestLike | null) => void;
  clearGuest: () => void;
  guestSearchQuery: string;
  setGuestSearchQuery: (v: string) => void;
  debouncedSearch: string;
  searchResults: GuestDto[];
  isSearching: boolean;
  showCreateGuestForm: boolean;
  setShowCreateGuestForm: (b: boolean) => void;
  newGuestFirstName: string;
  setNewGuestFirstName: (v: string) => void;
  newGuestLastName: string;
  setNewGuestLastName: (v: string) => void;
  newGuestEmail: string;
  setNewGuestEmail: (v: string) => void;
  newGuestPhone: string;
  setNewGuestPhone: (v: string) => void;
  newGuestCountry: string;
  setNewGuestCountry: (v: string) => void;
  newGuestLanguage: string;
  setNewGuestLanguage: (v: string) => void;
  newGuestNotes: string;
  setNewGuestNotes: (v: string) => void;
  handleCreateGuest: () => void;
  createGuestPending: boolean;
  createGuestError: boolean;

  // Occupation
  guestCount: number;
  setGuestCount: React.Dispatch<React.SetStateAction<number>>;
  childrenCount: number;
  setChildrenCount: (n: number) => void;

  // Tarification (prix dynamique par nuit — création)
  /** Moyenne /nuit dérivée du moteur (lecture seule). */
  baseNightlyAvg: number;
  /** Total hébergement AVANT override (somme des prix/nuit). */
  baseAccommodationTotal: number;
  /** Vrai si au moins 2 prix/nuit distincts. */
  priceVaries: boolean;
  /** Prix de chaque nuit facturée (aligné sur nightDates). */
  nightlyPrices: number[];
  /** Dates des nuits facturées [checkIn..checkOut-1]. */
  nightDates: string[];
  /** Chargement du prix dynamique. */
  pricingLoading: boolean;
  pricingMode: PricingMode;
  selectPricingMode: (m: PricingMode) => void;
  pricingValue: string;
  setPricingValue: (v: string) => void;
  pricingLabel: string;
  accommodationTotal: number;
  totalPrice: number;

  // Ménage / taxe / code / notes
  createCleaning: boolean;
  setCreateCleaning: (b: boolean) => void;
  cleaningFee: string;
  setCleaningFee: (v: string) => void;
  cleaningFeeAmount: number;
  estimatedCleaningPrice: number | undefined;
  touristTaxPerPerson: string;
  setTouristTaxPerPerson: (v: string) => void;
  touristTaxAmount: number;
  confirmationCode: string;
  setConfirmationCode: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;

  // Statut
  status: ReservationStatus;
  setStatus: (s: ReservationStatus) => void;
  statuses: ReservationStatus[];
  /** Intention à la création (source directe) — pilote le statut + l'envoi du lien de paiement. */
  paymentIntent: PaymentIntent;
  setPaymentIntent: (p: PaymentIntent) => void;
  /** Vrai si (création && intention = demander le paiement). */
  requestPayment: boolean;
  /** Email destinataire du lien de paiement (override éditable). */
  paymentEmail: string;
  setPaymentEmail: (v: string) => void;

  // Conflits / erreur / soumission
  conflictWarnings: string[];
  hasConflict: boolean;
  error: string | null;
  submitDisabled: boolean;
  saving: boolean;
  handleSubmit: () => void;

  // Entête
  headerTitle: string;
  sourceKey: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReservationForm(props: ReservationDialogProps): UseReservationFormResult {
  const { open, onClose, mode, lockedProperty, initialDates, reservation, events, onCreated, onUpdated } = props;

  const queryClient = useQueryClient();
  const { t, isEnglish, isArabic } = useTranslation();
  const { user } = useAuth();

  const isEdit = mode === 'edit';
  const isExternalSource = isEdit && !!reservation && reservation.source !== 'direct';
  const showPropertySelector = mode === 'create' && !lockedProperty;
  const isPlatformStaff = user?.platformRole === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_MANAGER';

  // ── State ────────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [propertyId, setPropertyIdState] = useState<number | ''>('');
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<GuestLike | null>(null);
  const [showCreateGuestForm, setShowCreateGuestForm] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState('');
  const [newGuestLastName, setNewGuestLastName] = useState('');
  const [newGuestEmail, setNewGuestEmail] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestCountry, setNewGuestCountry] = useState('');
  const [newGuestLanguage, setNewGuestLanguage] = useState('fr');
  const [newGuestNotes, setNewGuestNotes] = useState('');
  const [pricingMode, setPricingMode] = useState<PricingMode>('custom');
  const [pricingValue, setPricingValue] = useState('');
  const [status, setStatus] = useState<ReservationStatus>('pending');
  const [checkInTime, setCheckInTime] = useState('15:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [createCleaning, setCreateCleaning] = useState(false);
  const [cleaningFee, setCleaningFee] = useState('');
  const [touristTaxPerPerson, setTouristTaxPerPerson] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Intention de création (source directe). Ignorée en édition (le statut vient du sélecteur).
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent>('confirm_now');
  // Email destinataire du lien de paiement (override). Prérempli depuis le voyageur,
  // éditable — le backend `sendPaymentLink` accepte une adresse différente.
  const [paymentEmail, setPaymentEmail] = useState('');
  // Id de la résa déjà créée si l'envoi du lien de paiement a échoué après création —
  // évite de re-créer un doublon quand l'utilisateur réessaie (on ne renvoie que le lien).
  const createdIdRef = useRef<number | null>(null);
  // Voyageur déjà upserté (création/màj de la fiche au submit) — garde anti-doublon :
  // si la création de la résa échoue après l'upsert, un retry ne ré-upserte pas.
  const upsertedGuestRef = useRef<GuestDto | null>(null);

  const setPropertyId = useCallback((id: number) => setPropertyIdState(id), []);

  // Préremplit l'email du lien de paiement depuis l'email saisi du voyageur (tant que non
  // édité à la main). L'email voyageur vit désormais dans le formulaire éditable (newGuestEmail).
  useEffect(() => {
    if (newGuestEmail.trim()) setPaymentEmail((prev) => (prev.trim() ? prev : newGuestEmail.trim()));
  }, [newGuestEmail]);

  // Sélection d'un voyageur existant → préremplit les champs ÉDITABLES depuis sa fiche
  // (l'utilisateur peut ensuite compléter/modifier ; l'upsert au submit fera un update).
  useEffect(() => {
    if (!selectedGuest?.id) return;
    setNewGuestFirstName(selectedGuest.firstName ?? '');
    setNewGuestLastName(selectedGuest.lastName ?? '');
    setNewGuestEmail(selectedGuest.email ?? '');
    setNewGuestPhone(selectedGuest.phone ?? '');
    setNewGuestCountry(selectedGuest.countryCode ?? '');
    setNewGuestLanguage(selectedGuest.language ?? 'fr');
    setNewGuestNotes(selectedGuest.notes ?? '');
  }, [selectedGuest]);

  // ── Properties list (create-selector only) ─────────────────────────────
  const propertiesQuery = useQuery({
    queryKey: ['reservation-dialog-properties'],
    queryFn: () => propertiesApi.getAll({ size: 500 }),
    staleTime: 120_000,
    enabled: open && showPropertySelector,
  });

  // ── Effective property id (locked > edit > selected) ───────────────────
  const effectivePropertyId = lockedProperty?.id
    ?? (isEdit ? reservation?.propertyId : (typeof propertyId === 'number' ? propertyId : undefined));

  // Fresh property details (nightlyPrice + cleaning fallback)
  const freshPropertyQuery = useQuery({
    queryKey: ['reservation-dialog-property-fresh', effectivePropertyId],
    queryFn: () => propertiesApi.getById(effectivePropertyId!),
    enabled: !!effectivePropertyId && open,
    staleTime: 30_000,
  });
  const freshProp = freshPropertyQuery.data;

  // Barème taxe de séjour (TouristTaxConfig) — pour préremplir le taux /pers/nuit.
  // Résolution : override du bien sinon barème par défaut de l'org (propertyId null).
  const taxConfigsQuery = useQuery({
    queryKey: ['reservation-dialog-tax-configs'],
    queryFn: () => touristTaxApi.getConfigs(),
    enabled: open && !isEdit && !!effectivePropertyId,
    staleTime: 5 * 60_000,
  });
  const effectiveTaxConfig = useMemo(() => {
    const configs = taxConfigsQuery.data ?? [];
    return (
      configs.find((c) => c.propertyId === effectivePropertyId)
      ?? configs.find((c) => c.propertyId === null)
      ?? null
    );
  }, [taxConfigsQuery.data, effectivePropertyId]);

  // Prix dynamique par nuit (PriceEngine) — CRÉATION uniquement. En édition, la
  // tarification reste sur le comportement existant (query désactivée).
  const dynamicPricingQuery = useQuery({
    queryKey: ['reservation-dialog-dynamic-pricing', effectivePropertyId, startDate, endDate],
    queryFn: () => calendarPricingApi.getPricing(effectivePropertyId!, startDate, endDate),
    enabled: open && !isEdit && !!effectivePropertyId && !!startDate && !!endDate,
    staleTime: 30_000,
  });

  // Estimation du coût de ménage — prix résolu par CleaningPricingEngine côté
  // backend : tarif prestataire (FLAT/HOURLY) > prix ménage du logement > conseil
  // moteur (minutes normées × taux horaire, arrondi 5 €, plancher 30 €).
  // Création uniquement ; montant proposé (éditable) dans la modale.
  const cleaningEstimateQuery = useQuery({
    queryKey: ['reservation-dialog-cleaning-estimate', effectivePropertyId],
    queryFn: () => propertiesApi.getCleaningEstimate(effectivePropertyId!),
    enabled: open && !isEdit && !!effectivePropertyId,
    staleTime: 60_000,
  });

  // Auto-select first property for non-platform staff (create-selector)
  useEffect(() => {
    if (!open || !showPropertySelector) return;
    const list = propertiesQuery.data;
    if (!isPlatformStaff && list && list.length > 0 && propertyId === '') {
      setPropertyIdState(list[0].id);
    }
  }, [open, showPropertySelector, isPlatformStaff, propertiesQuery.data, propertyId]);

  // ── Init state on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (isEdit && reservation) {
      const nights = daysBetween(reservation.checkIn, reservation.checkOut);
      setPropertyIdState(reservation.propertyId);
      setStartDate(reservation.checkIn);
      setEndDate(reservation.checkOut);
      setCheckInTime(reservation.checkInTime ?? '15:00');
      setCheckOutTime(reservation.checkOutTime ?? '11:00');
      setStatus(reservation.status);
      setSelectedGuest({ fullName: reservation.guestName, email: reservation.guestEmail, phone: reservation.guestPhone });
      setGuestCount(reservation.guestCount || 1);
      setChildrenCount(reservation.childrenCount ?? 0);
      setConfirmationCode(reservation.confirmationCode ?? '');
      setNotes(reservation.notes ?? '');
      setCreateCleaning(false);
      setCleaningFee('');
      setTouristTaxPerPerson('');
      setPricingMode('custom');
      setPricingValue(nights > 0 && reservation.totalPrice ? (reservation.totalPrice / nights).toFixed(2) : '');
      setGuestSearchQuery('');
      setShowCreateGuestForm(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestPhone('');
      setNewGuestCountry('');
      setNewGuestLanguage('fr');
      setNewGuestNotes('');
      setError(null);
      return;
    }

    // ── Création ──
    const defaultCheckIn = lockedProperty?.defaultCheckInTime ?? '15:00';
    const defaultCheckOut = lockedProperty?.defaultCheckOutTime ?? '11:00';

    let adjustedStartDate = initialDates?.checkIn ?? '';
    let adjustedEndDate = initialDates?.checkOut ?? '';
    let adjustedCheckInTime = defaultCheckIn;

    // Auto-ajuste le début après le dernier évènement en conflit (clic Gantt).
    if (lockedProperty && initialDates && events && events.length > 0) {
      const toTs = (date: string, time?: string) => (time ? `${date} ${time}` : date);
      const sameProp = events.filter((e) => e.propertyId === lockedProperty.id);
      let latestEndTs = '';
      let latestEndDate = '';
      let latestEndTime = '';
      const rangeStart = toTs(initialDates.checkIn, defaultCheckIn);
      const rangeEnd = toTs(initialDates.checkOut, defaultCheckOut);
      for (const evt of sameProp) {
        const evtEnd = toTs(evt.endDate, evt.endTime);
        const evtStart = toTs(evt.startDate, evt.startTime);
        if (evtStart < rangeEnd && evtEnd > rangeStart && evtEnd > latestEndTs) {
          latestEndTs = evtEnd;
          latestEndDate = evt.endDate;
          latestEndTime = evt.endTime || '';
        }
      }
      if (latestEndTs && latestEndDate) {
        adjustedStartDate = latestEndDate;
        if (latestEndTime) {
          adjustedCheckInTime = latestEndTime > defaultCheckIn ? latestEndTime : defaultCheckIn;
        }
        if (adjustedStartDate >= initialDates.checkOut) {
          adjustedStartDate = initialDates.checkOut;
          const newEnd = new Date(initialDates.checkOut);
          newEnd.setDate(newEnd.getDate() + 1);
          adjustedEndDate = newEnd.toISOString().split('T')[0];
        }
      }
    }

    setStartDate(adjustedStartDate);
    setEndDate(adjustedEndDate);
    setCheckInTime(adjustedCheckInTime);
    setCheckOutTime(defaultCheckOut);
    setStatus('confirmed'); // non affiché en création (le statut dérive de paymentIntent)
    setPaymentIntent('confirm_now');
    setPaymentEmail('');
    createdIdRef.current = null;
    upsertedGuestRef.current = null;
    setCreateCleaning(lockedProperty?.cleaningFrequency?.toUpperCase() === 'AFTER_EACH_STAY');
    setCleaningFee(lockedProperty?.cleaningBasePrice ? String(lockedProperty.cleaningBasePrice) : '');
    setTouristTaxPerPerson('');
    setConfirmationCode(generateConfirmationCode());
    setSelectedGuest(null);
    setGuestSearchQuery('');
    setShowCreateGuestForm(false);
    setNewGuestFirstName('');
    setNewGuestLastName('');
    setNewGuestEmail('');
    setNewGuestPhone('');
    setNewGuestCountry('');
    setNewGuestLanguage('fr');
    setNewGuestNotes('');
    setPricingMode('custom');
    setPricingValue('');
    setGuestCount(2);
    setChildrenCount(0);
    setNotes('');
    setError(null);
    if (!lockedProperty) setPropertyIdState('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, reservation, lockedProperty, initialDates, events]);

  // Frais de ménage : prix proposé = VRAI estimateur d'intervention backend (endpoint
  // /pricing-config/cleaning-estimate). Création uniquement, tant que l'utilisateur
  // n'a pas saisi de valeur. Le toggle « ménage au départ » suit cleaningFrequency.
  const cleaningEstimate = cleaningEstimateQuery.data;
  useEffect(() => {
    if (!open || isEdit) return;
    if (!cleaningFee && cleaningEstimate != null) {
      setCleaningFee(String(cleaningEstimate));
    }
    if (!createCleaning && freshProp?.cleaningFrequency?.toUpperCase() === 'AFTER_EACH_STAY') {
      setCreateCleaning(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleaningEstimate, freshProp, open, isEdit]);

  // Préremplit le taux de taxe de séjour /pers/nuit depuis le barème (mode PER_PERSON_PER_NIGHT).
  // Le champ reste éditable (override par réservation). Autres modes (%, forfait) : non préremplis
  // (le champ /pers/nuit ne les représente pas) — l'utilisateur saisit à la main si besoin.
  useEffect(() => {
    if (!open || isEdit || !effectiveTaxConfig) return;
    if (
      !touristTaxPerPerson
      && effectiveTaxConfig.enabled
      && effectiveTaxConfig.calculationMode === 'PER_PERSON_PER_NIGHT'
      && effectiveTaxConfig.ratePerPerson != null
    ) {
      setTouristTaxPerPerson(String(effectiveTaxConfig.ratePerPerson));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTaxConfig, open, isEdit]);

  // ── Conflict detection (Planning only, when events provided) ────────────
  const conflictWarnings = useMemo(() => {
    if (!events || events.length === 0 || !effectivePropertyId || !startDate || !endDate) return [];
    const warnings: string[] = [];
    const toTs = (date: string, time?: string) => (time ? `${date} ${time}` : date);
    const newStart = toTs(startDate, checkInTime);
    const newEnd = toTs(endDate, checkOutTime);

    const sameProp = events.filter((e) => {
      if (e.propertyId !== effectivePropertyId) return false;
      if (isEdit && reservation && e.reservation?.id === reservation.id) return false;
      return true;
    });

    for (const evt of sameProp) {
      const evtStart = toTs(evt.startDate, evt.startTime);
      const evtEnd = toTs(evt.endDate, evt.endTime);
      if (newStart < evtEnd && evtStart < newEnd) {
        const range = {
          start: `${evt.startDate}${evt.startTime ? ' ' + evt.startTime : ''}`,
          end: `${evt.endDate}${evt.endTime ? ' ' + evt.endTime : ''}`,
        };
        if (evt.type === 'reservation') {
          warnings.push(t('reservations.dialog.conflictReservation', { name: evt.label, start: evt.startDate, end: evt.endDate }));
        } else if (evt.type === 'cleaning') {
          warnings.push(t('reservations.dialog.conflictCleaning', range));
        } else if (evt.type === 'maintenance') {
          warnings.push(t('reservations.dialog.conflictMaintenance', range));
        } else {
          warnings.push(t('reservations.dialog.conflictBlocked', { start: evt.startDate, end: evt.endDate }));
        }
      }
    }
    return warnings;
  }, [events, effectivePropertyId, startDate, endDate, checkInTime, checkOutTime, isEdit, reservation, t]);

  const hasConflict = conflictWarnings.length > 0;

  // ── Computed values ──────────────────────────────────────────────────────
  const numberOfNights = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);
  const minors = useMemo(() => Math.min(Math.max(0, childrenCount), guestCount), [childrenCount, guestCount]);
  const taxableGuests = guestCount - minors;

  // Prix plat de repli (propriété) — utilisé par nuit si le moteur ne renvoie pas
  // de prix pour une date, et globalement tant que la query n'a pas de données.
  const flatNightlyFallback = lockedProperty?.nightlyPrice ?? freshProp?.nightlyPrice ?? 0;

  // Dates des nuits facturées [checkIn..checkOut-1].
  const nightDates = useMemo(() => enumerateNights(startDate, endDate), [startDate, endDate]);

  // Prix par date renvoyé par le moteur (nightlyPrice non nul).
  const pricingByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of dynamicPricingQuery.data ?? []) {
      if (day.nightlyPrice != null) map.set(day.date, day.nightlyPrice);
    }
    return map;
  }, [dynamicPricingQuery.data]);

  // Prix de chaque nuit (repli prix plat si date manquante).
  const nightlyPrices = useMemo(
    () => nightDates.map((d) => pricingByDate.get(d) ?? flatNightlyFallback),
    [nightDates, pricingByDate, flatNightlyFallback],
  );

  const hasDynamicData = (dynamicPricingQuery.data?.length ?? 0) > 0;

  // Base HÉBERGEMENT du séjour = somme des prix/nuit (repli plat × nuits sans données).
  const baseAccommodationTotal = useMemo(() => {
    const sum = hasDynamicData && nightlyPrices.length > 0
      ? nightlyPrices.reduce((s, p) => s + p, 0)
      : flatNightlyFallback * numberOfNights;
    return Math.round(sum * 100) / 100;
  }, [hasDynamicData, nightlyPrices, flatNightlyFallback, numberOfNights]);

  const baseNightlyAvg = numberOfNights
    ? Math.round((baseAccommodationTotal / numberOfNights) * 100) / 100
    : 0;

  const priceVaries = useMemo(() => new Set(nightlyPrices).size >= 2, [nightlyPrices]);
  const pricingLoading = dynamicPricingQuery.isFetching;

  const cleaningFeeAmount = useMemo(() => {
    if (!createCleaning || !cleaningFee) return 0;
    return parseFloat(cleaningFee) || 0;
  }, [createCleaning, cleaningFee]);

  // Taxe de séjour : mineurs exonérés → assise sur les voyageurs taxables.
  const touristTaxAmount = useMemo(() => {
    const rate = parseFloat(touristTaxPerPerson) || 0;
    return Math.round(rate * taxableGuests * numberOfNights * 100) / 100;
  }, [touristTaxPerPerson, taxableGuests, numberOfNights]);

  // Total hébergement après override, appliqué sur le TOTAL du séjour :
  // custom = prix plat/nuit × nuits (remplace la base) ; réductions = sur le total base.
  const accommodationTotal = useMemo(() => {
    const val = parseFloat(pricingValue);
    const hasVal = pricingValue !== '' && !isNaN(val);
    let total: number;
    if (!hasVal) {
      total = baseAccommodationTotal;
    } else if (pricingMode === 'custom') {
      total = val * numberOfNights;
    } else if (pricingMode === 'discount_euro') {
      total = Math.max(0, baseAccommodationTotal - val);
    } else {
      total = Math.max(0, baseAccommodationTotal * (1 - val / 100));
    }
    return Math.round(total * 100) / 100;
  }, [pricingValue, pricingMode, baseAccommodationTotal, numberOfNights]);

  const totalPrice = useMemo(
    () => Math.round((accommodationTotal + cleaningFeeAmount + touristTaxAmount) * 100) / 100,
    [accommodationTotal, cleaningFeeAmount, touristTaxAmount],
  );

  // ── Guest search (debounced) ──────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(guestSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [guestSearchQuery]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['reservation-dialog-guest-search', debouncedSearch],
    queryFn: () => guestsApi.search(debouncedSearch),
    enabled: debouncedSearch.length >= 2 && !selectedGuest,
    staleTime: 10_000,
  });

  // ── Guest create mutation ──────────────────────────────────────────────────
  const createGuestMutation = useMutation({
    mutationFn: (guestData: CreateGuestData) => guestsApi.create(guestData),
    onSuccess: (guest: GuestDto) => {
      setSelectedGuest(guest);
      setShowCreateGuestForm(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestPhone('');
      setNewGuestCountry('');
      setNewGuestLanguage('fr');
      setNewGuestNotes('');
    },
  });

  const handleCreateGuest = useCallback(() => {
    if (!newGuestFirstName.trim() || !newGuestLastName.trim()) return;
    createGuestMutation.mutate({
      firstName: newGuestFirstName.trim(),
      lastName: newGuestLastName.trim(),
      email: newGuestEmail.trim() || undefined,
      phone: newGuestPhone.trim() || undefined,
      countryCode: newGuestCountry.trim() || undefined,
      language: newGuestLanguage || undefined,
      notes: newGuestNotes.trim() || undefined,
    });
  }, [newGuestFirstName, newGuestLastName, newGuestEmail, newGuestPhone, newGuestCountry, newGuestLanguage, newGuestNotes, createGuestMutation]);

  // ── Save mutation (create OR update) ───────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (): Promise<Reservation> => {
      if (isEdit && reservation) {
        const updateData: UpdateReservationData = { notes, status };
        if (!isExternalSource) {
          updateData.guestName = selectedGuest?.fullName;
          updateData.guestEmail = selectedGuest?.email || undefined;
          updateData.guestPhone = selectedGuest?.phone || undefined;
          updateData.guestCount = guestCount;
          updateData.childrenCount = minors;
          updateData.adultsCount = taxableGuests;
          updateData.checkIn = startDate;
          updateData.checkOut = endDate;
          updateData.checkInTime = checkInTime || undefined;
          updateData.checkOutTime = checkOutTime || undefined;
          updateData.totalPrice = totalPrice || undefined;
        }
        return reservationsApi.update(reservation.id, updateData);
      }

      // Création (source directe). L'intention de paiement dérive le statut :
      // confirm_now → 'confirmed' (bloque le calendrier) ; request_payment → 'pending'
      // (n'est bloquant qu'au paiement) + envoi d'un lien Stripe au voyageur.
      const requestPayment = paymentIntent === 'request_payment';
      if (createdIdRef.current == null) {
        // Upsert de la fiche voyageur AVANT la résa, une seule fois (garde anti-doublon) :
        // fiche existante (id) → update ; sinon → create. Persistance différée au submit.
        if (upsertedGuestRef.current == null) {
          const guestData: CreateGuestData = {
            firstName: newGuestFirstName.trim(),
            lastName: newGuestLastName.trim(),
            email: newGuestEmail.trim() || undefined,
            phone: newGuestPhone.trim() || undefined,
            countryCode: newGuestCountry.trim() || undefined,
            language: newGuestLanguage || undefined,
            notes: newGuestNotes.trim() || undefined,
          };
          upsertedGuestRef.current = selectedGuest?.id
            ? await guestsApi.update(selectedGuest.id, guestData)
            : await guestsApi.create(guestData);
        }
        const guest = upsertedGuestRef.current;
        const guestName = guest.fullName || `${newGuestFirstName.trim()} ${newGuestLastName.trim()}`.trim();

        const createData: CreateReservationData = {
          propertyId: effectivePropertyId as number,
          guestName,
          guestId: guest.id,
          guestEmail: newGuestEmail.trim() || undefined,
          guestPhone: newGuestPhone.trim() || undefined,
          guestCount,
          adultsCount: taxableGuests,
          childrenCount: minors,
          checkIn: startDate,
          checkOut: endDate,
          checkInTime: checkInTime || undefined,
          checkOutTime: checkOutTime || undefined,
          status: requestPayment ? 'pending' : 'confirmed',
          totalPrice: totalPrice || undefined,
          cleaningFee: cleaningFeeAmount || undefined,
          touristTaxAmount: touristTaxAmount || undefined,
          confirmationCode: confirmationCode || undefined,
          createCleaning,
          notes: notes || undefined,
        };
        const created = await reservationsApi.create(createData);
        createdIdRef.current = created.id;
        if (!requestPayment) return created;
      }
      // request_payment : envoie (ou renvoie, après un échec) le lien de paiement à l'email
      // renseigné (override) ou, à défaut, à celui du voyageur.
      // La résa est déjà créée (ref) → un retry ne recrée pas de doublon.
      return reservationsApi.sendPaymentLink(createdIdRef.current!, paymentEmail.trim() || newGuestEmail.trim() || undefined);
    },
    onSuccess: (result: Reservation) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.all });
      queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
      createdIdRef.current = null;
      upsertedGuestRef.current = null;
      if (isEdit) onUpdated?.(result);
      else onCreated?.(result);
      onClose();
    },
    onError: (err: Error) => {
      // Résa créée mais lien de paiement en échec (Stripe non configuré, etc.) : la résa
      // existe (en attente) — on rafraîchit et on invite à renvoyer le lien plus tard.
      if (createdIdRef.current != null) {
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
        queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
        setError(t('reservations.dialog.paymentLinkError', { defaultValue: err.message }));
        return;
      }
      setError(err.message || t(isEdit ? 'reservations.dialog.errorUpdateFailed' : 'reservations.dialog.errorCreateFailed'));
    },
  });

  const handleSubmit = useCallback(() => {
    if (!isEdit) {
      if (!effectivePropertyId) {
        setError(t('reservations.dialog.propertyPlaceholder'));
        return;
      }
      if (!newGuestFirstName.trim() || !newGuestLastName.trim()) {
        setError(t('reservations.dialog.errorGuestRequired'));
        return;
      }
    }
    if (!isExternalSource && (!startDate || !endDate)) {
      setError(t('reservations.dialog.errorDatesRequired'));
      return;
    }
    if (hasConflict) {
      setError(t('reservations.dialog.conflictBlocking'));
      return;
    }
    // « Demander le paiement » : un montant ET un email voyageur sont requis pour le lien Stripe.
    if (!isEdit && paymentIntent === 'request_payment') {
      if (!(totalPrice > 0)) {
        setError(t('reservations.dialog.errorPaymentNeedsAmount'));
        return;
      }
      if (!(paymentEmail.trim() || newGuestEmail.trim())) {
        setError(t('reservations.dialog.errorPaymentNeedsEmail'));
        return;
      }
    }
    setError(null);
    saveMutation.mutate();
  }, [isEdit, effectivePropertyId, newGuestFirstName, newGuestLastName, isExternalSource, startDate, endDate, hasConflict, paymentIntent, paymentEmail, newGuestEmail, totalPrice, saveMutation, t]);

  const clearGuest = useCallback(() => {
    setSelectedGuest(null);
    setGuestSearchQuery('');
    // Retour à un nouveau voyageur vierge.
    setNewGuestFirstName('');
    setNewGuestLastName('');
    setNewGuestEmail('');
    setNewGuestPhone('');
    setNewGuestCountry('');
    setNewGuestLanguage('fr');
    setNewGuestNotes('');
  }, []);

  const selectPricingMode = useCallback((m: PricingMode) => {
    setPricingMode(m);
    setPricingValue('');
  }, []);

  // ── Derived labels & flags ────────────────────────────────────────────────
  const locale = isArabic ? 'ar' : isEnglish ? 'en-US' : 'fr-FR';
  const weekdayLabels = isEnglish ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const nightsText = `${numberOfNights} ${t(numberOfNights > 1 ? 'reservations.dialog.nights' : 'reservations.dialog.night')}`;

  const sourceKey = isEdit && reservation ? reservation.source : 'direct';
  const headerTitle = isEdit ? t('reservations.edit') : t('reservations.create');

  const propertyName =
    lockedProperty?.name
    ?? (isEdit ? reservation?.propertyName : propertiesQuery.data?.find((p) => p.id === propertyId)?.name)
    ?? '';

  const pricingLabel =
    pricingMode === 'custom'
      ? t('reservations.dialog.customPrice')
      : pricingMode === 'discount_euro'
        ? t('reservations.dialog.discountEuro')
        : t('reservations.dialog.discountPercent');

  const estimatedCleaningPrice = freshProp?.cleaningBasePrice ?? lockedProperty?.cleaningBasePrice;
  const statuses = isEdit ? EDIT_STATUSES : CREATE_STATUSES;
  const fieldsLocked = isExternalSource;
  const requestPayment = !isEdit && paymentIntent === 'request_payment';

  const submitDisabled =
    saveMutation.isPending
    || hasConflict
    || (!isEdit && (!newGuestFirstName.trim() || !newGuestLastName.trim() || !effectivePropertyId))
    || (!isExternalSource && (!startDate || !endDate));

  return {
    isEdit,
    isExternalSource,
    showPropertySelector,
    isPlatformStaff,
    fieldsLocked,

    startDate,
    endDate,
    setStartDate,
    setEndDate,
    checkInTime,
    checkOutTime,
    setCheckInTime,
    setCheckOutTime,
    numberOfNights,
    nightsText,
    locale,
    weekdayLabels,

    propertyId,
    setPropertyId,
    properties: propertiesQuery.data ?? [],
    propertiesLoading: propertiesQuery.isLoading,
    propertyName,
    effectivePropertyId,

    selectedGuest,
    setSelectedGuest,
    clearGuest,
    guestSearchQuery,
    setGuestSearchQuery,
    debouncedSearch,
    searchResults,
    isSearching,
    showCreateGuestForm,
    setShowCreateGuestForm,
    newGuestFirstName,
    setNewGuestFirstName,
    newGuestLastName,
    setNewGuestLastName,
    newGuestEmail,
    setNewGuestEmail,
    newGuestPhone,
    setNewGuestPhone,
    newGuestCountry,
    setNewGuestCountry,
    newGuestLanguage,
    setNewGuestLanguage,
    newGuestNotes,
    setNewGuestNotes,
    handleCreateGuest,
    createGuestPending: createGuestMutation.isPending,
    createGuestError: createGuestMutation.isError,

    guestCount,
    setGuestCount,
    childrenCount,
    setChildrenCount,

    baseNightlyAvg,
    baseAccommodationTotal,
    priceVaries,
    nightlyPrices,
    nightDates,
    pricingLoading,
    pricingMode,
    selectPricingMode,
    pricingValue,
    setPricingValue,
    pricingLabel,
    accommodationTotal,
    totalPrice,

    createCleaning,
    setCreateCleaning,
    cleaningFee,
    setCleaningFee,
    cleaningFeeAmount,
    estimatedCleaningPrice,
    touristTaxPerPerson,
    setTouristTaxPerPerson,
    touristTaxAmount,
    confirmationCode,
    setConfirmationCode,
    notes,
    setNotes,

    status,
    setStatus,
    statuses,
    paymentIntent,
    setPaymentIntent,
    requestPayment,
    paymentEmail,
    setPaymentEmail,

    conflictWarnings,
    hasConflict,
    error,
    submitDisabled,
    saving: saveMutation.isPending,
    handleSubmit,

    headerTitle,
    sourceKey,
  };
}
