import React, { useMemo, useState } from 'react';
import { ShieldCheck, UserPlus, Trash2, ArrowRight, Lock, AlertCircle } from '../../icons/glyphs';
import type { GuideLabels, Lang } from './WelcomeBookView';
import { normalizeTheme } from './welcomeBookThemes';
import type { DeclarationRules, GuestDeclarant } from '../../services/api/welcomeGuideApi';

/**
 * Écran de complétion réglementaire (fiche de police + check-in) qui « gate » le livret guest.
 *
 * Affiché uniquement quand le payload signale `dataCollection.required && !dataCollection.complete`.
 * On ne demande QUE les champs présents dans `missingFields` (clés renvoyées par
 * `GuestDeclarationService`). Le voyageur principal est le premier déclarant ; il peut ajouter des
 * accompagnants. La soumission appelle l'endpoint public et, si la collecte devient complète, révèle
 * le contenu du livret.
 *
 * Habillage : design system `.wb` (variables CSS thémées, classes partagées), RTL pour l'arabe,
 * icônes lucide, transitions héritées de `.wb-pressable` / `.wb-btn`. Identité Baitly.
 */

/** Type de pièce d'identité (valeur stockée stable, libellé i18n côté `GUIDE_LABELS`). */
type IdDocumentType = 'PASSPORT' | 'ID_CARD' | 'RESIDENCE_PERMIT';

/** Brouillon d'un déclarant : tous champs en string (formulaire contrôlé). */
interface DeclarantDraft {
  firstName: string;
  lastName: string;
  maidenName: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  residenceAddress: string;
  residenceCountry: string;
  idDocumentType: string;
  idDocumentNumber: string;
  phone: string;
  email: string;
}

const EMPTY_DRAFT: DeclarantDraft = {
  firstName: '',
  lastName: '',
  maidenName: '',
  birthDate: '',
  birthPlace: '',
  nationality: '',
  residenceAddress: '',
  residenceCountry: '',
  idDocumentType: '',
  idDocumentNumber: '',
  phone: '',
  email: '',
};

/** Champs « identité » toujours demandés au principal ET aux accompagnants (en plus de missingFields). */
const COMPANION_FIELDS: (keyof DeclarantDraft)[] = [
  'firstName',
  'lastName',
  'birthDate',
  'birthPlace',
  'nationality',
  'idDocumentType',
  'idDocumentNumber',
];

// Ordre d'affichage stable des champs (identité → naissance → nationalité → résidence → pièce).
const FIELD_ORDER: (keyof DeclarantDraft)[] = [
  'firstName',
  'lastName',
  'maidenName',
  'birthDate',
  'birthPlace',
  'nationality',
  'residenceAddress',
  'residenceCountry',
  'phone',
  'email',
  'idDocumentType',
  'idDocumentNumber',
];

const DRAFT_KEYS = new Set<string>(FIELD_ORDER);

/** Clés serveur → champs du brouillon (une clé inconnue est ignorée plutôt que de casser le formulaire). */
function toFieldSet(keys: string[]): Set<keyof DeclarantDraft> {
  return new Set(keys.filter((k) => DRAFT_KEYS.has(k)) as (keyof DeclarantDraft)[]);
}

/** Âge révolu à une date de référence (ISO) ; null si la date de naissance est absente ou illisible. */
function ageAt(birthDate: string, referenceDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age -= 1;
  return age;
}

/** Codes ISO 3166-1 alpha-2 — localisés à l'affichage via Intl.DisplayNames (langue du livret). */
const ISO_COUNTRY_CODES: string[] = [
  'AD', 'AE', 'AF', 'AL', 'AM', 'AO', 'AR', 'AT', 'AU', 'AZ', 'BA', 'BD', 'BE', 'BF', 'BG', 'BH',
  'BJ', 'BO', 'BR', 'BW', 'BY', 'CA', 'CD', 'CG', 'CH', 'CI', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU',
  'CY', 'CZ', 'DE', 'DK', 'DO', 'DZ', 'EC', 'EE', 'EG', 'ES', 'ET', 'FI', 'FR', 'GA', 'GB', 'GE',
  'GH', 'GN', 'GR', 'GT', 'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IN', 'IQ', 'IR', 'IS',
  'IT', 'JM', 'JO', 'JP', 'KE', 'KH', 'KR', 'KW', 'KZ', 'LB', 'LK', 'LT', 'LU', 'LV', 'LY', 'MA',
  'MC', 'MD', 'ME', 'MG', 'MK', 'ML', 'MR', 'MT', 'MU', 'MX', 'MY', 'MZ', 'NA', 'NE', 'NG', 'NL',
  'NO', 'NP', 'NZ', 'OM', 'PA', 'PE', 'PH', 'PK', 'PL', 'PT', 'PY', 'QA', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SD', 'SE', 'SG', 'SI', 'SK', 'SN', 'SY', 'TD', 'TG', 'TH', 'TN', 'TR', 'TW', 'TZ', 'UA',
  'UG', 'US', 'UY', 'UZ', 'VE', 'VN', 'YE', 'ZA', 'ZM', 'ZW',
];

