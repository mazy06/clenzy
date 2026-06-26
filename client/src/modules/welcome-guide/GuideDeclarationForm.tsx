import React, { useMemo, useState } from 'react';
import { ShieldCheck, UserPlus, Trash2, ArrowRight, Lock, AlertCircle } from 'lucide-react';
import type { GuideLabels, Lang } from './WelcomeBookView';
import { normalizeTheme } from './welcomeBookThemes';
import type { GuestDeclarant } from '../../services/api/welcomeGuideApi';

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

export interface GuideDeclarationFormProps {
  lang: Lang;
  labels: GuideLabels;
  /** Thème visuel du livret (variables CSS `.wb`). */
  theme: string;
  /** Clés de champ manquantes (cf. `DataCollectionInfo.missingFields`). */
  missingFields: string[];
  /** Soumet la déclaration ; renvoie true si la collecte est désormais complète. */
  onSubmit: (declarants: GuestDeclarant[]) => Promise<boolean>;
}

const GuideDeclarationForm: React.FC<GuideDeclarationFormProps> = ({ lang, labels, theme, missingFields, onSubmit }) => {
  const L = labels;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const countries = useCountryOptions(lang);

  const [drafts, setDrafts] = useState<DeclarantDraft[]>([{ ...EMPTY_DRAFT }]);
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const fieldLabel = useMemo<Record<keyof DeclarantDraft, string>>(
    () => ({
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
    }),
    [L],
  );

  const docTypeLabel = useMemo<Record<IdDocumentType, string>>(
    () => ({ PASSPORT: L.docPassport, ID_CARD: L.docIdCard, RESIDENCE_PERMIT: L.docResidencePermit }),
    [L],
  );

  const fieldsFor = (index: number): Set<keyof DeclarantDraft> =>
    index === 0 ? primaryFields : new Set<keyof DeclarantDraft>(COMPANION_FIELDS);

  const update = (index: number, key: keyof DeclarantDraft, value: string) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
  };

  const addCompanion = () => setDrafts((prev) => [...prev, { ...EMPTY_DRAFT }]);
  const removeCompanion = (index: number) => setDrafts((prev) => prev.filter((_, i) => i !== index));

  const isInvalid = (index: number, key: keyof DeclarantDraft): boolean =>
    showErrors && fieldsFor(index).has(key) && !drafts[index][key].trim();

  const allValid = (): boolean =>
    drafts.every((d, i) => Array.from(fieldsFor(i)).every((k) => d[k].trim().length > 0));

  const submit = async () => {
    setSubmitError(null);
    if (!allValid()) {
      setShowErrors(true);
      setSubmitError(L.declErrorRequired);
      return;
    }
    setSubmitting(true);
    try {
      const declarants: GuestDeclarant[] = drafts.map((d) => ({
        firstName: d.firstName.trim(),
        lastName: d.lastName.trim(),
        maidenName: d.maidenName.trim() || null,
        birthDate: d.birthDate,
        birthPlace: d.birthPlace.trim(),
        nationality: d.nationality || '',
        residenceAddress: d.residenceAddress.trim() || null,
        residenceCountry: d.residenceCountry || null,
        idDocumentType: d.idDocumentType || '',
        idDocumentNumber: d.idDocumentNumber.trim(),
      }));
      const complete = await onSubmit(declarants);
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
          onChange={(e) => update(index, key, e.target.value)}
          style={fieldStyle(invalid)}
        />
      );
    } else if (key === 'nationality' || key === 'residenceCountry') {
      control = (
        <select id={fieldId} value={value} onChange={(e) => update(index, key, e.target.value)} style={{ ...fieldStyle(invalid), cursor: 'pointer' }}>
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
        <select id={fieldId} value={value} onChange={(e) => update(index, key, e.target.value)} style={{ ...fieldStyle(invalid), cursor: 'pointer' }}>
          <option value="">{L.selectPlaceholder}</option>
          {ID_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {docTypeLabel[t]}
            </option>
          ))}
        </select>
      );
    } else {
      control = (
        <input
          id={fieldId}
          type="text"
          value={value}
          autoComplete="off"
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
    'idDocumentType',
    'idDocumentNumber',
  ];

  return (
    <div className="wb" data-theme={normalizeTheme(theme)} dir={dir} style={{ height: '100%' }}>
      <div className="wb__scroll" style={{ padding: '28px 18px calc(env(safe-area-inset-bottom) + 28px)' }}>
        <div className="wb-rise" style={{ maxWidth: 440, margin: '0 auto' }}>
          {/* En-tête rassurant */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: 'var(--terra-bg)',
                color: 'var(--terra-deep)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <ShieldCheck size={26} strokeWidth={1.6} />
            </div>
            <div className="wb-eyebrow" style={{ marginBottom: 8 }}>{L.declEyebrow}</div>
            <div className="wb-h2" style={{ marginBottom: 10, textWrap: 'balance' as React.CSSProperties['textWrap'] }}>{L.declTitle}</div>
            <div className="wb-lead">{L.declIntro}</div>
          </div>

          {drafts.map((draft, index) => {
            const fields = fieldsFor(index);
            const visible = FIELD_ORDER.filter((k) => fields.has(k));
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
                      style={{
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
                      }}
                    >
                      <Trash2 size={14} strokeWidth={1.8} /> {L.declRemove}
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {visible.map((key) => {
                    // L'adresse de résidence prend toute la largeur pour respirer.
                    const fullWidth = key === 'residenceAddress';
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
            style={{
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
            }}
          >
            <UserPlus size={17} strokeWidth={1.8} /> {L.declAddCompanion}
          </button>

          {submitError ? (
            <div
              role="alert"
              style={{
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
              }}
            >
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
