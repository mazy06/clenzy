import { STORAGE_KEYS } from '../../services/storageService';

type Draft = { payload: Record<string, unknown>; request: { key: string; id: string }; savedAt: number };
const fields = ['fullName', 'email', 'phone', 'companyName', 'organizationType', 'forfait', 'billingPeriod', 'city', 'postalCode', 'propertyType', 'propertyCount', 'billingCountry', 'surface', 'guestCapacity', 'bookingFrequency', 'cleaningSchedule', 'calendarSync', 'services', 'servicesDevis', 'acceptedTerms', 'newsletterOptIn', 'promoCode', 'referralSource'];
export function readSignupDraft(): Draft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.SIGNUP_ATTEMPT) ?? 'null') as Draft | null;
    if (!draft || !draft.payload || !/^[a-f0-9-]{36}$/i.test(draft.request?.id) || Date.now() - draft.savedAt > 86_400_000 || draft.savedAt > Date.now()) return null;
    if (Object.keys(draft.payload).some(k => !fields.includes(k)) || JSON.stringify(draft.payload) !== draft.request.key) return null;
    return draft;
  } catch { return null; }
}
export function saveSignupDraft(payload: Record<string, unknown>, request: { key: string; id: string }): void {
  try {
    const safe = Object.fromEntries(Object.entries(payload).filter(([key]) => fields.includes(key)));
    sessionStorage.setItem(STORAGE_KEYS.SIGNUP_ATTEMPT, JSON.stringify({ payload: safe, request, savedAt: Date.now() }));
  } catch { /* Le parcours reste utilisable si le navigateur bloque le stockage de session. */ }
}