const ID_DOCUMENT_TYPES: IdDocumentType[] = ['PASSPORT', 'ID_CARD', 'RESIDENCE_PERMIT'];

/** Liste pays {code, name} triée alphabétiquement dans la langue du livret (Intl, repli code brut). */
function useCountryOptions(lang: Lang): { code: string; name: string }[] {
  return useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      display = null;
    }
    return ISO_COUNTRY_CODES.map((code) => ({
      code,
      name: (display && display.of(code)) || code,
    })).sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [lang]);
}

interface FieldShellProps {
  id: string;
  label: string;
  required: boolean;
  invalid: boolean;
  children: React.ReactNode;
}

/** Enveloppe d'un champ : <label> associé + astérisque requis + état d'erreur accessible. */
const FieldShell: React.FC<FieldShellProps> = ({ id, label, required, invalid, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label htmlFor={id} className="wb-label" style={{ color: invalid ? 'var(--terra-deep)' : 'var(--ink-faint)' }}>
      {label}
      {required ? <span style={{ color: 'var(--terra)' }} aria-hidden> *</span> : null}
    </label>
    {children}
  </div>
);

const fieldStyle = (invalid: boolean): React.CSSProperties => ({
  width: '100%',
  border: `1px solid ${invalid ? 'var(--terra)' : 'var(--line)'}`,
  borderRadius: 14,
  padding: '12px 14px',
  fontFamily: 'var(--sans)',
  fontSize: 14,
  color: 'var(--ink)',
  background: 'var(--surface)',
  outline: 'none',
});

const iconBadgeStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 999,
  background: 'var(--terra-bg)',
  color: 'var(--terra-deep)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 16,
};

const removeCompanionButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  borderRadius: 999,
  padding: '6px 12px',
  color: 'var(--ink-soft)',
  fontFamily: 'var(--sans)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
};

const addCompanionButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1.5px dashed var(--terra-soft)',
  background: 'transparent',
  borderRadius: 14,
  padding: '12px 16px',
  color: 'var(--terra-deep)',
  fontFamily: 'var(--sans)',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
  justifyContent: 'center',
  marginBottom: 18,
};

const submitErrorStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  background: 'var(--terra-bg)',
  color: 'var(--terra-deep)',
  border: '1px solid var(--terra-soft)',
  borderRadius: 12,
  padding: '11px 14px',
  fontSize: 13.5,
  lineHeight: 1.45,
  marginBottom: 14,
};

export interface GuideDeclarationFormProps {
  lang: Lang;
  labels: GuideLabels;
  /** Thème visuel du livret (variables CSS `.wb`). */
  theme: string;
  /** Clés de champ manquantes (cf. `DataCollectionInfo.missingFields`). */
  missingFields: string[];
  /** Règles du pays du logement ; absentes = comportement historique (missingFields). */
  rules?: DeclarationRules | null;
  /** Soumet la déclaration ; renvoie true si la collecte est désormais complète. */
  onSubmit: (declarants: GuestDeclarant[], certified: boolean) => Promise<boolean>;
}

const GuideDeclarationForm: React.FC<GuideDeclarationFormProps> = ({ lang, labels, theme, missingFields, rules, onSubmit }) => {
  const L = labels;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const countries = useCountryOptions(lang);

  const [drafts, setDrafts] = useState<DeclarantDraft[]>([{ ...EMPTY_DRAFT }]);
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [certified, setCertified] = useState(false);

  // Champs demandés au PRINCIPAL = union(missingFields, identité minimale). Un accompagnant ne fournit
  // pas son adresse de résidence (rattachée au foyer du principal — cf. service backend).
  const missingSet = useMemo(() => new Set(missingFields), [missingFields]);
  const primaryFields = useMemo(() => {
    const set = new Set<keyof DeclarantDraft>(COMPANION_FIELDS);
    (['residenceAddress'] as (keyof DeclarantDraft)[]).forEach((f) => {
      if (missingSet.has(f)) set.add(f);
    });
    // residenceCountry n'est pas dans missingFields mais accompagne logiquement l'adresse.
    if (missingSet.has('residenceAddress')) set.add('residenceCountry');
    return set;
  }, [missingSet]);

  const fieldLabel: Record<keyof DeclarantDraft, string> = {
    firstName: L.fFirstName,
    lastName: L.fLastName,
    maidenName: L.fMaidenName,
    birthDate: L.fBirthDate,
    birthPlace: L.fBirthPlace,
    nationality: L.fNationality,
    residenceAddress: L.fResidenceAddress,
    residenceCountry: L.fResidenceCountry,
    idDocumentType: L.fIdDocumentType,
    idDocumentNumber: L.fIdDocumentNumber,
    phone: L.fPhone,
    email: L.fEmail,
  };

  const docTypeLabel: Record<IdDocumentType, string> = {
    PASSPORT: L.docPassport,
    ID_CARD: L.docIdCard,
    RESIDENCE_PERMIT: L.docResidencePermit,
  };

  // Règles du pays : la loi décide, pas le formulaire. France : un ressortissant français
  // n'a pas de fiche (seule son identité est notée), un enfant de moins de 15 ans figure
  // sur la fiche de l'adulte qu'il accompagne (identité et naissance seulement).
  const isExempt = (draft: DeclarantDraft): boolean =>
    !!rules?.exemptNationality && draft.nationality === rules.exemptNationality;

  const fieldsFor = (index: number): Set<keyof DeclarantDraft> => {
    if (!rules) {
      return index === 0 ? primaryFields : new Set<keyof DeclarantDraft>(COMPANION_FIELDS);
    }
    const draft = drafts[index];
    if (isExempt(draft)) {
      return new Set<keyof DeclarantDraft>(['nationality', 'firstName', 'lastName']);
    }
    if (index > 0 && rules.minorAgeUnder != null) {
      const age = ageAt(draft.birthDate, rules.referenceDate);
      if (age != null && age < rules.minorAgeUnder) return toFieldSet(rules.minorFields);
    }
    return toFieldSet(index === 0 ? rules.primaryFields : rules.companionFields);
  };

  // Avec une nationalité dispensée, la nationalité vient EN PREMIER : elle décide du reste.
  const fieldOrder: (keyof DeclarantDraft)[] = rules?.exemptNationality
    ? ['nationality', ...FIELD_ORDER.filter((k) => k !== 'nationality')]
    : FIELD_ORDER;

  const update = (index: number, key: keyof DeclarantDraft, value: string) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
  };

  const addCompanion = () => setDrafts((prev) => [...prev, { ...EMPTY_DRAFT }]);
  const removeCompanion = (index: number) => setDrafts((prev) => prev.filter((_, i) => i !== index));

  const isInvalid = (index: number, key: keyof DeclarantDraft): boolean =>
    showErrors && fieldsFor(index).has(key) && !drafts[index][key].trim();

  const allValid = (): boolean =>
    drafts.every((d, i) => Array.from(fieldsFor(i)).every((k) => d[k].trim().length > 0));

  const certificationMissing = !!rules?.certificationRequired && !certified
    && drafts.some((d) => !isExempt(d));

  const submit = async () => {
    setSubmitError(null);
    if (!allValid()) {
      setShowErrors(true);
      setSubmitError(L.declErrorRequired);
      return;
    }
    if (certificationMissing) {
      setShowErrors(true);
      setSubmitError(L.declCertifyRequired);
      return;
    }
    setSubmitting(true);
    try {
      // Minimisation : seuls les champs demandés pour CE voyageur partent au serveur.
      const declarants: GuestDeclarant[] = drafts.map((d, i) => {
        const asked = fieldsFor(i);
        const pick = (k: keyof DeclarantDraft): string | null => (asked.has(k) && d[k].trim() ? d[k].trim() : null);
        return {
          firstName: d.firstName.trim(),
          lastName: d.lastName.trim(),
          maidenName: pick('maidenName'),
          birthDate: pick('birthDate') ?? '',
          birthPlace: pick('birthPlace') ?? '',
          nationality: d.nationality || '',
          residenceAddress: pick('residenceAddress'),
          residenceCountry: pick('residenceCountry'),
          idDocumentType: pick('idDocumentType'),
          idDocumentNumber: pick('idDocumentNumber'),
          phone: pick('phone'),
          email: pick('email'),
        };
      });
      const complete = await onSubmit(declarants, certified);
      if (!complete) {
        setSubmitError(L.declStillMissing);
      }
    } catch {
      setSubmitError(L.declErrorSubmit);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (index: number, key: keyof DeclarantDraft) => {
    const fieldId = `decl-${index}-${key}`;
    const invalid = isInvalid(index, key);
    const value = drafts[index][key];

    let control: React.ReactNode;
    if (key === 'birthDate') {
      control = (
        <input
          id={fieldId}
          type="date"
          value={value}
          dir="ltr"
          aria-label={fieldLabel[key]}
          onChange={(e) => update(index, key, e.target.value)}
          style={fieldStyle(invalid)}
        />
      );
    } else if (key === 'nationality' || key === 'residenceCountry') {
      control = (
        <select id={fieldId} value={value} aria-label={fieldLabel[key]} onChange={(e) => update(index, key, e.target.value)} style={{ ...fieldStyle(invalid), cursor: 'pointer' }}>
          <option value="">{L.selectPlaceholder}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      );
    } else if (key === 'idDocumentType') {
      control = (
        <select id={fieldId} value={value} aria-label={fieldLabel[key]} onChange={(e) => update(index, key, e.target.value)} style={{ ...fieldStyle(invalid), cursor: 'pointer' }}>
          <option value="">{L.selectPlaceholder}</option>
          {ID_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {docTypeLabel[t]}
            </option>
          ))}
        </select>
      );
    } else {
      const inputType = key === 'phone' ? 'tel' : key === 'email' ? 'email' : 'text';
      control = (
        <input
          id={fieldId}
          type={inputType}
          dir={key === 'phone' || key === 'email' ? 'ltr' : undefined}
          value={value}
          autoComplete="off"
          aria-label={fieldLabel[key]}
          onChange={(e) => update(index, key, e.target.value)}
          style={fieldStyle(invalid)}
        />
      );
    }

    return (
      <FieldShell key={key} id={fieldId} label={fieldLabel[key]} required={fieldsFor(index).has(key)} invalid={invalid}>
        {control}
      </FieldShell>
    );
  };

  return (
    <div className="wb" data-theme={normalizeTheme(theme)} dir={dir} style={{ height: '100%' }}>
      <div className="wb__scroll" style={{ padding: '28px 18px calc(env(safe-area-inset-bottom) + 28px)' }}>
        <div className="wb-rise" style={{ maxWidth: 440, margin: '0 auto' }}>
          {/* En-tête rassurant */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={iconBadgeStyle}>
              <ShieldCheck size={26} strokeWidth={1.6} />
            </div>
            <div className="wb-eyebrow" style={{ marginBottom: 8 }}>{L.declEyebrow}</div>
            <div className="wb-h2" style={{ marginBottom: 10, textWrap: 'balance' as React.CSSProperties['textWrap'] }}>{L.declTitle}</div>
            <div className="wb-lead">{L.declIntro}</div>
          </div>

          {drafts.map((draft, index) => {
            const fields = fieldsFor(index);
            const visible = fieldOrder.filter((k) => fields.has(k));
            return (
              <div key={index} className="wb-card" style={{ padding: 20, marginBottom: 16, background: 'var(--raised)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
                  <div className="wb-label" style={{ color: 'var(--terra-deep)' }}>
                    {index === 0 ? L.declMainTraveller : `${L.declCompanion} ${index}`}
                  </div>
                  {index > 0 ? (
                    <button
                      type="button"
                      className="wb-pressable"
                      onClick={() => removeCompanion(index)}
                      style={removeCompanionButtonStyle}
                    >
                      <Trash2 size={14} strokeWidth={1.8} /> {L.declRemove}
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {visible.map((key) => {
                    // L'adresse de résidence prend toute la largeur pour respirer.
                    const fullWidth = key === 'residenceAddress' || key === 'email';
                    return (
                      <div key={key} style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
                        {renderField(index, key)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="wb-pressable"
            onClick={addCompanion}
            style={addCompanionButtonStyle}
          >
            <UserPlus size={17} strokeWidth={1.8} /> {L.declAddCompanion}
          </button>

          {rules?.certificationRequired && drafts.some((d) => !isExempt(d)) ? (
            <label
              htmlFor="decl-certify"
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, fontSize: 13, lineHeight: 1.5,
                color: showErrors && !certified ? 'var(--terra-deep)' : 'var(--ink-soft)', cursor: 'pointer' }}
            >
              <input
                id="decl-certify"
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0 }}
              />
              <span>{L.declCertify}</span>
            </label>
          ) : null}

          {submitError ? (
            <div role="alert" style={submitErrorStyle}>
              <AlertCircle size={17} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              {submitError}
            </div>
          ) : null}

          <button
            type="button"
            className="wb-btn wb-btn--block wb-pressable"
            onClick={() => void submit()}
            disabled={submitting}
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? L.declSubmitting : L.declSubmit}
            {!submitting ? <ArrowRight size={18} strokeWidth={1.9} /> : null}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 16,
              color: 'var(--ink-faint)',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <Lock size={14} strokeWidth={1.7} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{L.declPrivacy}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideDeclarationForm;
